// Ctrl • Alt • Del brand mark — a clean, flat SVG recreation of the keycap logo.
// Vector so it scales crisply everywhere and stays transparent on any background.

const KEYS = [
  { label: 'C', full: 'CTRL', face: '#A7D3F3', side: '#7CB2E2' },
  { label: 'A', full: 'ALT',  face: '#F0726E', side: '#D9564F' },
  { label: 'D', full: 'DEL',  face: '#B7DE8F', side: '#96C567' },
];

const NAVY = '#1E2A44';

interface LogoProps {
  /** 'mark' = 3 compact keycaps (C A D). 'full' = keycaps with CTRL/ALT/DEL labels. */
  variant?: 'mark' | 'full';
  className?: string;
  title?: string;
}

export default function Logo({ variant = 'mark', className, title = 'Ctrl Alt Del' }: LogoProps) {
  const full = variant === 'full';
  const keyW = full ? 52 : 40;
  const keyH = 44;
  const gap = full ? 8 : 6;
  const totalW = KEYS.length * keyW + (KEYS.length - 1) * gap;

  return (
    <svg
      viewBox={`0 0 ${totalW} ${keyH + 4}`}
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      {KEYS.map((k, i) => {
        const x = i * (keyW + gap);
        return (
          <g key={k.label}>
            {/* keycap side / depth */}
            <rect x={x} y={4} width={keyW} height={keyH} rx={10} fill={k.side} />
            {/* keycap top face */}
            <rect x={x} y={0} width={keyW} height={keyH} rx={10} fill={k.face} />
            {/* white sticker outline */}
            <rect
              x={x + 4} y={4} width={keyW - 8} height={keyH - 8}
              rx={7} fill="none" stroke="#FFFFFF" strokeWidth={2} strokeOpacity={0.9}
            />
            {/* label */}
            <text
              x={x + keyW / 2}
              y={keyH / 2 + 1}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="'Plus Jakarta Sans', 'Inter', system-ui, sans-serif"
              fontWeight={800}
              fontSize={full ? 13 : 20}
              letterSpacing={full ? 0.5 : 0}
              fill={NAVY}
            >
              {full ? k.full : k.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
