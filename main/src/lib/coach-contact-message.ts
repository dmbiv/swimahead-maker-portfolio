import "server-only";

import { z } from "zod";
import { sanitizeEmailHtml } from "./email-html";
import {
  emailBodyToHtml,
  emailHtmlToText,
  escapeEmailHtml,
  renderEmailHtml,
  renderEmailText,
  type EmailBodyFormat,
} from "./email-content";
import {
  contactEmailSchema,
  type SelectedContactRoute,
} from "./contact-route-core";

export type ContactMessageRecruit = {
  fullName: string;
  bestEvent: string | null;
  bestTime: string | null;
  classYear: number | null;
  classYearMin: number | null;
  classYearMax: number | null;
  clubName: string | null;
};

export type ContactMessageTemplate = {
  subjectTemplate: string;
  bodyTemplate: string;
  bodyFormat: EmailBodyFormat | null;
};

export type RenderedCoachContactMessage = {
  subject: string;
  html: string;
  text: string;
};

function recruitValues(
  recruit: ContactMessageRecruit,
  coachName: string,
  programName: string,
): Record<string, string> {
  const classLabel = recruit.classYear != null
    ? String(recruit.classYear)
    : recruit.classYearMin != null && recruit.classYearMax != null
      ? recruit.classYearMin === recruit.classYearMax
        ? String(recruit.classYearMin)
        : `${recruit.classYearMin} or ${recruit.classYearMax}`
      : "";
  return {
    first_name: recruit.fullName.split(/\s+/)[0] ?? recruit.fullName,
    full_name: recruit.fullName,
    best_event: recruit.bestEvent ?? "",
    best_time: recruit.bestTime ?? "",
    class_year: classLabel,
    club: recruit.clubName ?? "",
    coach_name: coachName,
    program_name: programName,
  };
}

function contactOwnerWrapper(input: {
  contactName: string | null;
  revealContactName: boolean;
  recruitName: string;
  coachName: string;
  programName: string;
  innerHtml: string;
  innerText: string;
}): RenderedCoachContactMessage {
  const greeting = input.revealContactName && input.contactName?.trim()
    ? `Hello ${input.contactName.trim()},`
    : "Hello,";
  const subject = `College recruiting note regarding ${input.recruitName} - ${input.programName}`;
  const html = [
    `<p>${escapeEmailHtml(greeting)}</p>`,
    `<p>I'm ${escapeEmailHtml(input.coachName)} with ${escapeEmailHtml(input.programName)}. This individualized recruiting message was routed to an authorized contact address for ${escapeEmailHtml(input.recruitName)}.</p>`,
    `<p>Please review the message below. You may reply directly or, if appropriate, share it with ${escapeEmailHtml(input.recruitName)} or the person who handles their recruiting communication. Please do not send private contact details to SwimAhead.</p>`,
    "<hr>",
    `<div>${input.innerHtml}</div>`,
  ].join("");
  const text = [
    greeting,
    `I'm ${input.coachName} with ${input.programName}. This individualized recruiting message was routed to an authorized contact address for ${input.recruitName}.`,
    `Please review the message below. You may reply directly or, if appropriate, share it with ${input.recruitName} or the person who handles their recruiting communication. Please do not send private contact details to SwimAhead.`,
    "--- Enclosed recruiting message ---",
    input.innerText,
  ].join("\n\n");
  return { subject, html, text };
}

function complianceFooter(input: {
  operatorName: string;
  postalAddress: string;
  optOutEmail: string;
}): { html: string; text: string } {
  const optOutEmail = contactEmailSchema.parse(input.optOutEmail);
  const operatorName = z.string().trim().min(2).max(200).parse(input.operatorName);
  const postalAddress = z.string().trim().min(8).max(500).parse(input.postalAddress);
  return {
    html: [
      "<hr>",
      `<p style="font-size:12px;color:#5f6773">Sent as an individualized college-recruiting message. To stop future SwimAhead-routed outreach, contact <a href="mailto:${escapeEmailHtml(optOutEmail)}">${escapeEmailHtml(optOutEmail)}</a>.</p>`,
      `<p style="font-size:12px;color:#5f6773">${escapeEmailHtml(operatorName)} · ${escapeEmailHtml(postalAddress)}</p>`,
    ].join(""),
    text: `---\nTo stop future SwimAhead-routed outreach, contact ${optOutEmail}.\n${operatorName} · ${postalAddress}`,
  };
}

export function renderCoachContactMessage(input: {
  recruit: ContactMessageRecruit;
  template: ContactMessageTemplate;
  route: SelectedContactRoute;
  coachName: string;
  programName: string;
  operatorName: string;
  postalAddress: string;
  optOutEmail: string;
  revealWorkspaceContactName?: boolean;
}): RenderedCoachContactMessage {
  if (input.route.kind === "none") throw new Error("No contact route is available.");
  const values = recruitValues(input.recruit, input.coachName, input.programName);
  const isHtml = input.template.bodyFormat === "html";
  const subject = renderEmailText(input.template.subjectTemplate, values).trim().slice(0, 500);
  const templateHtml = isHtml
    ? sanitizeEmailHtml(input.template.bodyTemplate, "html")
    : emailBodyToHtml(input.template.bodyTemplate, "text");
  const baseHtml = isHtml
    ? renderEmailHtml(templateHtml, values)
    : emailBodyToHtml(renderEmailText(input.template.bodyTemplate, values), "text");
  const baseText = isHtml
    ? emailHtmlToText(baseHtml)
    : renderEmailText(input.template.bodyTemplate, values);
  if (!subject || !baseHtml.trim() || !baseText.trim()) {
    throw new Error("The selected template could not be rendered.");
  }

  let message: RenderedCoachContactMessage;
  if (input.route.kind !== "workspace_direct") {
    message = contactOwnerWrapper({
      contactName: null,
      revealContactName: false,
      recruitName: input.recruit.fullName,
      coachName: input.coachName,
      programName: input.programName,
      innerHtml: baseHtml,
      innerText: baseText,
    });
  } else if (input.route.relationship !== "athlete") {
    message = contactOwnerWrapper({
      contactName: input.route.contactName,
      revealContactName: Boolean(input.revealWorkspaceContactName),
      recruitName: input.recruit.fullName,
      coachName: input.coachName,
      programName: input.programName,
      innerHtml: baseHtml,
      innerText: baseText,
    });
  } else {
    message = { subject, html: baseHtml, text: baseText };
  }

  const footer = complianceFooter(input);
  return {
    subject: message.subject.slice(0, 500),
    html: sanitizeEmailHtml(`${message.html}${footer.html}`, "html"),
    text: `${message.text.trim()}\n\n${footer.text}`,
  };
}
