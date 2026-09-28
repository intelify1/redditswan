import React, { useMemo } from "react";
import { createTikTokStyleCaptions, type Caption, type TikTokPage } from "@remotion/captions";
import { AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CAPTION_FONT } from "./fonts";

// How close together words must be to share one on-screen "page" (multi-word highlight style).
const COMBINE_MS = 800;
const HIGHLIGHT = "#FFD60A";

const Page: React.FC<{ page: TikTokPage }> = ({ page }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowMs = page.startMs + (frame / fps) * 1000;

  const pop = spring({ frame, fps, config: { damping: 12, stiffness: 260, mass: 0.5 } });
  const scale = 0.8 + 0.2 * pop;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 70px" }}>
      <div
        style={{
          fontFamily: CAPTION_FONT,
          fontWeight: 900,
          fontSize: 104,
          lineHeight: 1.12,
          textAlign: "center",
          textTransform: "uppercase",
          transform: `scale(${scale})`,
          whiteSpace: "pre-wrap",
          WebkitTextStroke: "14px #000",
          paintOrder: "stroke fill",
          textShadow: "0 8px 22px rgba(0,0,0,0.55)",
        }}
      >
        {page.tokens.map((t) => {
          const active = t.fromMs <= nowMs && t.toMs > nowMs;
          return (
            <span key={t.fromMs} style={{ color: active ? HIGHLIGHT : "#FFFFFF" }}>
              {t.text}
            </span>
          );
        })}
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
        const startFrame = Math.round(((page.startMs - offsetMs) / 1000) * fps);
        const endMs = next ? next.startMs : page.startMs + page.durationMs + 400;
        const dur = Math.max(1, Math.round(((endMs - page.startMs) / 1000) * fps));
        return (
          <Sequence key={i} from={startFrame} durationInFrames={dur} layout="none">
            <Page page={page} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
