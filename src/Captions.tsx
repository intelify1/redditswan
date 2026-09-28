import React, { useMemo } from "react";
import { createTikTokStyleCaptions, type Caption, type TikTokPage } from "@remotion/captions";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { CAPTION_FONT } from "./fonts";

// ONE WORD AT A TIME (user feedback): white bold text, heavy black stroke, small pop per word.
// combineTokensWithinMilliseconds = -1 → every word is its own page, even zero-length words.
const COMBINE_MS = -1;

const Word: React.FC<{ page: TikTokPage }> = ({ page }) => {
  const frame = useCurrentFrame();
  // Snap pop: full size within 2 frames with a tiny overshoot.
  const scale = interpolate(frame, [0, 1, 2, 3], [0.7, 1.08, 1.0, 1.0], { extrapolateRight: "clamp" });
  const text = page.text.trim();
  const fontSize = text.length > 12 ? 76 : text.length > 9 ? 86 : 96;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "320px 60px 0" }}>
      <div
        style={{
          fontFamily: CAPTION_FONT,
          fontWeight: 900,
          fontSize,
          lineHeight: 1,
          textAlign: "center",
          textTransform: "uppercase",
          color: "#FFFFFF",
          transform: `scale(${scale})`,
          WebkitTextStroke: "16px #000",
          paintOrder: "stroke fill",
          textShadow: "0 5px 0 #000, 0 8px 18px rgba(0,0,0,0.6)",
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

// `captions` are absolute to the whole video; `offsetMs` is where this component's Sequence starts.
export const Captions: React.FC<{ captions: Caption[]; offsetMs: number }> = ({
  captions,
  offsetMs,
}) => {
  const { fps } = useVideoConfig();
  const pages = useMemo(
    () =>
      createTikTokStyleCaptions({
        captions,
        combineTokensWithinMilliseconds: COMBINE_MS,
      }).pages,
    [captions],
  );

  return (
    <AbsoluteFill>
      {pages.map((page, i) => {
        const next = pages[i + 1];
        // Each word stays on screen until the next one starts (no flicker in short pauses).
        const endMs = next ? next.startMs : page.startMs + page.durationMs + 400;
        const startFrame = Math.max(0, Math.round(((page.startMs - offsetMs) / 1000) * fps));
        const endFrame = Math.round(((endMs - offsetMs) / 1000) * fps);
        const dur = Math.max(1, endFrame - startFrame);
        return (
          <Sequence key={i} from={startFrame} durationInFrames={dur} layout="none">
            <Word page={page} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
