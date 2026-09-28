"""Phase 2 — faster-whisper word-level timestamps for the story captions.

Transcribes out/story.mp3 (the ACTUAL generated audio, so timing never drifts from the voice),
offsets every word by storyOffsetMs, and writes out/captions.json in @remotion/captions' Caption shape:
  [{text, startMs, endMs, timestampMs, confidence}]
The original script is passed as initial_prompt so names/numbers are spelled the way the story wrote them.

Usage:
  python scripts/transcribe.py                      -> real run (out/story.mp3 + out/tts.json)
  python scripts/transcribe.py --audio FILE         -> test against one fixed saved audio file (de-risking step 3)
"""
import json
import os
import sys
from pathlib import Path

from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out"
OUT.mkdir(parents=True, exist_ok=True)  # A4

MODEL = os.environ.get("WHISPER_MODEL") or "small.en"


def main():
    audio = OUT / "story.mp3"
    offset_ms = 0
    prompt = None
    if "--audio" in sys.argv:
        audio = Path(sys.argv[sys.argv.index("--audio") + 1])
    else:
        offset_ms = json.loads((OUT / "tts.json").read_text())["storyOffsetMs"]
        story = json.loads((OUT / "content.json").read_text(encoding="utf-8"))["story"]
        prompt = " ".join(story.split()[:90])  # whisper prompt window is limited

    model = WhisperModel(MODEL, device="cpu", compute_type="int8")
    segments, _ = model.transcribe(
        str(audio),
        language="en",
        word_timestamps=True,
        vad_filter=False,
        beam_size=5,
        initial_prompt=prompt,
        condition_on_previous_text=False,
    )

    captions = []
    for seg in segments:
        for w in seg.words or []:
            text = w.word.strip()
            if not text:
                continue
            start = int(round(w.start * 1000)) + offset_ms
            end = int(round(w.end * 1000)) + offset_ms
            if end <= start:
                end = start + 80
            captions.append({
                "text": (" " if captions else "") + text,
                "startMs": start,
                "endMs": end,
                "timestampMs": (start + end) // 2,
                "confidence": round(float(w.probability), 3),
            })

    # Guarantee monotonic, non-overlapping timings for the caption renderer.
    for i in range(1, len(captions)):
        if captions[i]["startMs"] < captions[i - 1]["endMs"]:
            captions[i - 1]["endMs"] = captions[i]["startMs"]

    if len(captions) < 20:
        raise SystemExit(f"[transcribe] only {len(captions)} words transcribed — something is wrong with the audio")
    (OUT / "captions.json").write_text(json.dumps(captions, indent=1))
    print(f"[transcribe] {MODEL}: {len(captions)} words, first @{captions[0]['startMs']}ms, "
          f"last ends @{captions[-1]['endMs']}ms", flush=True)


if __name__ == "__main__":
    main()
