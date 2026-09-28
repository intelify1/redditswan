// Phase 3 — pick ONE random background clip from the shared Google Drive folder and prepare it.
// Runs BEFORE render.mjs's bundle() (A3): the prepared file must already sit in public/run/.
//
// Output: public/run/bg.mp4 — 1080x1920, 30fps, sped up slightly, NO AUDIO TRACK AT ALL
// (addendum §1: background is muted unconditionally; Remotion also sets `muted` as a second guard).
import { execFileSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out");
const RUN = path.join(ROOT, "public/run");
const DL = path.join(ROOT, "downloads");
for (const d of [OUT, RUN, DL]) if (!existsSync(d)) mkdirSync(d, { recursive: true }); // A4

const KEY = process.env.DRIVE_API_KEY;
const FOLDER = process.env.DRIVE_FOLDER_ID;
if (!KEY) throw new Error("DRIVE_API_KEY is not set");
if (!FOLDER) throw new Error("DRIVE_FOLDER_ID is not set");

const SPEED = Number(process.env.BG_SPEED || 1.3); // "slightly sped up to match the sped-up VO"

async function driveList(folderId) {
  const files = [];
  let pageToken;
  do {
    const u = new URL("https://www.googleapis.com/drive/v3/files");
    u.searchParams.set("q", `'${folderId}' in parents and trashed = false`);
    u.searchParams.set("fields", "nextPageToken, files(id, name, mimeType, size)");
    u.searchParams.set("pageSize", "1000");
    u.searchParams.set("supportsAllDrives", "true");
    u.searchParams.set("includeItemsFromAllDrives", "true");
    u.searchParams.set("key", KEY);
    if (pageToken) u.searchParams.set("pageToken", pageToken);
    const res = await fetch(u);
    const data = await res.json();
    if (!res.ok) {
      console.error("Drive API error:", JSON.stringify(data, null, 2));
      throw new Error(`Drive list failed (HTTP ${res.status}) — is the folder shared "Anyone with the link" and the Drive API enabled?`);
    }
    files.push(...data.files);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return files;
}

// Walk the folder tree (category subfolders are fine).
async function allVideos(rootId) {
  const queue = [rootId];
  const videos = [];
  while (queue.length) {
    const id = queue.shift();
    for (const f of await driveList(id)) {
      if (f.mimeType === "application/vnd.google-apps.folder") queue.push(f.id);
      else if (f.mimeType?.startsWith("video/") || /\.(mp4|mov|webm|mkv|m4v)$/i.test(f.name)) videos.push(f);
    }
  }
  return videos;
}

const probe = (file, entries) =>
  execFileSync("ffprobe", ["-v", "error", "-show_entries", entries, "-of", "csv=p=0", file]).toString().trim();

const tts = JSON.parse(readFileSync(path.join(OUT, "tts.json"), "utf8"));
const needSec = tts.durationMs / 1000 + 1.5; // voice + tail margin

const videos = await allVideos(FOLDER);
if (!videos.length) throw new Error("No video files found in the Drive folder");
console.log(`[footage] ${videos.length} clips in pool`);

// Fully random pick (spec §6). Retry with another clip if one fails to download/decode.
let done = false;
for (let attempt = 1; attempt <= 4 && !done; attempt++) {
  const clip = videos[Math.floor(Math.random() * videos.length)];
  const src = path.join(DL, "source" + (path.extname(clip.name) || ".mp4"));
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${clip.id}?alt=media&acknowledgeAbuse=true&supportsAllDrives=true&key=${KEY}`,
    );
    if (!res.ok) throw new Error(`download HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(src));
    const mb = (statSync(src).size / 1e6).toFixed(1);

    const srcDur = Number(probe(src, "format=duration"));
    if (!(srcDur > 1)) throw new Error("could not read clip duration");
    const sourceNeeded = needSec * SPEED; // seconds of source footage consumed
    const loop = srcDur < sourceNeeded + 0.5;
    const start = loop ? 0 : Math.random() * (srcDur - sourceNeeded - 0.5);

    const out = path.join(RUN, "bg.mp4");
    const args = ["-y", "-loglevel", "error"];
    if (loop) args.push("-stream_loop", "-1");
    args.push(
      "-ss", start.toFixed(2),
      "-i", src,
      "-t", sourceNeeded.toFixed(2),
      "-vf", `setpts=PTS/${SPEED},scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p`,
      "-an", // strip ALL audio — background must be silent, always
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
      "-movflags", "+faststart",
      out,
    );
    execFileSync("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });

    const outDur = Number(probe(out, "format=duration"));
    const hasAudio = probe(out, "stream=codec_type").includes("audio");
    if (hasAudio) throw new Error("prepared background still has an audio stream");
    if (outDur < needSec - 0.5) throw new Error(`prepared background too short (${outDur}s < ${needSec}s)`);

    console.log(`[footage] "${clip.name}" (${mb} MB, ${srcDur.toFixed(0)}s) → bg.mp4 ${outDur.toFixed(1)}s from ${start.toFixed(1)}s${loop ? " (looped)" : ""}, muted, x${SPEED}`);
    done = true;
  } catch (e) {
    console.warn(`[footage] attempt ${attempt} with "${clip.name}" failed: ${e.message}`);
  } finally {
    rmSync(src, { force: true });
  }
}
if (!done) throw new Error("Could not prepare a background clip after 4 attempts");
