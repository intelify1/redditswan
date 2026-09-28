#!/usr/bin/env bash
# Creates fixed, deterministic test assets for Phase 2 de-risking (fake data, no network).
#   public/test/bg.mp4    — synthetic 1080x1920 background
#   public/test/voice.mp3 — placeholder audio track (tone bed) of fixture length
# Also creates a synthesized placeholder whoosh if no real one has been supplied.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/test public/assets

ffmpeg -y -loglevel error -f lavfi -i "testsrc2=size=1080x1920:rate=30:duration=20" \
  -vf "hue=s=0.4" -c:v libx264 -preset veryfast -pix_fmt yuv420p public/test/bg.mp4

ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=220:duration=18" \
  -af "volume=0.05" -c:a libmp3lame -b:a 128k public/test/voice.mp3

if [ ! -f public/assets/whoosh.mp3 ]; then
  # Placeholder whoosh: filtered pink noise with a fast swell and decay.
  ffmpeg -y -loglevel error -f lavfi -i "anoisesrc=d=0.8:c=pink:a=0.9" \
    -af "highpass=f=400,lowpass=f=4500,flanger=delay=6:depth=8:speed=2,afade=t=in:st=0:d=0.28:curve=exp,afade=t=out:st=0.3:d=0.5:curve=qsin,volume=1.6" \
    -c:a libmp3lame -b:a 160k public/assets/whoosh.mp3
fi
echo "test assets ready"
