
export type Division = "D1" | "D2" | "D3" | "NAIA";
export type Course = "SCY" | "SCM" | "LCM";
export type Gender = "M" | "F";

export type EventCode =
  | "50FR" | "100FR" | "200FR" | "500FR" | "1000FR" | "1650FR"
  | "100BK" | "200BK" | "100BR" | "200BR" | "100FL" | "200FL"
  | "200IM" | "400IM";

export type EventGroup = "SPRINT" | "MID" | "DIST" | "BK" | "BR" | "FL" | "IM";

export interface Program {
  id: string;
  name: string;
  shortName: string;
  division: Division;
  conference: string;
  city: string;
  state: string;  
  type: "public" | "private";
  enrollment: number;
  admitRate: number;  
  netPrice: number;  
  satMid: number;  
  actMid: number;  
  majors: string[];  
  questionnaireUrl: string;
  staffUrl: string;
  rosterUrl: string;
  strength: number;
  genders: ("M" | "F")[];
  rosterCap: number;
  isDemo?: boolean;  
}

export interface EventProfile {
  programId: string;
  event: EventCode;
  gender: Gender;
  inviteTime: number;   
  scoreTime: number;    
  aFinalTime: number;   
}

export interface RosterSwimmer {
  id: string;
  programId: string;
  name: string;
  gradYear: number;
  gender: Gender;
  group: EventGroup;
  bestEvent: EventCode;
  bestSeconds: number;  
}

export interface Swimmer {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  gradYear: number;
  club: string;
  city: string;
  state: string;
  email: string;
  phone: string;
  gpa: number;
  sat: number | null;
  act: number | null;
  maxAnnualCost: number | null;
  majors: string[];
  videoUrl: string;
  bio: string;
  swimcloudId: string | null;
  claimed: boolean;  
}

export interface SwimTime {
  id: string;
  swimmerId: string;
  event: string;  
  course: Course;
  seconds: number;
  date: string;  
  meet: string;
  source: "seed" | "manual" | "paste" | "swimcloud" | "swims" | "questionnaire" | "csv";
  proofUrl: string | null;  
}

export interface SwimsMember {
  memberId: string;
  fullName: string;
  shortName: string;
  club: string;
  lsc: string;
  age: number | null;
  isNcaa: boolean;
}

export interface Standard {
  code: string;  
  label: string;
  event: EventCode;
  gender: Gender;
  seconds: number;  
}

export interface BoardItem {
  id: string;
  swimmerId: string;
  programId: string;
  lane: "dream" | "target" | "likely";
  status: "researching" | "contacted" | "talking" | "visit" | "offer" | "committed";
  notes: string;
  order: number;
}

export interface Favorite {
  id: string;
  swimmerId: string;
  programId: string;
  at: string;
}

export type Stage =
  | "identified" | "contacted" | "responding" | "visit" | "offer" | "verbal" | "signed" | "passed";

export const STAGES: Stage[] = [
  "identified", "contacted", "responding", "visit", "offer", "verbal", "signed", "passed",
];

export interface Recruit {
  id: string;
  programId: string;
  swimmerId: string | null;  
  firstName: string;
  lastName: string;
  gender: Gender;
  gradYear: number;
  club: string;
  state: string;
  email: string;
  phone: string;
  gpa: number | null;
  sat: number | null;
  act: number | null;
  majors: string[];
  group: EventGroup;
  stage: Stage;
  rating: number;  
  scholarshipPct: number;  
  tags: string[];
  order: number;
  source: "search" | "csv" | "questionnaire" | "manual" | "favorite";
  createdAt: string;
}

export interface Activity {
  id: string;
  programId: string;
  recruitId: string | null;
  kind: "note" | "call" | "email" | "stage" | "import" | "visit" | "task" | "compliance" | "system";
  body: string;
  at: string;
}

export interface Task {
  id: string;
  programId: string;
  recruitId: string | null;
  title: string;
  due: string;  
  done: boolean;
}

export interface Template {
  id: string;
  programId: string;
  name: string;
  subject: string;
  body: string;
  bodyFormat?: "text" | "html";
}

export interface CoachSettings {
  programId: string;  
  coachName: string;
  coachEmail: string;
  gender: Gender;  
  scholarshipBudget: number;  
  complianceMode: "block" | "warn";
}

export interface DB {
  dataVersion: number;
  programs: Program[];
  eventProfiles: EventProfile[];
  roster: RosterSwimmer[];
  swimmers: Swimmer[];
  times: SwimTime[];
  standards: Standard[];
  boardItems: BoardItem[];
  favorites: Favorite[];
  recruits: Recruit[];
  activities: Activity[];
  tasks: Task[];
  templates: Template[];
  coachSettings: CoachSettings;
  meSwimmerId: string;
}
