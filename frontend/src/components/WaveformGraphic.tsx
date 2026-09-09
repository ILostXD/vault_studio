import { useId, useMemo } from "react";

export function WaveformGraphic({
  bars,
  progressPercent,
  playedColor = "var(--waveform-played)",
  unplayedColor = "var(--waveform-unplayed)",
}: {
  bars: number[];
  progressPercent: number;
  playedColor?: string;
  unplayedColor?: string;
}) {
  const gradientId = useId();
  const width = Math.max(bars.length - 1, 0) * 2 + 1;
  const offset = `${Math.max(0, Math.min(100, progressPercent))}%`;
  const shapes = useMemo(() => bars.map((value, index) => {
    const height = Math.max(12, Math.min(100, Number(value) || 0) * 1.2);
    return <rect key={index} x={0.1 + index * 2} y={(120 - height) / 2} width={0.8} height={height} rx={2} />;
  }), [bars]);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} 120`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={width} y2="0">
          <stop offset={offset} stopColor={playedColor} />
          <stop offset={offset} stopColor={unplayedColor} />
        </linearGradient>
      </defs>
      <g fill={`url(#${gradientId})`}>{shapes}</g>
    </svg>
  );
}
