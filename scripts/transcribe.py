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
import re
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out"
OUT.mkdir(parents=True, exist_ok=True)  # A4

MODEL = os.environ.get("WHISPER_MODEL") or "small.en"


def whisper_words(model, audio, prompt):
    segments, _ = model.transcribe(
        str(audio),
        language="en",
        word_timestamps=True,
        vad_filter=False,
        beam_size=5,
        initial_prompt=prompt,
        condition_on_previous_text=False,
    )
    words = []
    for seg in segments:
        for w in seg.words or []:
            t = w.word.strip()
            if t:
                words.append((t, w.start * 1000, w.end * 1000, float(w.probability)))
    return words


def good_coverage(words, script_words, story_ms):
    """Whisper can occasionally skip whole stretches of audio. Reject transcripts that don't
    cover the story from start to end."""
    if not words:
        return False, "no words"
    if len(words) < 0.8 * script_words:
        return False, f"only {len(words)}/{script_words} words"
    if words[0][1] > 800:
        return False, f"first word at {words[0][1]:.0f}ms"
    if story_ms and words[-1][2] < story_ms - 2500:
        return False, f"last word ends {words[-1][2]:.0f}ms of {story_ms}ms"
    gaps = [b[1] - a[2] for a, b in zip(words, words[1:])]
    if gaps and max(gaps) > 2500:
        return False, f"{max(gaps):.0f}ms hole in the middle"
    return True, "ok"


def main():
    audio = OUT / "story.mp3"
    offset_ms = 0
    prompt = None
    script_words = 0
    story_ms = 0
    if "--audio" in sys.argv:
        audio = Path(sys.argv[sys.argv.index("--audio") + 1])
    else:
        tts = json.loads((OUT / "tts.json").read_text())
        offset_ms = tts["storyOffsetMs"]
        story_ms = tts.get("storyMs", 0)
        story = json.loads((OUT / "content.json").read_text(encoding="utf-8"))["story"]
        script_words = len(story.split())
        prompt = " ".join(story.split()[:90])  # whisper prompt window is limited

    # PRIMARY: the voice engine's own word timings — exact words, exact timing, never skips.
    # FALLBACK: faster-whisper (with coverage check) if the boundaries are missing/incomplete.
    source = "edge-tts"
    backup = audio.with_suffix(".words.json")
    words = []
    if backup.exists():
        words = [(w["text"], w["startMs"], w["endMs"], 1.0) for w in json.loads(backup.read_text())]
    ok, why = good_coverage(words, script_words, story_ms) if script_words else (bool(words), "")
    if not ok:
        print(f"[transcribe] edge-tts timings unusable ({why}) — using faster-whisper", flush=True)
        source = "whisper"
        from faster_whisper import WhisperModel  # lazy: only loaded when needed
        model = WhisperModel(MODEL, device="cpu", compute_type="int8")
        words = whisper_words(model, audio, prompt)
        ok, why = good_coverage(words, script_words, story_ms)
        if not ok:
            print(f"[transcribe] whisper (prompted) rejected: {why} — retrying without prompt", flush=True)
            words = whisper_words(model, audio, None)
            ok, why = good_coverage(words, script_words, story_ms)
        if not ok:
            raise SystemExit(f"[transcribe] no usable word timings: {why}")

    # Glue split tokens back together so "$5" + ",000" shows as one caption "$5,000".
    merged = []
    for t in words:
        text = t[0]
        if merged and (re.match(r"^[,.%!?;:'’)\]]", text) or re.match(r"^\d", text) and re.search(r"[$£€,.]$", merged[-1][0])):
            p0 = merged[-1]
            merged[-1] = (p0[0] + text, p0[1], t[2], min(p0[3], t[3]))
        else:
            merged.append(t)
    words = merged

    captions = []
    for text, start, end, prob in words:
        start = int(round(start)) + offset_ms
        end = int(round(end)) + offset_ms
        if end <= start:
            end = start + 80
        captions.append({
            "text": (" " if captions else "") + text,
            "startMs": start,
            "endMs": end,
            "timestampMs": (start + end) // 2,
            "confidence": round(prob, 3),
        })

    # Monotonic, non-overlapping, and every word at least 60 ms long.
    for i in range(1, len(captions)):
        if captions[i]["startMs"] < captions[i - 1]["startMs"] + 60:
            captions[i]["startMs"] = captions[i - 1]["startMs"] + 60
        if captions[i - 1]["endMs"] > captions[i]["startMs"]:
            captions[i - 1]["endMs"] = captions[i]["startMs"]
        if captions[i]["endMs"] <= captions[i]["startMs"]:
            captions[i]["endMs"] = captions[i]["startMs"] + 60

    if len(captions) < 20:
        raise SystemExit(f"[transcribe] only {len(captions)} words — something is wrong with the audio")
    (OUT / "captions.json").write_text(json.dumps(captions, indent=1))
    print(f"[transcribe] {source} ({MODEL}): {len(captions)} words, first @{captions[0]['startMs']}ms, "
          f"last ends @{captions[-1]['endMs']}ms", flush=True)


if __name__ == "__main__":
    main()
