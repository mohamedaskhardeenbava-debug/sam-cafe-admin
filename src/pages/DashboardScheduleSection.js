/**
 * DashboardScheduleSection.js  —  Sam Cafe Admin Panel
 * Dashboard — staff schedule sub-section
 */

import React, { useMemo, useState } from "react";

import { PieChart, Pie, Cell, Sector, ResponsiveContainer } from "recharts";

/* ── Palette ── */
const STATUS_COLORS = {
  scheduled: "#2563eb",
  completed: "#1dd1a1",
  pending: "#ff9f43",
  cancelled: "#ee5253",
};
const FALLBACK_COLORS = ["#4361ee", "#06d6a0", "#ffd166", "#ef476f", "#7209b7", "#4cc9f0"];

/* ── Helper: build pie slices from a schedule list ── */
function buildPieData(list = []) {
  const map = {};
  (list).forEach(item => {
    const s = (item.status || "pending").toLowerCase();
    map[s] = (map[s] || 0) + 1;
  });
  return Object.entries(map).map(([status, count], i) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    rawStatus: status,
    value: count,
    color: STATUS_COLORS[status] || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
  }));
}

/* ── Active (expanded) sector shape ── */
const ActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;
  return (
    <g>
      <Sector
        cx={cx} cy={cy}
        innerRadius={innerRadius - 5}
        outerRadius={outerRadius + 10}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: `drop-shadow(0 6px 14px ${fill}66)`, cursor: "pointer" }}
      />
      <text x={cx} y={cy - 9} textAnchor="middle" fontSize={12} fontWeight={700} fill="#111">
        {payload.name}
      </text>
      <text x={cx} y={cy + 9} textAnchor="middle" fontSize={11} fill="#666">
        {value} task{value !== 1 ? "s" : ""}
      </text>
    </g>
  );
};

/* ── Single Donut Card ── */
function SchedulePieCard({ title, icon, data, total, route, navigate }) {
  const [activeIdx, setActiveIdx] = useState(null);

  const handleClick = (entry) => {
    if (!navigate || !entry) return;
    navigate(route, { state: { status: entry.rawStatus } });
  };

  if (data.length === 0) {
    return (
      <div className="chart-card pie" style={{ justifyContent: "center", alignItems: "center", minHeight: 260 }}>
        <div style={{ fontSize: 13, color: "#aaa" }}>No schedule data</div>
      </div>
    );
  }

  return (
    <div className="chart-card pie" style={{ minHeight: 280 }}>
      {/* Header */}
      <div className="chart-header" style={{ marginBottom: 4 }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: "#222", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <span>{icon}</span>{title}
        </h4>
        <span className="sc-total-badge">{total} tasks</span>
      </div>

      {/* Hint */}
      <p style={{ fontSize: 10, color: "#bbb", margin: "0 0 6px", textAlign: "right" }}>
        Click a slice to view filtered list →
      </p>

      {/* Pie */}
      <ResponsiveContainer width="100%" height={170}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={72}
            isAnimationActive
            animationBegin={100}
            animationDuration={800}
            activeIndex={activeIdx}
            activeShape={<ActiveShape />}
            onMouseEnter={(_, i) => setActiveIdx(i)}
            onMouseLeave={() => setActiveIdx(null)}
            onClick={(entry) => handleClick(entry)}
            style={{ cursor: "pointer" }}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Legend table */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 6 }}>
        {data.map((d, i) => (
          <div
            key={i}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "4px 8px", borderRadius: 8, cursor: "pointer",
              background: activeIdx === i ? "#f5f5f5" : "transparent",
              transition: "background 0.15s",
            }}
            onMouseEnter={() => setActiveIdx(i)}
            onMouseLeave={() => setActiveIdx(null)}
            onClick={() => handleClick(d)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: "#444" }}>{d.name}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>{d.value}</span>
              <span style={{ fontSize: 11, color: "#999", minWidth: 32, textAlign: "right" }}>
                {total > 0 ? Math.round((d.value / total) * 100) : 0}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Section (exported) ── */
export default function ScheduleSection({ adminData, navigate }) {
  const kitchenData = useMemo(
    () => buildPieData(adminData?.kitchenSchedules || []),
    [adminData?.kitchenSchedules]
  );
  const serviceData = useMemo(
    () => buildPieData(adminData?.serviceSchedules || []),
    [adminData?.serviceSchedules]
  );

  const kitchenTotal = kitchenData.reduce((s, d) => s + d.value, 0);
  const serviceTotal = serviceData.reduce((s, d) => s + d.value, 0);

  return (
    <>
      {/* Section heading */}
      <div className="staff-section-title" style={{ marginTop: 32 }}>
        <h3>📋 Schedule Overview</h3>
        <span className="staff-section-sub">Click any slice to view filtered schedules</span>
      </div>

      {/* Two-column pie grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 20 }}>
        <SchedulePieCard
          title="Kitchen Schedules"
          icon="🍳"
          data={kitchenData}
          total={kitchenTotal}
          route="/kitchen-schedules"
          navigate={navigate}
        />
        <SchedulePieCard
          title="Service Schedules"
          icon="🛎️"
          data={serviceData}
          total={serviceTotal}
          route="/service-schedules"
          navigate={navigate}
        />
      </div>
    </>
  );
}
