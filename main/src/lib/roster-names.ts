
const NICKNAME_GROUPS: readonly (readonly string[])[] = [
  ["robert", "bob", "bobby", "rob", "robbie", "bert"],
  ["william", "will", "bill", "billy", "willie", "liam"],
  ["richard", "rick", "ricky", "dick", "rich"],
  ["john", "jack", "johnny", "jonathan", "jon"],
  ["james", "jim", "jimmy", "jamie"],
  ["joseph", "joe", "joey", "jos"],
  ["thomas", "tom", "tommy"],
  ["michael", "mike", "mikey", "mick"],
  ["nicholas", "nick", "nicky", "nico"],
  ["charles", "charlie", "chuck", "chas", "charley"],
  ["edward", "ed", "eddie", "ted", "teddy", "ned"],
  ["theodore", "ted", "teddy", "theo"],
  ["henry", "hank", "harry"],
  ["harold", "hal", "harry"],
  ["anthony", "tony"],
  ["andrew", "andy", "drew"],
  ["daniel", "dan", "danny"],
  ["david", "dave", "davey"],
  ["stephen", "steven", "steve", "stevie"],
  ["kenneth", "ken", "kenny"],
  ["lawrence", "larry", "laurence", "lars"],
  ["gerald", "jerry", "gerry"],
  ["jerome", "jerry"],
  ["francis", "frank", "franklin", "frankie"],
  ["gregory", "greg"],
  ["jeffrey", "jeff", "geoffrey", "geoff"],
  ["vincent", "vince", "vinny", "vinnie"],
  ["dominic", "dom", "nick"],
  ["patrick", "pat", "paddy"],
  ["patricia", "pat", "patty", "trish", "tricia"],
  ["peter", "pete"],
  ["philip", "phil", "phillip"],
  ["raymond", "ray"],
  ["ronald", "ron", "ronnie"],
  ["donald", "don", "donnie"],
  ["albert", "al", "bert"],
  ["alan", "al", "allan", "allen"],
  ["arthur", "art", "artie"],
  ["walter", "walt", "wally"],
  ["isaac", "ike", "zac", "zack"],
  ["jacob", "jake"],
  ["zachary", "zach", "zack", "zac"],
  ["louis", "lou", "louie"],
  ["maurice", "mo", "moe"],
  ["salvatore", "sal"],
  ["augustus", "gus"],
  ["manuel", "manny"],
  ["frederick", "fred", "freddie"],
  ["leonard", "leo", "lenny", "len"],
  ["mitchell", "mitch"],
  ["russell", "russ", "rusty"],
  ["stanley", "stan"],
  ["wesley", "wes"],
  ["oliver", "ollie"],
  ["gabriel", "gabe"],
  ["nathaniel", "nate", "nat", "nathan"],
  ["nathan", "nate"],
  ["matthew", "matt", "matty"],
  ["elizabeth", "liz", "lizzy", "beth", "betsy", "libby", "eliza", "betty"],
  ["katherine", "kate", "katie", "kathy", "kat", "kitty", "catherine", "cathy"],
  ["margaret", "maggie", "meg", "peggy", "marge", "greta"],
  ["mary", "molly", "mae", "polly"],
  ["sarah", "sally", "sadie", "sara"],
  ["ann", "annie", "nancy", "anne", "anna"],
  ["rebecca", "becca", "becky", "bec"],
  ["jennifer", "jen", "jenny", "jenn"],
  ["jessica", "jess", "jessie"],
  ["susan", "sue", "susie", "suzy", "suzanne"],
  ["deborah", "deb", "debbie", "debra"],
  ["cynthia", "cindy"],
  ["amanda", "mandy"],
  ["nicole", "nikki", "nicky"],
  ["victoria", "vicky", "tori", "vikki"],
  ["virginia", "ginny", "gigi"],
  ["jacqueline", "jackie"],
  ["kimberly", "kim"],
  ["pamela", "pam"],
  ["penelope", "penny"],
  ["theresa", "terry", "tess", "teresa", "tessa"],
  ["christina", "tina", "chris", "christy", "chrissy", "kristina"],
  ["alexandra", "lexi", "sasha", "allie", "alex", "sandra", "sandy"],
  ["samantha", "sam", "sammy"],
  ["madeline", "maddie", "madelyn", "madeleine"],
  ["madison", "maddie", "madi"],
  ["abigail", "abby", "abbie"],
  ["gabrielle", "gabby", "gabriella"],
  ["eleanor", "ellie", "nell", "elle"],
  ["josephine", "josie", "jo"],
  ["cecilia", "cece", "celia"],
  ["lillian", "lily", "lil", "lilly"],
  ["natalie", "nat", "nattie"],
  ["stephanie", "steph", "stephany"],
  ["valerie", "val"],
  ["veronica", "roni", "ronnie"],
  ["genevieve", "genny", "viv"],
  ["olivia", "liv", "livy"],
  ["amelia", "mia", "amy"],
  ["isabella", "bella", "izzy", "isabel", "isabelle"],
  ["alexis", "lexi", "alex"],
  ["caroline", "carrie", "callie", "carly", "carol"],
  ["charlotte", "charlie", "lottie", "char"],
  ["evelyn", "evie", "eve"],
  ["kathleen", "kate", "katie", "kathy"],
  ["allison", "allie", "ally", "alison"],
  ["danielle", "dani", "dee"],
  ["michaela", "mikayla", "kayla"],
  ["cameron", "cam"],
  ["benjamin", "benji"],
  ["maxwell", "max"],
  ["maximilian", "max"],
  ["bradley", "brad"],
  ["douglas", "doug"],
  ["martin", "marty"],
  ["randall", "randy"],
  ["timothy", "tim", "timmy"],
  ["joshua", "josh"],
  ["antonio", "tony"],
  ["giovanni", "gio", "john"],
  ["xavier", "xavi"],
  ["alexander", "xander", "alec", "alex", "sasha", "lex"],
];

const GROUPS_BY_NAME = (() => {
  const map = new Map<string, number[]>();
  NICKNAME_GROUPS.forEach((group, index) => {
    for (const name of group) {
      const list = map.get(name) ?? [];
      list.push(index);
      map.set(name, list);
    }
  });
  return map;
})();

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

export function foldName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9-]+/g, " ")
    .trim();
}

export function nameTokens(value: string): string[] {
  return foldName(value)
    .split(/\s+/)
    .filter((token) => token.length > 0 && !SUFFIXES.has(token) && token.length > 1);
}

export type NameParts = { first: string; last: string; middle: string[] };

export function nameParts(value: string): NameParts | null {
  const tokens = nameTokens(value);
  if (tokens.length < 2) return null;
  return { first: tokens[0], last: tokens[tokens.length - 1], middle: tokens.slice(1, -1) };
}

export function givenNamesMatch(left: string, right: string): boolean {
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length >= 3 && right.length >= 3 && (left.startsWith(right) || right.startsWith(left))) {
    return true;
  }
  const leftGroups = GROUPS_BY_NAME.get(left);
  const rightGroups = GROUPS_BY_NAME.get(right);
  if (!leftGroups || !rightGroups) return false;
  return leftGroups.some((group) => rightGroups.includes(group));
}

export function surnamesMatch(left: string, right: string): boolean {
  if (!left || !right) return false;
  if (left === right) return true;
  const leftParts = left.split("-").filter(Boolean);
  const rightParts = right.split("-").filter(Boolean);
  return leftParts.some((part) => rightParts.includes(part));
}

export function formalNamesFor(given: string): string[] {
  const groups = GROUPS_BY_NAME.get(given) ?? [];
  const formal = new Set<string>();
  for (const index of groups) {
    const candidate = NICKNAME_GROUPS[index][0];
    if (candidate !== given) formal.add(candidate);
  }
  return [...formal].sort((left, right) => right.length - left.length);
}

export type SwimsNameQuery = {
  query: string;
  broad: boolean;
};

export function swimsSearchQueries(fullName: string, limit = 5): SwimsNameQuery[] {
  const parts = nameParts(fullName);
  const queries: SwimsNameQuery[] = [];
  const seen = new Set<string>();

  const push = (query: string, broad: boolean) => {
    const clean = query.trim().replace(/\s+/g, " ");
    if (clean.length < 2 || seen.has(clean)) return;
    seen.add(clean);
    queries.push({ query: clean, broad });
  };

  if (!parts) {
    push(foldName(fullName), false);
    return queries.slice(0, limit);
  }

  const { first, last } = parts;
  const lastForms = [last, ...last.split("-").filter((part) => part.length > 1)];

  push(`${first} ${last}`, false);
  for (const formal of formalNamesFor(first).slice(0, 2)) push(`${formal} ${last}`, false);
  for (const form of lastForms.slice(1)) push(`${first} ${form}`, false);
  for (const form of lastForms) if (form.length >= 3) push(form, true);

  return queries.slice(0, limit);
}
