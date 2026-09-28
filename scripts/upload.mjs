// Phase 5 — upload rendered video(s) to YouTube as PRIVATE with native publishAt (+60 min).
//
// A6: videos are discovered from the filesystem (out/video-1.mp4, out/video-2.mp4, … until one is
//     missing) — never from a hardcoded count or a stale list.
// A7: the pipeline renders ONE video per trigger, so each video's publishAt is exactly 1 hour after
//     its own upload. (If several ever exist, each gets its own staggered publish time.)
// A5: credentials come from env vars (GitHub Secrets) first, local files second.
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ROOT, getAccessToken } from "./youtube-auth-lib.mjs";

const OUT = path.join(ROOT, "out");
const PUBLISH_DELAY_MIN = Number(process.env.PUBLISH_DELAY_MIN || 60);
const DRY_RUN = process.env.UPLOAD_DRY_RUN === "1" || process.argv.includes("--dry-run");

const videos = [];
for (let n = 1; existsSync(path.join(OUT, `video-${n}.mp4`)); n++) {
  const metaFile = path.join(OUT, `video-${n}.json`);
  if (!existsSync(metaFile)) throw new Error(`out/video-${n}.mp4 exists but its metadata out/video-${n}.json does not`);
  videos.push({ n, file: path.join(OUT, `video-${n}.mp4`), meta: JSON.parse(readFileSync(metaFile, "utf8")) });
}
if (!videos.length) throw new Error("No rendered videos found (expected out/video-1.mp4)");
console.log(`[upload] found ${videos.length} video(s)`);

const results = [];
const token = DRY_RUN ? null : await getAccessToken();

for (const [i, v] of videos.entries()) {
  const publishAt = new Date(Date.now() + (PUBLISH_DELAY_MIN + i * 75) * 60_000);
  publishAt.setSeconds(0, 0);
  const body = {
    snippet: {
      title: v.meta.title.slice(0, 100),
      description: v.meta.description.slice(0, 4900),
      tags: v.meta.tags.slice(0, 15),
      categoryId: "24", // Entertainment
      defaultLanguage: "en",
      defaultAudioLanguage: "en",
    },
    status: {
      privacyStatus: "private",
      publishAt: publishAt.toISOString(), // YouTube flips it public natively — no separate job
      selfDeclaredMadeForKids: false,
      embeddable: true,
      license: "youtube",
      containsSyntheticMedia: true, // AI-voiced fictional story — disclosed per YouTube policy
    },
  };
  const size = statSync(v.file).size;
  console.log(`[upload] video-${v.n}: "${body.snippet.title}" (${(size / 1e6).toFixed(1)} MB), publishAt ${body.status.publishAt}`);
  if (DRY_RUN) {
    console.log("[upload] DRY RUN — skipping YouTube upload. Metadata:\n" + JSON.stringify(body, null, 2));
    continue;
  }

  // Resumable upload: 1) create session with metadata, 2) PUT the bytes.
  const init = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(size),
      },
      body: JSON.stringify(body),
    },
  );
  if (!init.ok) {
    console.error("YouTube upload-init error:", await init.text());
    throw new Error(`YouTube upload init failed (HTTP ${init.status})`);
  }
  const sessionUrl = init.headers.get("location");

  let uploaded = null;
  for (let attempt = 1; attempt <= 3 && !uploaded; attempt++) {
    const put = await fetch(sessionUrl, {
      method: "PUT",
      headers: { "Content-Type": "video/mp4", "Content-Length": String(size) },
      body: readFileSync(v.file),
    });
    const text = await put.text();
    if (put.ok) uploaded = JSON.parse(text);
    else {
      console.error(`[upload] attempt ${attempt} failed (HTTP ${put.status}):`, text.slice(0, 1000));
      if (put.status < 500) break;
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }
  if (!uploaded) throw new Error("YouTube upload failed");
  console.log(`[upload] ✅ https://youtube.com/shorts/${uploaded.id} — private until ${uploaded.status?.publishAt}`);
  results.push({ id: uploaded.id, title: body.snippet.title, publishAt: body.status.publishAt });
}

writeFileSync(path.join(OUT, "upload-result.json"), JSON.stringify(results, null, 2));
