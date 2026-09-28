# RedditSwan

Fully automated Reddit-story YouTube Shorts: **15 videos/day**, one per external trigger.

```
cron-job.org (15 slots, PKT) ──POST──▶ GitHub Actions: .github/workflows/redditswan.yml
   1. scripts/generate.mjs   Groq → hook, story, title, hashtags   (state/history.json avoids repeats)
   2. scripts/tts.py         edge-tts → public/run/voice.mp3        (auto-fits 45–55 s)
   3. scripts/transcribe.py  faster-whisper → word timestamps
   4. scripts/footage.mjs    random Drive clip → muted, sped-up public/run/bg.mp4   (BEFORE bundle)
   5. scripts/render.mjs     prepare → bundle() → render → out/video-1.mp4
   6. scripts/upload.mjs     YouTube private + publishAt = upload + 60 min
   7. commit state/history.json
```

## GitHub Secrets (Settings → Secrets and variables → Actions)
| Secret | What |
|---|---|
| `GROQ_API_KEY` | console.groq.com/keys |
| `DRIVE_API_KEY` | Google Cloud → Credentials → API key (Drive API enabled) |
| `DRIVE_FOLDER_ID` | the footage folder ID (folder shared "Anyone with the link") |
| `YT_CLIENT_ID` / `YT_CLIENT_SECRET` | from client_secret.json (Desktop-app OAuth client) |
| `YT_REFRESH_TOKEN` | printed by `node scripts/auth.mjs` (run once, locally, AFTER publishing the consent screen to Production) |

Optional repository **variables**: `TTS_VOICE` (default `en-US-AndrewNeural`), `GROQ_MODEL` (default `openai/gpt-oss-120b`).

## cron-job.org (one job per slot)
- URL: `https://api.github.com/repos/intelify1/redditswan/actions/workflows/redditswan.yml/dispatches`
- Method `POST`, body `{"ref":"main"}`
- Headers: `Authorization: Bearer <fine-grained PAT, Actions: read & write>`, `Accept: application/vnd.github+json`
- Timezone `Asia/Karachi`. Slots (upload → public 1 h later):
  9:30, 10:45, 12:00, 13:15, 14:30, 15:45, 17:00, 18:15, 19:30, 20:45, 22:00, 23:15, 00:30, 01:45, 03:00

## Local commands
```
npm install
npm run studio                    # preview the composition with fake timestamps
node scripts/render.mjs --fixture # render the fake-timestamp fixture
node scripts/auth.mjs             # one-time YouTube authorization (needs client_secret.json)
```

## Pitfalls already handled (Build Brief Part A)
A1 workflow_dispatch only · A2 OAuth must be Production before auth.mjs · A3 download before bundle ·
A4 out/ created in code · A5 env-first credentials · A6 filesystem video detection · A7 one trigger = one video ·
A8 state commit + RW permission · A9 lockfile deleted in CI · A10 Groq model verified + loud errors ·
A12 footage never committed (Drive only).
