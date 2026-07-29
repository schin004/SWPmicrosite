// Reusable botanical SVG motifs for the green & nature theme.

export function Leaf({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 64 64" className={className} style={style} aria-hidden="true">
      <path
        d="M56 8C24 8 8 26 8 52c0 2 1 4 4 4 26 0 44-16 44-48z"
        fill="currentColor"
      />
      <path
        d="M14 50C26 38 40 24 52 12"
        fill="none"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// A decorative row of trees / foliage used along the bottom of headers.
export function FoliageBand({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 1200 80" preserveAspectRatio="none" className={className} aria-hidden="true">
      <path d="M0 80 V50 Q60 20 120 50 Q180 15 240 50 Q300 22 360 50 Q420 12 480 50 Q540 24 600 50 Q660 14 720 50 Q780 22 840 50 Q900 16 960 50 Q1020 24 1080 50 Q1140 18 1200 50 V80 Z" fill="currentColor" />
    </svg>
  );
}

// Soft floating leaves that sit behind page content.
export function BackgroundLeaves() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden leaf-backdrop">
      <Leaf className="absolute -left-6 top-24 h-28 w-28 rotate-12 text-sage/40 animate-sway" />
      <Leaf className="absolute right-8 top-10 h-20 w-20 -rotate-45 text-forest/10" />
      <Leaf className="absolute bottom-16 left-1/4 h-24 w-24 rotate-45 text-sage/30 animate-sway" />
      <Leaf className="absolute -right-8 bottom-24 h-40 w-40 rotate-12 text-forest/10" />
    </div>
  );
}
