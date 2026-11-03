import { useMemo } from 'react';

const HEART_PATH =
  'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z';

/** A few soft hearts drifting upward. Hidden automatically for people who prefer reduced motion. */
export function FloatingHearts({ count = 9 }: { count?: number }) {
  const hearts = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: (i * 97 + 11) % 100,
        size: 14 + ((i * 7) % 18),
        duration: 16 + ((i * 5) % 12),
        delay: -((i * 3.7) % 20),
        gold: i % 3 === 0,
      })),
    [count],
  );
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {hearts.map((h) => (
        <svg
          key={h.id}
          className="heart-float absolute"
          viewBox="0 0 24 24"
          fill="currentColor"
          style={{
            left: `${h.left}%`,
            bottom: '-40px',
            width: h.size,
            height: h.size,
            animationDuration: `${h.duration}s`,
            animationDelay: `${h.delay}s`,
            color: h.gold ? '#C9A96E' : '#B094DA',
          }}
        >
          <path d={HEART_PATH} />
        </svg>
      ))}
    </div>
  );
}

export function Flower({
  cx,
  cy,
  r,
  petals = 6,
  fill = '#CBB6E8',
  center = '#C9A96E',
  opacity = 0.85,
}: {
  cx: number;
  cy: number;
  r: number;
  petals?: number;
  fill?: string;
  center?: string;
  opacity?: number;
}) {
  return (
    <g>
      {Array.from({ length: petals }, (_, i) => (
        <ellipse
          key={i}
          cx={cx}
          cy={cy - r * 0.55}
          rx={r * 0.32}
          ry={r * 0.55}
          transform={`rotate(${(i * 360) / petals} ${cx} ${cy})`}
          fill={fill}
          opacity={opacity}
        />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.2} fill={center} />
    </g>
  );
}

/** Delicate floral spray for the corner of a page. */
export function FloralCorner({ className = '' }: { className?: string }) {
  const leaves: [number, number, number][] = [
    [42, 54, -20],
    [78, 74, -35],
    [112, 108, -50],
    [138, 140, -62],
    [56, 102, 12],
    [88, 134, -4],
  ];
  return (
    <svg viewBox="0 0 220 220" className={className} aria-hidden fill="none">
      <path d="M0 40C60 50 110 90 150 150S190 200 200 220" stroke="#C9A96E" strokeWidth="1.5" strokeLinecap="round" opacity=".7" />
      <path d="M0 92C40 97 80 122 105 162" stroke="#C9A96E" strokeWidth="1.2" strokeLinecap="round" opacity=".5" />
      {leaves.map(([x, y, a], i) => (
        <ellipse key={i} cx={x} cy={y} rx="16" ry="6" transform={`rotate(${a} ${x} ${y})`} fill="#CBB6E8" opacity=".55" />
      ))}
      <Flower cx={30} cy={30} r={26} petals={7} />
      <Flower cx={96} cy={72} r={18} petals={6} fill="#E0D4F2" />
      <Flower cx={150} cy={142} r={14} petals={5} fill="#E6D3A8" center="#9674C8" />
      <Flower cx={20} cy={96} r={12} petals={5} fill="#B094DA" opacity={0.6} />
    </svg>
  );
}

/** Soft background used on guest pages. */
export function WeddingBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-lavender-100 via-ivory to-ivory" />
      <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-lavender-300/40 blur-3xl" />
      <div className="absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-champagne-300/30 blur-3xl" />
      <FloralCorner className="absolute -left-4 -top-4 w-44 opacity-80 sm:w-64" />
      <FloralCorner className="absolute -bottom-4 -right-4 w-44 rotate-180 opacity-80 sm:w-64" />
    </div>
  );
}
