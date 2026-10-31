import type { Metadata } from "next";
import { Card, SectionTitle } from "@/components/ui";

export const metadata: Metadata = {
  title: "About SwimAhead Swimming Recruiting",
  description: "Learn how SwimAhead helps swimmers find college programs by athletic and academic fit and helps college swimming coaches find recruits for roster needs.",
  alternates: { canonical: "/s/about" },
};
export const unstable_instant = false;

export default function AboutPage() {
  return (
    <div className="max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">About</h1>
        <p className="mt-1 text-sm text-ink-2">
          This site is a college swimming recruiting tool. It is used by two groups: coaches and
          swimmers.
        </p>
      </header>

      <Card>
        <SectionTitle>What coaches use it for</SectionTitle>
        <div className="space-y-3 text-sm text-ink-2">
          <p>
            A coach selects the college they work for. The site returns a list of recommended
            recruits for that college. The recommendations are based on the times swum by that
            college&apos;s current and recent roster, so the swimmers shown are ones whose times are
            in range for that program.
          </p>
          <p>
            The list can be adjusted to a roster need. A coach can set which events the college needs
            and the recommendations change to swimmers in those events.
          </p>
        </div>
      </Card>

      <Card>
        <SectionTitle>What swimmers use it for</SectionTitle>
        <div className="space-y-3 text-sm text-ink-2">
          <p>
            A swimmer imports their times. The site then shows colleges the swimmer could swim at,
            meaning colleges where the swimmer&apos;s times are in range for the roster. This is
            based on times, not on rankings or reputation.
          </p>
          <p>
            The swimmer can build and keep a list of colleges. Colleges can be filtered by academics,
            location, school size, and cost, so the list reflects both where the swimmer can swim and
            where the swimmer wants to attend. Colleges that do not fit can be ruled out.
          </p>
        </div>
      </Card>

      <Card>
        <SectionTitle>How it differs from other tools</SectionTitle>
        <ul className="list-disc space-y-2 pl-4 text-sm text-ink-2">
          <li>
            Swimmers are shown colleges they could swim at, decided by their times against real
            program rosters. Most tools rank programs but do not tell a swimmer where their times are
            in range.
          </li>
          <li>
            Coach recommendations are tied to one specific college and can be set to a roster need.
            They are not a single national list that every coach sorts by hand.
          </li>
          <li>
            Swimming times and the non-athletic factors (academics, location, size, cost) are filtered
            in the same list, rather than tracked separately.
          </li>
        </ul>
      </Card>

      <Card>
        <SectionTitle>Contact</SectionTitle>
        <p className="text-sm text-ink-2">
          Send questions, concerns, or bugs to Danny Beyerbach at {" "}
          <a href="mailto:db4atgm@gmail.com" className="text-accent-2 hover:underline">
            db4atgm@gmail.com
          </a>
          .
        </p>
      </Card>
    </div>
  );
}
