"""Phase 1 — edge-tts narration.

Hook and story are synthesized as two separate clips and joined with a short gap. That makes the
hook-card hard cut exact: it happens the instant the hook clip ends (hookEndMs), independent of any
transcription quirks. faster-whisper then supplies word timings for the story captions.

Outputs:
  public/run/voice.mp3   full narration
  out/story.mp3          story-only clip (for transcription)
  out/tts.json           {hookEndMs, storyOffsetMs, durationMs, voice, rate}

Usage:
  python scripts/tts.py                       -> uses out/content.json
  python scripts/tts.py --samples             -> voice listening test (out/samples/*.mp3)
"""
import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out"
RUN = ROOT / "public" / "run"
OUT.mkdir(parents=True, exist_ok=True)  # A4
RUN.mkdir(parents=True, exist_ok=True)

VOICE = os.environ.get("TTS_VOICE") or "en-US-AndrewNeural"
RATE = os.environ.get("TTS_RATE") or "+8%"
TARGET_MIN_MS, TARGET_MAX_MS = 45000, 55000  # user target: 45-55 s videos
RATE_MIN, RATE_MAX = 0, 22  # never slow below natural, never chipmunk
GAP_MS = 250  # breath between hook and story


async def synth(text: str, dest: Path, voice: str = VOICE, rate: str = RATE, retries: int = 4):
    last = None
    for attempt in range(1, retries + 1):
        try:
            await edge_tts.Communicate(text, voice, rate=rate).save(str(dest))
            if dest.exists() and dest.stat().st_size > 1000:
                return
            raise RuntimeError("edge-tts produced an empty file")
        except Exception as e:  # network hiccups happen; retry
            last = e
            print(f"[tts] attempt {attempt} failed: {e}", flush=True)
            await asyncio.sleep(3 * attempt)
    raise RuntimeError(f"edge-tts failed after {retries} attempts: {last}")


def duration_ms(p: Path) -> int:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)]
    )
    return int(round(float(out.strip()) * 1000))


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


async def build(content, rate: str):
    hook_mp3 = OUT / "hook.mp3"
    story_mp3 = OUT / "story.mp3"
    await synth(content["hook"], hook_mp3, rate=rate)
    await synth(content["story"], story_mp3, rate=rate)

    # Normalise to WAV; trim the hook's trailing silence so the hard cut lands right on the last word.
    hook_wav, story_wav, gap_wav = OUT / "hook.wav", OUT / "story.wav", OUT / "gap.wav"
    run(["ffmpeg", "-y", "-i", str(hook_mp3), "-af",
         "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse",
         "-ar", "48000", "-ac", "1", str(hook_wav)])
    run(["ffmpeg", "-y", "-i", str(story_mp3), "-ar", "48000", "-ac", "1", str(story_wav)])
    run(["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", f"{GAP_MS/1000}", str(gap_wav)])

    hook_ms = duration_ms(hook_wav)
    voice = RUN / "voice.mp3"
    run(["ffmpeg", "-y", "-i", str(hook_wav), "-i", str(gap_wav), "-i", str(story_wav),
         "-filter_complex", "[0:a][1:a][2:a]concat=n=3:v=0:a=1[a]", "-map", "[a]",
         "-c:a", "libmp3lame", "-b:a", "192k", str(voice)])
    return {
        "hookEndMs": hook_ms,
        "storyOffsetMs": hook_ms + GAP_MS,
        "durationMs": duration_ms(voice),
        "voice": VOICE,
        "rate": rate,
    }


def pct(rate: str) -> int:
    return int(rate.replace("%", ""))


async def main_story():
    content = json.loads((OUT / "content.json").read_text(encoding="utf-8"))
    meta = await build(content, RATE)
    d = meta["durationMs"]
    if not (TARGET_MIN_MS <= d <= TARGET_MAX_MS):
        # Fit into 45-55 s by nudging the speaking rate (aim for the middle, 50 s).
        speed = 1 + pct(RATE) / 100
        new_pct = round((speed * d / 50000 - 1) * 100)
        new_pct = max(RATE_MIN, min(RATE_MAX, new_pct))
        if new_pct != pct(RATE):
            new_rate = f"{new_pct:+d}%"
            print(f"[tts] {d/1000:.1f}s is outside 45-55s, re-voicing at {new_rate}", flush=True)
            meta = await build(content, new_rate)
    (OUT / "tts.json").write_text(json.dumps(meta, indent=2))
    print(f"[tts] {VOICE} {meta['rate']}: hook {meta['hookEndMs']}ms, total {meta['durationMs']/1000:.1f}s", flush=True)


SAMPLE_TEXT = (
    "Poor people who dated somebody rich, what did you learn? "
    "I dated a guy named Marcus for eight months before I found out his family owned half the marinas "
    "on Lake Tahoe. He drove a 2009 Corolla. He split every bill down to the cent. "
    "Then on our anniversary, he handed me a key and said, it's not a gift, it's a test."
)


async def main_samples():
    dest = OUT / "samples"
    dest.mkdir(parents=True, exist_ok=True)
    voices = ["en-US-AndrewNeural", "en-US-ChristopherNeural", "en-US-BrianNeural", "en-US-GuyNeural"]
    for v in voices:
        for rate in ["+8%"]:
            p = dest / f"{v.replace('en-US-', '').replace('Neural', '')}_{rate.replace('+', 'plus').replace('%', 'pct')}.mp3"
            await synth(SAMPLE_TEXT, p, voice=v, rate=rate)
            print(f"[tts] sample {p.name} {duration_ms(p)/1000:.1f}s", flush=True)


if __name__ == "__main__":
    asyncio.run(main_samples() if "--samples" in sys.argv else main_story())
