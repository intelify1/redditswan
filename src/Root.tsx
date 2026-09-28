import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { RedditStory } from "./RedditStory";
import { FPS, HEIGHT, TAIL_FRAMES, WIDTH, type StoryProps } from "./types";
import { fakeProps } from "./fixtures";

const calculateMetadata: CalculateMetadataFunction<StoryProps> = ({ props }) => ({
  durationInFrames: Math.ceil((props.durationMs / 1000) * FPS) + TAIL_FRAMES,
});

export const RemotionRoot: React.FC = () => (
  <Composition
    id="RedditStory"
    component={RedditStory}
    width={WIDTH}
    height={HEIGHT}
    fps={FPS}
    durationInFrames={FPS * 60}
    defaultProps={fakeProps}
    calculateMetadata={calculateMetadata}
  />
);
