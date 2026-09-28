import React, { useMemo } from "react";
import { createTikTokStyleCaptions, type Caption, type TikTokPage } from "@remotion/captions";
import { AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CAPTION_FONT } from "./fonts";

// ONE WORD AT A TIME (user feedback): white bold text, heavy black stroke, small pop per word.
// combineTokensWithinMilliseconds = 0 → every whisper word becomes its own caption page.
const COMBINE_MS = 0;

const Word: React.FC<{ page: TikTokPage }> = ({ page }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12, stiffness: 420, mass: 0.35 } });
  const scale = 0.82 + 0.18 * pop;
  const text = page.text.trim();
  const fontSize = text.length > 11 ? 112 : text.length > 8 ? 128 : 142;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 60px" }}>
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
          WebkitTextStroke: "22px #000",
          paintOrder: "stroke fill",
          textShadow: "0 6px 0 #000, 0 10px 24px rgba(0,0,0,0.6)",
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
