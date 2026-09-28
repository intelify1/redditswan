import type { Caption } from "@remotion/captions";
import type { StoryProps } from "./types";

// Phase 2 de-risking step 1: FAKE hardcoded timestamps, fixed test assets, hardcoded hook cut.
// Used by `npm run studio` and by `node scripts/render.mjs --fixture`.

const HOOK = "Single parents, what's the most unhinged thing your kid said on a first date?";
const STORY =
  "I rented my basement to a guy named Derek for three years. Paid on time, every time. " +
  "The day he moved out, he handed me the keys and a sealed envelope that said open in thirty days.";

const HOOK_END_MS = 4200; // hardcoded cut point for the fixture

const fakeCaptions = (text: string, startMs: number, msPerWord = 380): Caption[] =>
  text.split(/\s+/).map((w, i) => ({
    text: (i === 0 ? "" : " ") + w,
    startMs: startMs + i * msPerWord,
    endMs: startMs + (i + 1) * msPerWord - 40,
    timestampMs: startMs + i * msPerWord + msPerWord / 2,
    confidence: 1,
  }));

const captions = fakeCaptions(STORY, HOOK_END_MS + 150);

export const fakeProps: StoryProps = {
  voiceSrc: "test/voice.mp3",
  bgSrc: "test/bg.mp4",
  sfxSrc: "assets/whoosh.mp3",
  avatarSrc: "assets/avatar.png",
  username: "RedditSwan",
  hook: HOOK,
  upvotes: "99+",
  comments: "99+",
  hookEndMs: HOOK_END_MS,
  durationMs: captions[captions.length - 1].endMs + 300,
  captions,
};
