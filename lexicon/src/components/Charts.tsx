/* Tiny dependency-free charts for the analytics dashboard.
 * SVG line chart + CSS horizontal bar chart — both fluid (width: 100%) so they
 * read fine on a phone. No chart library, no extra bundle weight. */

import { useRef, useState } from "react";
import type { MouseEvent } from "react";

export interface Point { label: string; value: number; }

export function LineChart({ data, color = "var(--c-blue)", height = 120 }: {
  data: Point[];
  color?: string;
  height?: number;
}) {
  const VW = 320;
  const VH = height;
  const pad = 8;
  const n = data.length;
  const max = Math.max(1, ...data.map((d) => d.value));
  const x = (i: number) => (n <= 1 ? VW / 2 : pad + (i / (n - 1)) * (VW - pad * 2));
  const y = (v: number) => VH - pad - (v / max) * (VH - pad * 2);

  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  if (n === 0) return <div className="chart-empty">No data in this range yet.</div>;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${VH - pad} L${x(0).toFixed(1)},${VH - pad} Z`;

  // Scrub anywhere over the plot: map the pointer's x into viewBox units and snap
  // to the nearest day. The SVG scales to 100% width, so we go via its rendered rect.
  function onMove(e: MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return;
    const relX = ((e.clientX - rect.left) / rect.width) * VW;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(x(i) - relX);
      if (d < bestD) { bestD = d; best = i; }
    }
    setHover(best);
  }

  const hv = hover != null ? data[hover] : null;
  // Flip the tooltip below the point when the point sits high (near the top edge),
  // so it never collides with the chart's caption above.
  const tipBelow = hv ? y(hv.value) < VH * 0.45 : false;

  return (
    <div className="lc-wrap">
      <div className="lc-plot">
        <svg ref={svgRef} className="lc" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet" role="img"
          aria-label={`line chart, peak ${max}`}
          onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          <line x1={pad} y1={VH - pad} x2={VW - pad} y2={VH - pad} className="lc-axis" />
          <path d={area} fill={color} opacity={0.12} />
          <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.value)} r={1.8} fill={color} />)}
          {hover != null && (
            <>
              <line className="lc-guide" x1={x(hover)} y1={pad} x2={x(hover)} y2={VH - pad} />
              <circle className="lc-ring" cx={x(hover)} cy={y(data[hover].value)} r={5.5} fill="none" stroke={color} strokeWidth={1.5} opacity={0.3} />
              <circle className="lc-dot-hi" cx={x(hover)} cy={y(data[hover].value)} r={3.4} fill={color} />
            </>
          )}
        </svg>
        {hv && (
          <div className={`lc-tip${tipBelow ? " below" : ""}`}
            style={{ left: `${(x(hover!) / VW) * 100}%`, top: `${(y(hv.value) / VH) * 100}%` }}>
            <span className="lc-tip-v">{hv.value}</span>
            <span className="lc-tip-l">{hv.label}</span>
          </div>
        )}
      </div>
      <div className="lc-foot">
        <span>{data[0]?.label}</span>
        <span className="lc-peak">peak {max}</span>
        <span>{data[n - 1]?.label}</span>
      </div>
    </div>
  );
}

export interface Bar { label: string; value: number; sub?: string; color?: string; }

export function BarChart({ data }: { data: Bar[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <div className="chart-empty">No data in this range yet.</div>;
  return (
    <div className="bars">
      {data.map((d, i) => (
        <div className="bar-row" key={i}>
          <span className="bar-label">{d.label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: (d.value / max * 100) + "%", background: d.color ?? "var(--c-blue)" }} />
          </div>
          <span className="bar-val">{d.sub ?? d.value}</span>
        </div>
      ))}
    </div>
  );
}
