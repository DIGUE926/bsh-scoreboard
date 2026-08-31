"use client";

export type ShotPoint = {
  x: number;
  y: number;
  made: boolean;
  event_type: "2PT" | "3PT" | "FT" | "REB" | "AST";
};

// Demi-terrain dessiné en pourcentage (0-100) sur les deux axes, mais un
// demi-terrain réel n'est PAS carré : ~15m (50ft) de large pour ~14m (47ft)
// de la ligne de fond à la ligne médiane. On garde deux échelles distinctes
// (%/pied) pour que chaque élément soit à la bonne proportion, et une
// échelle moyenne uniquement pour les rayons des cercles/arcs (sinon ils
// deviendraient des ellipses) -- léger compromis visuel, sans impact sur le
// stockage des tirs qui reste en % 0-100 sur les deux axes (inchangé).
const SCALE_X = 100 / 50; // % par pied, largeur du terrain (15m/50ft)
const SCALE_Y = 100 / 47; // % par pied, ligne de fond → ligne médiane (14.3m/47ft)
const SCALE_AVG = (SCALE_X + SCALE_Y) / 2;

const HOOP = { x: 50, y: 5.25 * SCALE_Y }; // panier ≈ 1.6m de la ligne de fond
const THREE_PT_RADIUS_FT = 22.5; // ~milieu FIBA (6.75m) / NBA (7.24m)
const CORNER_X = 3 * SCALE_X; // ligne à 3pts, portion droite dans le corner
const CORNER_STRAIGHT_FT = 14; // longueur de la portion droite avant l'arc

export function guessShotType(x: number, y: number): "2PT" | "3PT" {
  const dxFt = (x - HOOP.x) / SCALE_X;
  const dyFt = (y - HOOP.y) / SCALE_Y;
  const distFt = Math.hypot(dxFt, dyFt);
  const inCornerLane = y / SCALE_Y < CORNER_STRAIGHT_FT && (x < CORNER_X || x > 100 - CORNER_X);
  if (inCornerLane) return "3PT";
  return distFt > THREE_PT_RADIUS_FT ? "3PT" : "2PT";
}

// Coordonnées SVG dérivées des mêmes échelles (voir plus haut) -- tout est
// calculé une fois ici plutôt qu'en dur, pour rester cohérent avec
// guessShotType si les échelles changent un jour.
const KEY_HALF_WIDTH = 8 * SCALE_X; // raquette 16ft de large
const KEY_LENGTH = 19 * SCALE_Y; // ligne de fond → ligne de lancer-franc
const FT_CIRCLE_R = 6 * SCALE_AVG;
const RESTRICTED_R = 4 * SCALE_AVG;
const BACKBOARD_Y = 4 * SCALE_Y;
const BACKBOARD_HALF_WIDTH = 3 * SCALE_X;
const THREE_PT_R = THREE_PT_RADIUS_FT * SCALE_AVG;
const CORNER_Y = HOOP.y + Math.sqrt(THREE_PT_R * THREE_PT_R - (50 - CORNER_X) * (50 - CORNER_X));
const CENTER_CIRCLE_R = 6 * SCALE_AVG;

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

  const line = "rgba(255,255,255,0.28)";
  const lineFaint = "rgba(255,255,255,0.15)";

  return (
    <svg
      viewBox="0 0 100 100"
      onClick={handleClick}
      className={`w-full bg-bsh-black border border-white/10 rounded-lg ${
        onCourtClick ? "cursor-crosshair" : ""
      } ${className}`}
    >
      {/* Contour du terrain */}
      <rect x="1" y="1" width="98" height="98" fill="none" stroke={lineFaint} strokeWidth="0.5" />

      {/* Cercle central, juste esquissé sur la ligne médiane */}
      <path
        d={`M ${50 - CENTER_CIRCLE_R} 99 A ${CENTER_CIRCLE_R} ${CENTER_CIRCLE_R} 0 0 1 ${50 + CENTER_CIRCLE_R} 99`}
        fill="none"
        stroke={lineFaint}
        strokeWidth="0.5"
      />

      {/* Raquette */}
      <rect
        x={50 - KEY_HALF_WIDTH}
        y="0"
        width={KEY_HALF_WIDTH * 2}
        height={KEY_LENGTH}
        fill="none"
        stroke={line}
        strokeWidth="0.5"
      />

      {/* Cercle de lancer-franc */}
      <circle cx="50" cy={KEY_LENGTH} r={FT_CIRCLE_R} fill="none" stroke={line} strokeWidth="0.5" />

      {/* Zone restrictive (sous le panier) */}
      <path
        d={`M ${50 - RESTRICTED_R} ${HOOP.y} A ${RESTRICTED_R} ${RESTRICTED_R} 0 0 0 ${50 + RESTRICTED_R} ${HOOP.y}`}
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="0.5"
      />

      {/* Planche */}
      <line
        x1={50 - BACKBOARD_HALF_WIDTH}
        y1={BACKBOARD_Y}
        x2={50 + BACKBOARD_HALF_WIDTH}
        y2={BACKBOARD_Y}
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="0.9"
      />

      {/* Panier */}
      <circle cx={HOOP.x} cy={HOOP.y} r="1.4" fill="none" stroke="#FF6B00" strokeWidth="0.7" />

      {/* Ligne à 3 points : portions droites dans les corners + arc */}
      <line x1={CORNER_X} y1="0" x2={CORNER_X} y2={CORNER_Y} stroke={line} strokeWidth="0.5" />
      <line
        x1={100 - CORNER_X}
        y1="0"
        x2={100 - CORNER_X}
        y2={CORNER_Y}
        stroke={line}
        strokeWidth="0.5"
      />
      <path
        d={`M ${CORNER_X} ${CORNER_Y} A ${THREE_PT_R} ${THREE_PT_R} 0 0 0 ${100 - CORNER_X} ${CORNER_Y}`}
        fill="none"
        stroke={line}
        strokeWidth="0.5"
      />

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
