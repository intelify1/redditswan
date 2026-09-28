// Render ONE video per run (A7): out/video-1.mp4 + out/video-1.json
//
// Strict three-pass structure (A3):
//   Pass 1 — PREPARE: every dynamic asset (voice, footage, captions) must already be in public/
//            (tts.py, transcribe.py, footage.mjs run BEFORE this script). We verify, never download here.
//   Pass 2 — BUNDLE: bundle() snapshots public/ — so it runs only after all assets exist.
//   Pass 3 — RENDER.
//
// Usage:
//   node scripts/render.mjs            -> real run, builds props from out/content.json + tts.json + captions.json
//   node scripts/render.mjs --fixture  -> Phase 2 fake-timestamp fixture (defaultProps)
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out");
const PUBLIC = path.join(ROOT, "public");
const fixture = process.argv.includes("--fixture");
const CHANNEL_NAME = process.env.CHANNEL_NAME || "RedditSwan"; // shown on the hook card, fixed every video

// A4: fresh CI runners have no out/ folder.
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

// ---------------- Pass 1: PREPARE ----------------
let inputProps;
let meta = null;
if (fixture) {
  inputProps = undefined; // use composition defaultProps (fake data)
} else {
  const read = (f) => JSON.parse(readFileSync(path.join(OUT, f), "utf8"));
  const content = read("content.json"); // generate.mjs
  const tts = read("tts.json"); // tts.py
  const captions = read("captions.json"); // transcribe.py
  inputProps = {
    voiceSrc: "run/voice.mp3",
    bgSrc: "run/bg.mp4",
    sfxSrc: existsSync(path.join(PUBLIC, "assets/whoosh.mp3")) ? "assets/whoosh.mp3" : null,
    avatarSrc: "assets/avatar.png",
    username: CHANNEL_NAME,
    hook: content.hook,
    upvotes: "99+",
    comments: "99+",
    hookEndMs: tts.hookEndMs,
    durationMs: tts.durationMs,
    captions: captions.filter((c) => c.startMs >= tts.hookEndMs),
  };
  // No blank beat after the hard cut: the first caption appears on the cut frame itself.
  if (inputProps.captions.length && inputProps.captions[0].startMs - tts.hookEndMs < 600) {
    inputProps.captions[0] = { ...inputProps.captions[0], startMs: tts.hookEndMs };
  }
  meta = {
    title: content.title,
    description: content.description,
    tags: content.tags,
    hook: content.hook,
    topic: content.topic,
    durationMs: tts.durationMs,
  };
  // Every dynamic asset must exist BEFORE bundle() (A3).
  for (const key of ["voiceSrc", "bgSrc", "sfxSrc", "avatarSrc"]) {
    const rel = inputProps[key];
    if (!rel) continue;
    if (!existsSync(path.join(PUBLIC, rel))) throw new Error(`Asset missing before bundle: public/${rel}`);
  }
  writeFileSync(path.join(OUT, "props.json"), JSON.stringify(inputProps, null, 1));
}
console.log(`[render] pass 1 ok (${fixture ? "fixture" : "real"} props)`);

// ---------------- Pass 2: BUNDLE (after all assets exist) ----------------
const t0 = Date.now();
const serveUrl = await bundle({
  entryPoint: path.join(ROOT, "src/index.ts"),
  publicDir: PUBLIC,
});
console.log(`[render] pass 2 bundled in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// ---------------- Pass 3: RENDER ----------------
// Local override for sandboxes without internet; CI lets Remotion fetch its own Chrome.
const browserExecutable = process.env.BROWSER_EXECUTABLE || null;
const composition = await selectComposition({
  serveUrl,
  browserExecutable,
  id: "RedditStory",
  inputProps,
});
const outFile = path.join(OUT, fixture ? "fixture.mp4" : "video-1.mp4");
let lastPct = -1;
const t1 = Date.now();
await renderMedia({
  composition,
  serveUrl,
  browserExecutable,
  codec: "h264",
  crf: 20,
  audioBitrate: "192k",
  outputLocation: outFile,
  inputProps,
  concurrency: process.env.RENDER_CONCURRENCY ? Number(process.env.RENDER_CONCURRENCY) : null,
  timeoutInMilliseconds: 120000,
  onProgress: ({ progress }) => {
    const pct = Math.floor(progress * 10) * 10;
    if (pct !== lastPct) {
      lastPct = pct;
      console.log(`[render] ${pct}%`);
    }
  },
});
console.log(
  `[render] pass 3 done: ${path.relative(ROOT, outFile)} (${composition.durationInFrames} frames, ${((Date.now() - t1) / 1000).toFixed(1)}s)`,
);

if (meta) writeFileSync(path.join(OUT, "video-1.json"), JSON.stringify(meta, null, 2));
