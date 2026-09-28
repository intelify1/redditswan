import React from "react";

// Small Reddit-award-style icons drawn as SVG (no emoji font dependency → identical on every runner).
const Face: React.FC<{ mouth: "laugh" | "wow" | "smile" }> = ({ mouth }) => (
  <>
    <circle cx="12" cy="12" r="10" fill="#FFCC33" stroke="#E0A800" strokeWidth="1" />
    {mouth === "laugh" ? (
      <>
        <path d="M7 9.5q1.5-1.5 3 0M14 9.5q1.5-1.5 3 0" stroke="#5A3A00" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <path d="M6.5 13h11q-1 5-5.5 5t-5.5-5z" fill="#5A3A00" />
        <path d="M4.5 10.5q-1 2 .5 3.5M19.5 10.5q1 2-.5 3.5" stroke="#4FC3F7" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </>
    ) : mouth === "wow" ? (
      <>
        <circle cx="8.5" cy="9.5" r="1.4" fill="#5A3A00" />
        <circle cx="15.5" cy="9.5" r="1.4" fill="#5A3A00" />
        <ellipse cx="12" cy="15.5" rx="2.4" ry="3" fill="#5A3A00" />
      </>
    ) : (
      <>
        <circle cx="8.5" cy="9.5" r="1.4" fill="#5A3A00" />
        <circle cx="15.5" cy="9.5" r="1.4" fill="#5A3A00" />
        <path d="M7.5 14q4.5 4 9 0" stroke="#5A3A00" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </>
    )}
  </>
);

const icons: React.ReactNode[] = [
  // silver award
  <g key="a"><circle cx="12" cy="12" r="10" fill="#C9D3DC" stroke="#8C9BA8" /><path d="M12 5.5l1.9 4 4.3.4-3.3 2.9 1 4.2-3.9-2.3-3.9 2.3 1-4.2-3.3-2.9 4.3-.4z" fill="#fff" /></g>,
  <g key="b"><Face mouth="laugh" /></g>,
  // gold trophy
  <g key="c"><path d="M7 4h10v4a5 5 0 0 1-10 0z" fill="#FFB400" stroke="#C98A00" /><path d="M7 5H4q0 4 3.5 4.5M17 5h3q0 4-3.5 4.5" stroke="#C98A00" strokeWidth="1.4" fill="none" /><rect x="10.5" y="12.5" width="3" height="4" fill="#C98A00" /><rect x="7.5" y="16.5" width="9" height="3" rx="1" fill="#FFB400" stroke="#C98A00" /></g>,
  <g key="d"><Face mouth="wow" /></g>,
  // medal
  <g key="e"><path d="M8 2h3l1.5 6-3 .5zM16 2h-3l-1.5 6 3 .5z" fill="#E53935" /><circle cx="12" cy="14.5" r="6.5" fill="#FFC107" stroke="#C98A00" /><text x="12" y="17.5" fontSize="8" textAnchor="middle" fill="#8A5A00" fontWeight="700" fontFamily="Arimo">1</text></g>,
  // gem
  <g key="f"><path d="M6 4h12l4 5-10 12L2 9z" fill="#4FC3F7" stroke="#0288D1" /><path d="M2 9h20M9 4l3 5 3-5M12 9v12" stroke="#0288D1" strokeWidth="0.8" fill="none" /></g>,
  <g key="g"><Face mouth="smile" /></g>,
  // helpful hands
  <g key="h"><circle cx="12" cy="12" r="10" fill="#FF6B3D" /><path d="M7 13l3 3 7-8" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>,
  // coin
  <g key="i"><circle cx="12" cy="12" r="10" fill="#EDEFF1" stroke="#A5ABB0" /><text x="12" y="16" fontSize="11" textAnchor="middle" fill="#6E7479" fontWeight="700" fontFamily="Arimo">$</text></g>,
];

export const AwardRow: React.FC<{ size: number; gap: number }> = ({ size, gap }) => (
  <div style={{ display: "flex", alignItems: "center", gap }}>
    {icons.map((node, i) => (
      <svg key={i} width={size} height={size} viewBox="0 0 24 24">
        {node}
      </svg>
    ))}
  </div>
);
