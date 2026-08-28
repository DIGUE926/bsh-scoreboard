"use client";

export type ShotPoint = {
  x: number;
  y: number;
  made: boolean;
  event_type: "2PT" | "3PT" | "FT" | "REB" | "AST";
};

const HOOP = { x: 50, y: 7 };

export function guessShotType(x: number, y: number): "2PT" | "3PT" {
  const dist = Math.hypot(x - HOOP.x, y - HOOP.y);
  const inCornerLane = y < 14 && (x < 8 || x > 92);
  if (inCornerLane) return "3PT";
  return dist > 38 ? "3PT" : "2PT";
}

export default function CourtDiagram({
  shots = [],
  onCourtClick,
  className = "",
}: {
  shots?: ShotPoint[];
  onCourtClick?: (x: number, y: number) => void;
  className?: string;
}) {
  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!onCourtClick) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onCourtClick(Math.min(100, Math.max(0, x)), Math.min(100, Math.max(0, y)));
  }

  return (
    <svg
      viewBox="0 0 100 100"
      onClick={handleClick}
      className={`w-full bg-bsh-black border border-white/10 rounded-lg ${
        onCourtClick ? "cursor-crosshair" : ""
      } ${className}`}
    >
      {/* Court outline */}
      <rect x="1" y="1" width="98" height="98" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
      {/* Key / paint */}
      <rect x="35" y="0" width="30" height="19" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" />
      {/* Free throw circle */}
      <circle cx="50" cy="19" r="9" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" />
      {/* Restricted area */}
      <path d="M 44 7 A 6 6 0 0 0 56 7" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
      {/* Backboard */}
      <line x1="44" y1="4" x2="56" y2="4" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />
      {/* Hoop */}
      <circle cx={HOOP.x} cy={HOOP.y} r="1.3" fill="none" stroke="#FF6B00" strokeWidth="0.6" />
      {/* 3PT line: corner straights + arc */}
      <line x1="4" y1="0" x2="4" y2="14" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" />
      <line x1="96" y1="0" x2="96" y2="14" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" />
      <path
        d="M 4 14 A 40 40 0 0 0 96 14"
        fill="none"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="0.5"
      />
      {/* Half-court line */}
      <line x1="1" y1="99" x2="99" y2="99" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />

      {shots
        .filter((s) => s.x != null && s.y != null)
        .map((s, i) => (
        <g key={i}>
          {s.made ? (
            <circle cx={s.x} cy={s.y} r="1.6" fill="#22c55e" stroke="#0D0D0D" strokeWidth="0.3" />
          ) : (
            <g stroke="#ef4444" strokeWidth="0.7" strokeLinecap="round">
              <line x1={s.x - 1.4} y1={s.y - 1.4} x2={s.x + 1.4} y2={s.y + 1.4} />
              <line x1={s.x - 1.4} y1={s.y + 1.4} x2={s.x + 1.4} y2={s.y - 1.4} />
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}
