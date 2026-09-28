// Phase 1 — ONE structured Groq call per video: hook, story, title, hashtags, topic.
// Reads state/history.json (recent topics) so stories don't repeat (A8), writes out/content.json.
// State is updated here on disk; the workflow commits it back only after a successful upload.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out");
const STATE = path.join(ROOT, "state/history.json");
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true }); // A4

const KEY = process.env.GROQ_API_KEY;
if (!KEY) throw new Error("GROQ_API_KEY is not set");

// A10: Llama 3.x moved to Enterprise-only (verified 2026-09-27 on console.groq.com/docs/models).
// Override with the GROQ_MODEL env var / repo variable if Groq changes tiers again.
const MODELS = [process.env.GROQ_MODEL, "openai/gpt-oss-120b", "openai/gpt-oss-20b"].filter(Boolean);

// Duration target (user): 45-55 s with a FAST narrator (~+45%, ≈235 wpm) → hook + story ≈ 180-210 words.
// tts.py fine-tunes the rate to land inside the window.
const MIN_WORDS = 180;
const MAX_WORDS = 210;
const CONSTANT_TAGS = ["#redditstories", "#shorts", "#storytime", "#askreddit", "#viral"];

const state = existsSync(STATE)
  ? JSON.parse(readFileSync(STATE, "utf8"))
  : { recentTopics: [] };
state.recentTopics ??= [];
state.recentModes ??= [];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---- Variety engine: every run gets a different combination (no single repeated path) ----
const MODES = [
  "REVENGE / KARMA: someone wrongs the narrator; the narrator's payback is clever, legal and satisfying, and karma lands harder than expected",
  "FAMILY SECRET: an ordinary tradition/object/habit slowly exposes a buried family secret; the reveal recontextualizes everything",
  "WHOLESOME TWIST: something that looks unfair, strange or controlling turns out to have a touching hidden reason",
  "WITTY COMEBACK: an older relative or quiet person handles freeloaders/rude people with one hilarious, unforgettable move",
  "ENTITLED PEOPLE GET WHAT'S COMING: someone takes advantage of the narrator's kindness; the narrator stops, and chaos exposes what they were worth",
  "SLOW-BURN MYSTERY: small odd details stack up, the narrator quietly investigates, and the answer is something nobody guessed",
  "WORKPLACE DRAMA: a boss/coworker/customer situation escalates with specific stakes and ends with a sharp reversal",
  "BACKFIRE: someone's scheme or lie (kept up for years) spectacularly backfires on them",
  "INHERITANCE / MONEY BETRAYAL: a relative or friend grabs money that isn't theirs; paperwork, a clause or a hidden document flips it",
  "AITA DILEMMA: the narrator did something harsh but understandable; the story makes the viewer pick a side, ending on the sharp final beat",
];
const ARENAS = [
  "family & inheritance", "workplace & bosses", "neighbors", "weddings", "dating & exes",
  "roommates & landlords", "money & scams", "school & teachers", "in-laws", "friend group",
  "restaurants & customer service", "travel & vacations", "small business", "car buying & mechanics",
  "pets", "gym", "online marketplace deals", "siblings", "parents' secrets", "holiday gatherings",
  "job interviews", "moving house", "grandparents", "lottery & windfalls", "childhood rules", "names & identity",
];
const ENDINGS = [
  "an ironic mic-drop line", "a one-line twist that recontextualizes the whole story",
  "a quietly devastating final sentence", "a funny deadpan final line", "a satisfying karma payoff in one line",
  "a small symbolic action (e.g. what the narrator did with an object) as the last beat",
];
const recentModes = state.recentModes.slice(0, 4);
const mode = pick(MODES.filter((m) => !recentModes.includes(m.split(":")[0])));
// Three setting ideas; the writer picks whichever fits the story type NATURALLY (forcing one
// produced absurd mash-ups like "inheritance theft during a workout").
const arenaIdeas = [...ARENAS].sort(() => Math.random() - 0.5).slice(0, 3);
let arena = arenaIdeas.join(" / ");
const ending = pick(ENDINGS);
const hookStyle = Math.random() < 0.65 ? "question" : "confession";
// Narrator gender decided up front (≈50/50) so the story is written for it and tts.py picks the
// matching voice (male: Andrew, female: Ava).
const narrator = Math.random() < 0.5 ? "female" : "male";

const HOOK_RULES =
  hookStyle === "question"
    ? `HOOK STYLE: an AskReddit-style DIRECT QUESTION addressed to a specific group of people, one sentence, ending with "?".
Pattern examples (never reuse): "Poor people who dated somebody rich, what did you learn?" / "Fathers, what's the smartest way you've messed with your daughter's boyfriend?" / "What family tradition ruined your family?"`
    : `HOOK STYLE: a first-person CONFESSION HEADLINE, one sentence, that states a shocking or intriguing situation and makes the viewer need the rest.
Pattern examples (never reuse): "My sister backstabbed our family over a $3 million inheritance, but karma hit her harder." / "I kept my name change a secret for five years."`;

const SYSTEM = `You write viral, original, first-person Reddit-style stories for a YouTube Shorts narration channel (voiced by a calm narrator over gameplay footage). All content is ORIGINAL fiction — never copy or reword real Reddit posts or other channels' scripts.
Keep it general-audience and advertiser-safe: no sexual content, no graphic violence or gore, no hate, no self-harm, no real public figures, no real brands accused of wrongdoing.

${HOOK_RULES}
The hook must stop the scroll: specific, emotionally loaded, zero setup needed, max ~18 words. Never generic ("you won't believe...", "this is crazy").

STORY (the answer/continuation of the hook, first person, spoken aloud):
1. Brief setup that grounds us fast (who, where, one concrete detail).
2. Something feels slightly off.
3. Quiet observation/investigation — tension builds before any confrontation.
4. Escalating stakes with vivid, concrete details — first names, places, objects, small actions, a line of dialogue. Use exact figures SPARINGLY: at most 2 numbers in the whole story (one dollar amount OR one date is usually enough, and only where it hits hardest). Prefer natural phrasing ("a few weeks later", "almost ten grand", "last spring") over lists of exact dates and prices.
5. Confrontation or reveal.
6. Final line: ${ending}. Never a flat resolution, never a moral lesson, never a question to the audience.
- Every new detail should recontextualize what we already know; curiosity stacks until the last line.
- Must deliver exactly what the hook promises.
- Natural spoken storytelling: short and medium sentences, a little dialogue in quotes, conversational rhythm — not rushed, not over-explained, no filler.
- No emojis, hashtags, headings, "Edit:", "Update:", or "TL;DR".

REALISM (critical): it must feel like something that genuinely happened to a real person. Real-world logic only: money, wills, jobs, laws and family dynamics work the way they do in real life. No contrived clauses, no cartoon villains announcing their plan, no coincidences doing the heavy lifting. People react like real people.
The hook's audience must be the NATURAL group for this story (a will story → "People who got cut out of a will…", not "Gym regulars…"). The setting must come from the story, not be bolted on.
Vary the opening line — don't start with "I was…" or "So…" every time; open on a concrete moment.

QUALITY REFERENCE (tone, pacing and specificity only — never reuse this premise, names or twist):
Hook: "People who found out a family secret from a stranger, how did it happen?"
Story: "My dad died in March, and at the funeral a woman I'd never met hugged me way too long. She said, 'You have his hands.' I figured she was an old coworker. Two weeks later I'm closing his bank account, and the teller asks if I want to keep the automatic transfer going. Four hundred dollars, on the first of every month, for nineteen years. To a Linda Walsh in Tucson. My mom had never heard the name. So I drove six hours to the address on the statement. The woman from the funeral opened the door. Behind her, on the fridge, was a graduation photo of a guy who looked exactly like me. She didn't even try to explain. She just said, 'He kept saying he'd tell you next Christmas.' I'm meeting my brother on Saturday. He still thinks our dad was a pilot who died in 2006."

LENGTH: hook + story together = ${MIN_WORDS}-${MAX_WORDS} words (aim ~195). This is a 45-55 second video; do not exceed ${MAX_WORDS}.

METADATA:
- title: a clickable Shorts title (max 80 chars) for THIS story; curiosity-driven, not a template, no hashtags, not identical to the hook.
- constant_tags: pick exactly 2 from ${JSON.stringify(CONSTANT_TAGS)}.
- story_tags: 4-6 hashtags specific to THIS story's plot/theme (a scam story: #scammer #fraud #revenge; a family secret: #familysecrets #dnatest ...). Lowercase, no spaces.
- topic: a 6-12 word summary of the premise (used to avoid repeats).

Respond with ONLY a JSON object: {"hook": string, "story": string, "title": string, "constant_tags": string[], "story_tags": string[], "topic": string}`;

const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;
const normTag = (t) => "#" + String(t).replace(/^#+/, "").replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();

async function callGroq(model, messages) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      temperature: 1,
      max_completion_tokens: 4000,
      response_format: { type: "json_object" },
    }),
  });
  const data = await res.json().catch(() => ({ parseError: true, status: res.status }));
  // A10: fail loudly with Groq's actual error, never a cryptic undefined crash.
  if (!data.choices) {
    console.error(`Groq API error response (model ${model}, HTTP ${res.status}):`, JSON.stringify(data, null, 2));
    const err = new Error("Groq API did not return expected format");
    err.modelProblem = res.status === 404 || res.status === 400 || res.status === 403;
    throw err;
  }
  return data.choices[0].message.content;
}

const EDITOR = `You are a ruthless editor for a viral Reddit-story Shorts channel. Score the draft 1-10.
A 9-10 feels like a real top Reddit comment: natural hook addressed to the right group, fully plausible real-world logic, specific concrete details, tension that builds, and a final line that lands (twist, irony or payoff).
Deduct heavily for: internal contradictions or facts that don't add up (who is older, who adopted whom, timelines, names), implausible/contrived mechanics, a hook whose audience doesn't match the story, forced settings, generic phrasing, rushed or over-explained pacing, flat or moralising endings, a story that doesn't pay off the hook.
Respond ONLY with JSON: {"score": number, "fixes": "one or two sentences of the most important fixes"}`;

async function critique(model, o) {
  try {
    const raw = await callGroq(model, [
      { role: "system", content: EDITOR },
      { role: "user", content: `HOOK: ${o.hook}\nSTORY: ${o.story}` },
    ]);
    const r = JSON.parse(raw.replace(/^```(json)?|```$/g, "").trim());
    return typeof r.score === "number" ? r : null;
  } catch (e) {
    console.warn(`[generate] editor pass skipped: ${e.message}`);
    return null;
  }
}

function validate(o) {
  const problems = [];
  for (const k of ["hook", "story", "title", "topic"]) {
    if (typeof o[k] !== "string" || !o[k].trim()) problems.push(`missing ${k}`);
  }
  if (!Array.isArray(o.story_tags) || o.story_tags.length < 3) problems.push("story_tags must have 4-6 items");
  if (problems.length) return problems;
  const n = words(o.hook) + words(o.story);
  if (n < MIN_WORDS - 8) problems.push(`too short: ${n} words (need ${MIN_WORDS}-${MAX_WORDS})`);
  if (n > MAX_WORDS + 8) problems.push(`too long: ${n} words (need ${MIN_WORDS}-${MAX_WORDS})`);
  const figures = (o.story.match(/\$\s?\d[\d,.]*|\b\d[\d,.:/]*\b/g) || []).length;
  if (figures > 3) problems.push(`too many exact figures (${figures}) — keep at most 2 numbers/dates, use natural phrasing for the rest`);
  if (hookStyle === "question" && !o.hook.trim().endsWith("?")) problems.push("hook must be a direct question ending with ?");
  return problems;
}

const recent = state.recentTopics.slice(0, 20);
const userMsg =
  `Write one new story.\nStory type: ${mode}\nSetting ideas (use one only if it fits naturally, otherwise choose the most natural setting yourself): ${arena}\n` +
  `Narrator: a ${narrator === "female" ? "woman" : "man"} telling her/his own story in first person — details (relationships, pronouns others use for the narrator) must fit a ${narrator} narrator.\n` +
  (recent.length
    ? `Do NOT reuse or closely resemble any of these recent premises:\n- ${recent.join("\n- ")}\n`
    : "") +
  `Return the JSON object only.`;

let result = null;
let lastErr = null;
outer: for (const model of MODELS) {
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: userMsg },
  ];
  for (let attempt = 1; attempt <= 3; attempt++) {
    let raw;
    try {
      raw = await callGroq(model, messages);
    } catch (e) {
      lastErr = e;
      if (e.modelProblem) {
        console.warn(`[generate] model ${model} unavailable, trying next model`);
        continue outer;
      }
      await new Promise((r) => setTimeout(r, 3000 * attempt));
      continue;
    }
    let obj;
    try {
      obj = JSON.parse(raw.replace(/^```(json)?|```$/g, "").trim());
    } catch {
      messages.push({ role: "assistant", content: raw }, { role: "user", content: "That was not valid JSON. Return ONLY the JSON object." });
      continue;
    }
    const problems = validate(obj);
    if (problems.length === 0) {
      // Quality gate: a separate "editor" pass scores the story; weak drafts get rewritten.
      const review = attempt < 3 ? await critique(model, obj) : null;
      if (!review || review.score >= 8) {
        if (review) console.log(`[generate] editor score ${review.score}/10`);
        result = { ...obj, model, editorScore: review?.score ?? null };
        break outer;
      }
      console.warn(`[generate] editor score ${review.score}/10 — rewriting: ${review.fixes}`);
      messages.push(
        { role: "assistant", content: raw },
        { role: "user", content: `An editor rated this ${review.score}/10. Rewrite it (new JSON, same rules) fixing: ${review.fixes}` },
      );
      continue;
    }
    console.warn(`[generate] attempt ${attempt} (${model}) rejected: ${problems.join("; ")}`);
    messages.push(
      { role: "assistant", content: raw },
      { role: "user", content: `Fix these problems and return the full JSON again: ${problems.join("; ")}` },
    );
  }
}
if (!result) throw lastErr ?? new Error("Groq could not produce a valid story after retries");

// ---- Metadata (spec §9 + addendum §3) ----
const hook = result.hook.trim();
const story = result.story.trim().replace(/\s*\n+\s*/g, " ");
let constantTags = (result.constant_tags || []).map(normTag).filter((t) => CONSTANT_TAGS.includes(t)).slice(0, 3);
if (constantTags.length < 2) constantTags = ["#redditstories", "#storytime"];
const storyTags = [...new Set(result.story_tags.map(normTag))]
  .filter((t) => t.length > 2 && !constantTags.includes(t))
  .slice(0, 6);
const allTags = [...constantTags, ...storyTags];
const descTags = [...constantTags.slice(0, 2), ...storyTags.slice(0, 2)]; // 2-4 hashtags under the hook
const title = result.title.trim().replace(/#\S+/g, "").replace(/\s+/g, " ").slice(0, 95);

const content = {
  hook,
  story,
  title,
  description: `${hook}\n\n${descTags.join(" ")}`,
  tags: allTags.map((t) => t.slice(1)),
  hashtags: allTags,
  topic: result.topic.trim(),
  arenaIdeas: arena,
  editorScore: result.editorScore,
  mode: mode.split(":")[0],
  hookStyle,
  narrator,
  model: result.model,
  wordCount: words(hook) + words(story),
  createdAt: new Date().toISOString(),
};
writeFileSync(path.join(OUT, "content.json"), JSON.stringify(content, null, 2));

state.recentTopics = [content.topic, ...state.recentTopics].slice(0, 20);
state.recentModes = [content.mode, ...state.recentModes].slice(0, 10);
writeFileSync(STATE, JSON.stringify(state, null, 2) + "\n");

console.log(`[generate] ${content.model} · ${content.narrator} narrator · ${content.wordCount} words · "${content.title}"`);
console.log(`[generate] hook: ${hook}`);
