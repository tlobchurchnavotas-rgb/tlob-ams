// ─── CHARTS ───────────────────────────────────────────────────────────────────
import { useMemo, useState } from "react";

function BarChart({ data, color = "#6366f1" }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 90, padding: "0 4px" }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ width: "100%", background: color, borderRadius: "4px 4px 0 0", height: `${(d.value / max) * 72}px`, minHeight: 4, transition: "height 0.6s ease" }} />
          <span style={{ fontSize: 9, color: "#94a3b8", whiteSpace: "nowrap" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}
function LineChart({
  data,
  color = "#06b6d4",
  height = 110,
  showTooltip = true,
  tooltipLabel = "value",
  formatValue,
  showValues = true,
}) {
  const w = 320;
  const h = 110;
  const [hoverIdx, setHoverIdx] = useState(null);

  const max = useMemo(() => Math.max(...(data || []).map(d => d.value), 1), [data]);
  const pts = useMemo(() => {
    const n = Math.max((data || []).length, 1);
    if (n === 1) return [{ x: 10, y: h - 10 }];
    return (data || []).map((d, i) => ({
      x: (i / (n - 1)) * (w - 20) + 10,
      y: h - 10 - ((d.value / max) * (h - 26)),
    }));
  }, [data, max]);

  const path = useMemo(() => pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" "), [pts]);
  const area = useMemo(() => {
    if (!pts.length) return "";
    return `${path} L ${pts[pts.length - 1].x} ${h - 10} L ${pts[0].x} ${h - 10} Z`;
  }, [path, pts]);

  const activeIdx = hoverIdx == null ? null : Math.min(Math.max(hoverIdx, 0), (data || []).length - 1);
  const activePt = activeIdx == null ? null : pts[activeIdx];
  const activeDatum = activeIdx == null ? null : (data || [])[activeIdx];

  const clamp = (v, min, maxv) => Math.max(min, Math.min(maxv, v));
  const valueText = activeDatum
    ? (typeof formatValue === "function" ? formatValue(activeDatum.value) : String(activeDatum.value))
    : "";

  const tooltipW = 74;
  const tooltipH = 34;
  const tipX = activePt ? clamp(activePt.x - tooltipW / 2, 6, w - tooltipW - 6) : 0;
  const tipY = activePt ? clamp(activePt.y - tooltipH - 14, 6, h - tooltipH - 6) : 0;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      style={{ width: "100%", height }}
      onMouseLeave={() => setHoverIdx(null)}
      onMouseMove={(e) => {
        if (!data || data.length === 0) return;
        const svg = e.currentTarget;
        const rect = svg.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * w;
        // find nearest x
        let best = 0;
        let bestDist = Infinity;
        for (let i = 0; i < pts.length; i++) {
          const d = Math.abs(pts[i].x - x);
          if (d < bestDist) { bestDist = d; best = i; }
        }
        setHoverIdx(best);
      }}
    >
      <defs>
        <linearGradient id="lg2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* area + line */}
      <path d={area} fill="url(#lg2)" />
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* x labels */}
      {(data || []).map((d, i) => (
        <text key={`t-${i}`} x={pts[i].x} y={h - 1} textAnchor="middle" fill="#94a3b8" fontSize="9">
          {d.label}
        </text>
      ))}

      {/* points */}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={activeIdx === i ? 4.4 : 3.4} fill={color} opacity={activeIdx === i ? 1 : 0.9} />
      ))}

      {/* value labels (always visible) */}
      {showValues && (data || []).map((d, i) => {
        const v = typeof formatValue === "function" ? formatValue(d.value) : String(d.value);
        const y = Math.max(10, pts[i].y - 10);
        return (
          <text
            key={`v-${i}`}
            x={pts[i].x}
            y={y}
            textAnchor="middle"
            fill={color}
            fontSize="9"
            fontWeight="700"
            opacity={d.value > 0 ? 1 : 0.65}
          >
            {v}
          </text>
        );
      })}

      {/* hover guide + tooltip */}
      {showTooltip && activePt && activeDatum && (
        <g>
          <line x1={activePt.x} x2={activePt.x} y1={12} y2={h - 12} stroke={color} strokeOpacity="0.45" strokeWidth="1.2" />
          <circle cx={activePt.x} cy={activePt.y} r="6.5" fill={color} opacity="0.18" />

          <g transform={`translate(${tipX},${tipY})`}>
            <rect width={tooltipW} height={tooltipH} rx="8" fill="#ffffff" opacity="0.95" />
            <text x="10" y="14" fill="#0f172a" fontSize="9" fontWeight="700">{activeDatum.label}</text>
            <text x="10" y="26" fill={color} fontSize="9" fontWeight="700">{tooltipLabel}: {valueText}</text>
          </g>
        </g>
      )}
    </svg>
  );
}
function DonutChart({ filled, total, color }) {
  const pct = total > 0 ? filled / total : 0;
  const r = 36, cx = 44, cy = 44, stroke = 10, circ = 2 * Math.PI * r;
  return (
    <svg width={88} height={88}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth={stroke} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${pct * circ} ${circ}`} strokeDashoffset={circ * 0.25} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.8s ease" }} />
      <text x={cx} y={cy + 5} textAnchor="middle" fill="white" fontSize="13" fontWeight="700">{Math.round(pct * 100)}%</text>
    </svg>
  );
}

export { BarChart, LineChart, DonutChart };
