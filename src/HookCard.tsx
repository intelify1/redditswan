import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { CARD_FONT } from "./fonts";
import { AwardRow } from "./Awards";

// Matches the user's reference screenshot: compact white card, ~75% frame width, centred,
// small rounded corners, avatar + bold name + blue check, award/emoji row, big bold post text,
// engagement row with counts on the left and "Share" on the right.
// FIXED every video: layout, size, position, colors, border, icons, font, avatar, channel name.
// DYNAMIC every video: hook text (+ engagement numbers if provided).

const S = (1080 / 480) * 1.1; // reference measured on a ~480px player; +10% bigger per user feedback

const VerifiedBadge: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
    <path
      fill="#1D9BF0"
      d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.670 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.910 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"
    />
    <path fill="#fff" d="M10.54 16.2l-3.74-3.74 1.41-1.41 2.33 2.33 5.26-5.26 1.41 1.41z" />
  </svg>
);

// Reddit-style upvote arrow (spec §4: "real Reddit-style icons, not generic hearts")
const UpvoteIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 20 20">
    <path
      fill="none"
      stroke="#878A8C"
      strokeWidth={1.6}
      strokeLinejoin="round"
      d="M10 2.6 3 10h4.2v7.2h5.6V10H17z"
    />
  </svg>
);

const CommentIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 20 20">
    <path
      fill="none"
      stroke="#878A8C"
      strokeWidth={1.6}
      strokeLinejoin="round"
      d="M10 3c-4.2 0-7.4 2.8-7.4 6.3 0 1.8.8 3.3 2.1 4.5l-.6 3.2 3.4-1.6c.8.2 1.6.3 2.5.3 4.2 0 7.4-2.8 7.4-6.4S14.2 3 10 3z"
    />
  </svg>
);

const ShareIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 20 20">
    <g fill="none" stroke="#878A8C" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 12.5V3M6.5 6.3 10 2.8l3.5 3.5" />
      <path d="M4.5 10v6.2h11V10" />
    </g>
  </svg>
);

export const HookCard: React.FC<{
  username: string;
  hook: string;
  upvotes: string;
  comments: string;
  avatarSrc: string;
}> = ({ username, hook, upvotes, comments, avatarSrc }) => {
  const frame = useCurrentFrame();

  // SNAP pop-in: fully on screen within 3 frames (0.1 s) with a tiny overshoot, synced with the whoosh.
  // Exit is a HARD CUT (parent Sequence ends) — no fade.
  const scale = interpolate(frame, [0, 1, 2, 3, 4], [0.72, 0.97, 1.05, 1.0, 1.0], {
    extrapolateRight: "clamp",
  });

  // Long hooks shrink a touch so the card never gets too tall.
  const hookFont = hook.length > 120 ? 16 : hook.length > 80 ? 17 : 18.5;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 300, // sits a little below centre
      }}
    >
      <div
        style={{
          width: 362 * S,
          background: "#FFFFFF",
          borderRadius: 7 * S,
          border: `${1 * S}px solid #D9DCDF`,
          boxShadow: "0 10px 34px rgba(0,0,0,0.30)",
          padding: `${5 * S}px ${6 * S}px ${6 * S}px`,
          fontFamily: CARD_FONT,
          transform: `scale(${scale})`,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 * S }}>
          <Img
            src={staticFile(avatarSrc)}
            style={{
              width: 50 * S,
              height: 50 * S,
              borderRadius: "50%",
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 * S }}>
            <div style={{ display: "flex", alignItems: "center", gap: 3 * S }}>
              <span style={{ fontSize: 13.5 * S, fontWeight: 700, color: "#1A1A1B" }}>
                {username}
              </span>
              <VerifiedBadge size={14 * S} />
            </div>
            <AwardRow size={11.5 * S} gap={1.5 * S} />
          </div>
        </div>

        {/* Post body = the hook */}
        <div
          style={{
            marginTop: 5 * S,
            fontSize: hookFont * S,
            lineHeight: 1.08,
            fontWeight: 700,
            color: "#000000",
          }}
        >
          {hook}
        </div>

        {/* Engagement row */}
        <div
          style={{
            marginTop: 6 * S,
            display: "flex",
            alignItems: "center",
            fontSize: 11.5 * S,
            color: "#878A8C",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 3 * S }}>
            <UpvoteIcon size={15 * S} />
            <span>{upvotes}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 3 * S, marginLeft: 10 * S }}>
            <CommentIcon size={15 * S} />
            <span>{comments}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 2 * S, marginLeft: "auto" }}>
            <ShareIcon size={13 * S} />
            <span style={{ fontSize: 9.5 * S }}>Share</span>
          </div>
        </div>
      </div>
    </div>
  );
};
