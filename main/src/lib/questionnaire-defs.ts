
import type { AnswerMap, QuestionField } from "./questionnaire-fields";

export type Questionnaire = {
  id: string;
  collegeId: string | null;
  title: string;
  intro: string | null;
  shareToken: string;
  status: "active" | "closed";
  campaignId: string | null;
  extraFields: QuestionField[];
  submissionCount: number;
  newCount: number;
};

export type Submission = {
  id: string;
  fullName: string;
  gradYear: number | null;
  gender: "M" | "F" | null;
  email: string | null;
  phone: string | null;
  swimcloudUrl: string | null;
  club: string | null;
  lsc: string | null;
  timesText: string | null;
  answers: AnswerMap;
  status: "new" | "promoted" | "archived";
  submittedAt: string;
};

export type PublicQuestionnaire = {
  id: string;
  title: string;
  intro: string | null;
  coachingStaffName: string;
  status: "active" | "closed";
  extraFields: QuestionField[];
};
