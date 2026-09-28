import type { Caption } from "@remotion/captions";

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
// Frames of footage/silence kept after the last spoken word (no outro, just a tiny tail).
export const TAIL_FRAMES = 12;

export type StoryProps = {
  voiceSrc: string; // path inside public/, e.g. "run/voice.mp3"
  bgSrc: string; // path inside public/, e.g. "run/bg.mp4" (pre-trimmed, pre-sped, muted)
  sfxSrc: string | null; // path inside public/, e.g. "assets/whoosh.mp3"
  avatarSrc: string; // path inside public/
  username: string;
  hook: string;
  upvotes: string;
  comments: string;
  hookEndMs: number; // hard cut from hook card to captions at this instant
  durationMs: number; // total voice duration
  captions: Caption[]; // story words only (after the hook)
};
