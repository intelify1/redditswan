import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useVideoConfig } from "remotion";
import { Captions } from "./Captions";
import { HookCard } from "./HookCard";
import type { StoryProps } from "./types";
import "./fonts";

export const RedditStory: React.FC<StoryProps> = (p) => {
  const { fps, durationInFrames } = useVideoConfig();
  const hookEndFrame = Math.max(1, Math.round((p.hookEndMs / 1000) * fps));

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Background footage: pre-trimmed, pre-sped-up and muted by ffmpeg in footage.mjs */}
      <OffthreadVideo
        src={staticFile(p.bgSrc)}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />

      {/* Narration */}
      <Audio src={staticFile(p.voiceSrc)} />

      {/* Whoosh, low volume, timed with the hook card */}
      {p.sfxSrc ? <Audio src={staticFile(p.sfxSrc)} volume={0.35} /> : null}

      {/* Hook card — HARD CUT (no fade/slide) the instant the hook line ends */}
      <Sequence from={0} durationInFrames={hookEndFrame} layout="none">
        <HookCard
          username={p.username}
          hook={p.hook}
          upvotes={p.upvotes}
          comments={p.comments}
          avatarSrc={p.avatarSrc}
        />
      </Sequence>

      {/* Story captions start at the cut */}
      <Sequence from={hookEndFrame} durationInFrames={Math.max(1, durationInFrames - hookEndFrame)}>
        <Captions captions={p.captions} offsetMs={(hookEndFrame / fps) * 1000} />
      </Sequence>
    </AbsoluteFill>
  );
};
