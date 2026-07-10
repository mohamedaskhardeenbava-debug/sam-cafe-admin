/**
 * ServiceReports.js  —  Sam Cafe Admin Panel
 * Service reports and analytics page
 */

import React, { useMemo, useState } from "react";

import { exportMultiSheet } from "../../utils/excelUtils";
import api from "../../api";
import { DateRangeGroup } from "../../components/FilterBar";
import { todayStr } from "../../utils/dateRangeUtils";

import Button3D from "../../components/Button3D";

import "./ServiceReports.css";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Sector,
  AreaChart, Area, CartesianGrid,
} from "recharts";

/* ─── Palette ─────────────────────────────────────────── */
const S = {
  cyan: "#54a0ff", sky: "#38bdf8", indigo: "#5f27cd", violet: "#9b59b6",
  rose: "#ee5253", green: "#1dd1a1", amber: "#ff9f43", slate: "#636e72",
  card: "#ffffff", text: "#111", muted: "#777", border: "#e8ecf0",
};

/* ─── Helpers ─────────────────────────────────────────── */
const parseServiceMise = (serviceMise = {}) => {
  const today = todayStr();

  // Only show today's data
  if (!(today in serviceMise)) return [];

  const taskMap = serviceMise[today];
  return Object.entries(taskMap).map(([task, data]) => ({
    task,
    verified: data.verified === true,
    time: data.time || "—",
    label: data.verified ? "Ready" : "Pending",
  }));
};

const parseServiceAssign = (serviceAssign = {}) => {
  const today = todayStr();

  // Only show today's data
  if (!(today in serviceAssign)) return [];

  const taskMap = serviceAssign[today];
  return Object.entries(taskMap).map(([task, data]) => ({
    task,
    staff: data.staff || "—",
    time: data.time || "—",
  }));
};

const parseServiceGrooming = (serviceGrooming = {}, staff = [], fromDate = "", toDate = "") => {
  const staffMap = {};
  staff.forEach(s => { staffMap[s.id] = s.name; });

  return Object.entries(serviceGrooming)
    .filter(([k]) => k !== "memo")
    .map(([staffId, dates]) => {
      const name = staffMap[staffId] || staffId.replace("staff_", "");
      let total = 0, passed = 0;
      Object.entries(dates).forEach(([d, checks]) => {
        if (typeof checks !== "object" || checks === null) return;
        if (fromDate && d < fromDate) return;
        if (toDate && d > toDate) return;
        ["uniform", "shoes", "groom"].forEach(k => {
          total++;
          if (checks[k] === true) passed++;
        });
      });
      const score = total > 0 ? Math.round((passed / total) * 100) : 0;
      return { name, score, days: Object.keys(dates).length };
    });
};

const parseAttendanceStats = (staff = [], fromDate = "", toDate = "") => {
  return staff.map(s => {
    const att = (s.attendance || []).filter(a => {
      if (fromDate && a.date < fromDate) return false;
      if (toDate && a.date > toDate) return false;
      return true;
    });
    const present = att.filter(a => a.status === "present").length;
    const leave = att.filter(a => a.status === "leave").length;
    const absent = att.filter(a => a.status === "absent").length;
    const total = present + leave + absent;
    const pct = total > 0 ? Math.round((present / total) * 100) : 0;
    return { name: s.name.split(" ")[0], present, leave, absent, pct };
  });
};

const parseDineInTrend = (orders = []) => {
  const map = {};
  orders.forEach(o => {
    const d = (o.date || "").slice(0, 7);
    if (!d) return;
    if (!map[d]) map[d] = { dineIn: 0, takeAway: 0, revenue: 0 };
    const mode = (o.mode || "").toLowerCase();
    if (mode === "dine in") map[d].dineIn++;
    else map[d].takeAway++;
    o.items?.forEach(item => { map[d].revenue += (item.totalPrice || 0); });
  });
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({
    month: month.slice(5), ...v, revenue: Math.round(v.revenue),
  }));
};

const parseOrderStatusDist = (orders = []) => {
  const map = {};
  orders.forEach(o => { const s = o.status || "unknown"; map[s] = (map[s] || 0) + 1; });
  const colors = { completed: S.green, preparing: S.amber, placed: S.rose, unknown: S.slate };
  return Object.entries(map).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: count,
    color: colors[status] || S.indigo,
  }));
};

const parseReservationStatus = (reservations = [], celebrations = [], preBookings = [], cateringOrders = []) => {
  const count = (arr, key) => arr.filter(r => r.status === key).length;
  return [
    { name: "Reservations", pending: count(reservations, "pending"), confirmed: count(reservations, "confirmed"), completed: count(reservations, "completed"), cancelled: count(reservations, "cancelled"), total: reservations.length, color: "#54a0ff" },
    { name: "Celebrations", pending: count(celebrations, "pending"), confirmed: count(celebrations, "confirmed"), completed: count(celebrations, "completed"), cancelled: count(celebrations, "cancelled"), total: celebrations.length, color: "#9b59b6" },
    { name: "Pre-Bookings", pending: count(preBookings, "pending"), confirmed: count(preBookings, "confirmed"), completed: count(preBookings, "completed"), cancelled: count(preBookings, "cancelled"), total: preBookings.length, color: "#ff9f43" },
    { name: "Catering", pending: count(cateringOrders, "pending"), confirmed: count(cateringOrders, "confirmed"), completed: count(cateringOrders, "completed"), cancelled: count(cateringOrders, "cancelled"), total: cateringOrders.length, color: "#1dd1a1" },
  ];
};

const parseEventPie = (reservations = [], celebrations = [], preBookings = [], cateringOrders = []) => [
  { name: "Reservations", value: reservations.length, color: "#54a0ff" },
  { name: "Celebrations", value: celebrations.length, color: "#9b59b6" },
  { name: "Pre-Bookings", value: preBookings.length, color: "#ff9f43" },
  { name: "Catering", value: cateringOrders.length, color: "#1dd1a1" },
].filter(d => d.value > 0);

/* ─── Sub-components ──────────────────────────────────── */
const KpiCard = ({ label, value, sub, color = S.cyan }) => (
  <div className="s-kpi-card">
    <div>
      <p className="s-kpi-label">{label}</p>
      <h3 className="s-kpi-value" style={{ color }}>{value}</h3>
      {sub && <p className="s-kpi-sub">{sub}</p>}
    </div>
  </div>
);

const SectionTitle = ({ children, accent }) => (
  <div className="s-section-title">
    <span className="s-section-accent" style={{ background: accent || S.cyan }} />
    <h3>{children}</h3>
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="s-tooltip">
      <p className="s-tooltip-label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || S.cyan }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
};

const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 4} outerRadius={outerRadius + 10} startAngle={startAngle} endAngle={endAngle} fill={fill} style={{ filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.18))" }} />
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize={13} fontWeight={700} fill="#111">{payload.name}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={12} fill="#777">{value.toLocaleString()}</text>
    </g>
  );
};

/* ─── Main ────────────────────────────────────────────── */
const ServiceReports = ({ adminData = {} }) => {
  const {
    serviceAssign = {}, serviceGrooming = {}, serviceMise = {},
    orders = [], staff = [], tables = [],
    reservations = [], celebrations = [], preBookings = [], cateringOrders = [],
  } = adminData;

  // ── Hooks

  const [activePie, setActivePie] = useState(null);
  const [activeEventPie, setActiveEventPie] = useState(null);
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportPreset, setReportPreset] = useState("all");
  const today = todayStr();

  /* filtered orders by date range */
  const filteredOrders = useMemo(() => orders.filter(o => {
    const d = (o.date || o.createdAt || "").slice(0, 10);
    if (reportFrom && d < reportFrom) return false;
    if (reportTo && d > reportTo) return false;
    return true;
  }), [orders, reportFrom, reportTo]);

  /* derived */

  // ── Derived Values

  const miseData = useMemo(() => parseServiceMise(serviceMise), [serviceMise]);
  const assignData = useMemo(() => parseServiceAssign(serviceAssign), [serviceAssign]);
  const groomData = useMemo(() => parseServiceGrooming(serviceGrooming, staff, reportFrom, reportTo), [serviceGrooming, staff, reportFrom, reportTo]);
  const attData = useMemo(() => parseAttendanceStats(staff, reportFrom, reportTo), [staff, reportFrom, reportTo]);
  const trendData = useMemo(() => parseDineInTrend(filteredOrders), [filteredOrders]);
  const statusDist = useMemo(() => parseOrderStatusDist(filteredOrders), [filteredOrders]);
  const eventData = useMemo(() => parseReservationStatus(reservations, celebrations, preBookings, cateringOrders), [reservations, celebrations, preBookings, cateringOrders]);
  const eventPieData = useMemo(() => parseEventPie(reservations, celebrations, preBookings, cateringOrders), [reservations, celebrations, preBookings, cateringOrders]);

  /* kpis */
  const totalOrders = filteredOrders.length;
  const dineInOrders = filteredOrders.filter(o => o.mode?.toLowerCase() === "dine in").length;
  const takeAwayOrders = filteredOrders.filter(o => o.mode?.toLowerCase() !== "dine in").length;
  const miseReady = miseData.filter(m => m.verified).length;
  const eventTotal = (reservations.length) + (celebrations.length) + (preBookings.length) + (cateringOrders.length);
  const avgGroom = groomData.length ? Math.round(groomData.reduce((s, g) => s + g.score, 0) / groomData.length) : 0;

  /* attendance summary */
  const totalPresent = attData.reduce((s, x) => s + x.present, 0);
  const totalLeave = attData.reduce((s, x) => s + x.leave, 0);
  const totalAbsent = attData.reduce((s, x) => s + x.absent, 0);

  const exportReport = () => {
    const attRows = attData.map(s => ({ Name: s.name, Present: s.present, Leave: s.leave, Absent: s.absent, "Attendance %": `${s.pct}%` }));
    const groomRows = groomData.map(g => ({ Name: g.name, "Grooming Score %": `${g.score}%` }));
    const orderRows = trendData.map(t => ({ Month: t.month, "Dine In": t.dineIn, "Take Away": t.takeAway, Revenue: t.revenue }));
    exportMultiSheet({
      sheets: [
        { name: "Attendance", rows: attRows },
        { name: "Grooming", rows: groomRows },
        { name: "Order Trend", rows: orderRows },
      ],
      fileName: `service_report_${reportFrom || "all"}_${reportTo || today}.xlsx`,
    });
  };

  return (
    <div className="s-page">

      {/* HEADER */}
      <div className="s-header">
        <div>
          <h2 className="s-title">Service Management</h2>
          <p className="s-subtitle">Operations &amp; Guest Experience Report</p>
        </div>
        <div className="s-header-filters">
          <DateRangeGroup
            from={reportFrom}
            to={reportTo}
            onChangeFrom={setReportFrom}
            onChangeTo={setReportTo}
            preset={reportPreset}
            onChangePreset={setReportPreset}
            max={today}
            labelClass="sgroom-filter-label"
            groupClass="s-filter-item"
            separateItems
          />
          {(reportFrom || reportTo) && (
            <button className="ae-clear-filter" onClick={() => { setReportPreset("all"); setReportFrom(""); setReportTo(""); }}>Clear</button>
          )}
          <span className="s-export-btn">
            <Button3D onClick={exportReport}>Export</Button3D>
          </span>
        </div>
      </div>

      {/* KPI ROW */}
      <div className="s-kpi-row">
        <KpiCard label="Total Orders" value={totalOrders.toLocaleString()} color={S.cyan} sub="all time" />
        <KpiCard label="Dine In" value={dineInOrders} color={S.indigo} sub="table service" />
        <KpiCard label="Take Away" value={takeAwayOrders} color={S.violet} sub="carry out" />
        <KpiCard label="Table Mise" value={`${miseReady}/${miseData.length}`} color={S.amber} sub="setup tasks done" />
        <KpiCard label="Event Bookings" value={eventTotal} color={S.rose} sub="total bookings" />
        <KpiCard label="Tables" value={tables.length} color={S.sky} sub="available" />
      </div>

      {/* ATTENDANCE KPI ROW */}
      <div className="s-att-kpi-row">
        <div className="s-att-kpi present">
          <span className="s-att-kpi-val">{totalPresent}</span>
          <span className="s-att-kpi-label">Present Days</span>
        </div>
        <div className="s-att-kpi leave">
          <span className="s-att-kpi-val">{totalLeave}</span>
          <span className="s-att-kpi-label">Leave Days</span>
        </div>
        <div className="s-att-kpi absent">
          <span className="s-att-kpi-val">{totalAbsent}</span>
          <span className="s-att-kpi-label">Absent Days</span>
        </div>
      </div>

      {/* ROW 1: DINE-IN TREND + ORDER STATUS */}
      <div className="s-grid-2">
        <div className="s-card">
          <SectionTitle accent={S.cyan}>Monthly Dine In vs Take Away</SectionTitle>
          {trendData.length === 0 ? <p className="s-empty">No trend data available</p> : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={trendData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={S.border} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: S.muted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: S.muted }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="dineIn" name="Dine In" fill={S.indigo} radius={[4, 4, 0, 0]} barSize={18} />
                <Bar dataKey="takeAway" name="Take Away" fill={S.cyan} radius={[4, 4, 0, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="s-card">
          <SectionTitle accent={S.rose}>Order Status Distribution</SectionTitle>
          {statusDist.length === 0 ? <p className="s-empty">No status data</p> : (
            <div className="s-pie-row">
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                    activeIndex={activePie} activeShape={renderActiveShape}
                    onMouseEnter={(_, i) => setActivePie(i)} onMouseLeave={() => setActivePie(null)}
                    isAnimationActive animationDuration={800}>
                    {statusDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="s-pie-legend">
                {statusDist.map((d, i) => (
                  <div key={i} className="s-pie-legend-item">
                    <span className="s-pie-dot" style={{ background: d.color }} />
                    <span className="s-pie-name">{d.name}</span>
                    <strong style={{ color: d.color }}>{d.value.toLocaleString()}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ATTENDANCE CHART */}
      <div className="s-card s-att-chart-card">
        <SectionTitle accent={S.indigo}>Staff Attendance This Month</SectionTitle>
        {attData.length === 0 ? <p className="s-empty">No attendance data</p> : (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={attData} margin={{ top: 4, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: S.muted }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#bbb" }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="present" name="Present" fill={S.green} stackId="a" barSize={22} />
                <Bar dataKey="leave" name="Leave" fill={S.amber} stackId="a" barSize={22} />
                <Bar dataKey="absent" name="Absent" fill="#e9ecef" stackId="a" radius={[4, 4, 0, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
            <div className="s-att-rows">
              {attData.map((s, i) => (
                <div key={i} className="s-att-row">
                  <span className="s-att-name">{s.name}</span>
                  <div className="s-att-track">
                    <div className="s-att-fill" style={{ width: `${s.pct}%`, background: s.pct >= 75 ? S.green : s.pct >= 50 ? S.amber : S.rose }} />
                  </div>
                  <div className="s-att-chips">
                    <span className="s-att-chip present">{s.present}P</span>
                    <span className="s-att-chip leave">{s.leave}L</span>
                    <span className="s-att-chip absent">{s.absent}A</span>
                    <span className="s-att-pct">{s.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* GRID: MISE | ASSIGN | GROOMING */}
      <div className="s-grid-3">

        <div className="s-card rpt-fixed-card">
          <SectionTitle accent={S.amber}>Table Mise Status <span className="s-section-note">— Today</span></SectionTitle>
          {miseData.length === 0 ? <p className="s-empty">No mise data for today</p> : (
            <div className="rpt-mise-grid rpt-inner-scroll">
              {miseData.map((m, i) => (
                <div key={i} className={`rpt-mise-item ${m.verified ? "verified" : "pending"}`}>
                  <div className="rpt-mise-check">{m.verified ? "✓" : "○"}</div>
                  <div className="rpt-mise-info">
                    <p className="rpt-mise-task">{m.task}</p>
                    <p className="rpt-mise-detail">{m.time !== "—" ? m.time : ""}</p>
                  </div>
                  <span className={`rpt-mise-badge ${m.verified ? "done" : "todo"}`}>{m.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="s-card rpt-fixed-card">
          <SectionTitle accent={S.cyan}>Staff Assignment <span className="s-section-note">— Today</span></SectionTitle>
          {assignData.length === 0 ? <p className="s-empty">No assignments for today</p> : (
            <div className="rpt-assign-list rpt-inner-scroll">
              {assignData.map((a, i) => (
                <div key={i} className="rpt-assign-row">
                  <div className="rpt-assign-icon">👤</div>
                  <div className="rpt-assign-body">
                    <p className="rpt-assign-task">{a.task}</p>
                    <p className="rpt-assign-staff">{a.staff} · {a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="s-card rpt-fixed-card">
          <SectionTitle accent={S.violet}>Service Staff Grooming</SectionTitle>
          {groomData.length === 0 ? <p className="s-empty">No grooming records yet</p> : (
            <div className="rpt-groom-bars rpt-inner-scroll">
              {groomData.map((g, i) => (
                <div key={i} className="rpt-groom-row">
                  <span className="rpt-groom-name">{g.name}</span>
                  <div className="rpt-groom-track">
                    <div className="rpt-groom-fill" style={{ width: `${g.score}%`, background: g.score >= 70 ? S.green : g.score >= 40 ? S.amber : S.rose }} />
                  </div>
                  <span className="rpt-groom-score" style={{ color: g.score >= 70 ? S.green : g.score >= 40 ? S.amber : S.rose }}>{g.score}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* GRID: EVENT PIE | EVENT BOOKINGS DATA */}
      <div className="s-grid-2">

        <div className="s-card rpt-fixed-card">
          <SectionTitle accent={S.indigo}>Event Bookings Distribution</SectionTitle>
          {eventPieData.length === 0 ? <p className="s-empty">No event data</p> : (
            <div className="rpt-evt-pie-wrap">
              <ResponsiveContainer width="50%" height={220}>
                <PieChart>
                  <Pie data={eventPieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={52} outerRadius={80}
                    activeIndex={activeEventPie} activeShape={renderActiveShape}
                    onMouseEnter={(_, i) => setActiveEventPie(i)} onMouseLeave={() => setActiveEventPie(null)}
                    isAnimationActive animationDuration={800}>
                    {eventPieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="rpt-evt-pie-legend">
                {eventPieData.map((d, i) => (
                  <div key={i} className="rpt-evt-legend-item">
                    <span className="rpt-evt-legend-dot" style={{ background: d.color }} />
                    <span className="rpt-evt-legend-name">{d.name}</span>
                    <strong style={{ color: d.color }}>{d.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="s-card rpt-fixed-card">
          <SectionTitle accent={S.rose}>Event Bookings Overview</SectionTitle>
          <div className="rpt-evt-scroll rpt-inner-scroll">
            {eventData.map((e, i) => (
              <div key={i} className="rpt-evt-row" style={{ borderLeftColor: e.color }}>
                <p className="rpt-evt-name" style={{ color: e.color }}>{e.name}</p>
                <div className="rpt-evt-nums">
                  <div className="rpt-evt-num pending"><span>{e.pending}</span><p>Pending</p></div>
                  <div className="rpt-evt-num confirmed"><span>{e.confirmed}</span><p>Confirmed</p></div>
                  <div className="rpt-evt-num completed"><span>{e.completed ?? 0}</span><p>Done</p></div>
                  <div className="rpt-evt-num cancelled"><span>{e.cancelled ?? 0}</span><p>Cancelled</p></div>
                  <div className="rpt-evt-num total"><span>{e.total}</span><p>Total</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ServiceReports;