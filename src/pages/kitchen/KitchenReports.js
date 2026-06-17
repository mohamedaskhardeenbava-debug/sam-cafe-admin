import React, { useMemo, useState } from "react";
import { exportMultiSheet } from "../../utils/excelUtils";
import "./KitchenReports.css";
import { CustomDatePicker } from "../../components/CustomDatePicker";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Sector,
  CartesianGrid
} from "recharts";

/* ─── Palette ─────────────────────────────────────────── */
const K = {
  orange: "#ff9f43", amber: "#f0a500", green: "#1dd1a1",
  red: "#ee5253", blue: "#54a0ff", purple: "#9b59b6",
  teal: "#1abc9c", navy: "#2d3436", slate: "#636e72",
  text: "#111", muted: "#777", border: "#e8ecf0",
};

/* ─── Helpers ─────────────────────────────────────────── */
const parseGroomingData = (grooming = {}, staff = [], fromDate = "", toDate = "") => {
  return staff.map(s => {
    const dates = grooming[s.id] || {};
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
    return { name: s.name, score: total > 0 ? Math.round((passed / total) * 100) : 0 };
  });
};

/* ─── Parse mise: picks only today's entry ─── */
const parseMiseData = (mise = {}) => {
  const today = new Date().toISOString().split("T")[0];

  // Only show today's data
  if (!(today in mise)) return [];

  const taskMap = mise[today];
  return Object.entries(taskMap).map(([task, data]) => ({
    task,
    verified: data.verified ? 1 : 0,
    time: data.time || "—",
    staff: data.staff || "—",
    label: data.verified ? "Done" : "Pending",
  }));
};

const parseAttendanceStats = (staff = [], fromDate = "", toDate = "") =>
  staff.map(s => {
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

const parseOrderCategoryData = (orders = [], fromDate = "", toDate = "") => {
  const map = {};
  orders.forEach(o => {
    const d = (o.date || o.createdAt || "").slice(0, 10);
    if (fromDate && d < fromDate) return;
    if (toDate && d > toDate) return;
    o.items?.forEach(item => {
      const cat = item.categoryId || "other";
      const label = cat.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      map[label] = (map[label] || 0) + (item.quantity || 1);
    });
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, qty]) => ({ name, qty }));
};

/* ─── Parse kitchen assign: today only ─── */
const parseKitchenAssign = (kitchenAssign = {}) => {
  const today = new Date().toISOString().slice(0, 10);
  if (!(today in kitchenAssign)) return [];
  return Object.entries(kitchenAssign[today])
    .filter(([, d]) => d.staff)
    .map(([task, d]) => ({ task, staff: d.staff || "—", time: d.assignedAt || d.time || "—" }));
};

/* ─── Sub-components ──────────────────────────────────── */
const KpiCard = ({ label, value, sub, color = K.orange }) => (
  <div className="k-kpi-card">
    <div>
      <p className="k-kpi-label">{label}</p>
      <h3 className="k-kpi-value" style={{ color }}>{value}</h3>
      {sub && <p className="k-kpi-sub">{sub}</p>}
    </div>
  </div>
);

const SectionTitle = ({ children, accent }) => (
  <div className="k-section-title">
    <span className="k-section-accent" style={{ background: accent || K.orange }} />
    <h3>{children}</h3>
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="k-tooltip">
      <p className="k-tooltip-label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || K.orange }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 4} outerRadius={outerRadius + 10} startAngle={startAngle} endAngle={endAngle} fill={fill} style={{ filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.15))" }} />
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize={13} fontWeight={700} fill="#111">{payload.name}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={12} fill="#777">{value} items</text>
    </g>
  );
};

/* ─── Main ────────────────────────────────────────────── */
const KitchenReports = ({ adminData = {} }) => {
  const { grooming = {}, mise = {}, kitchenAssign = {}, recipes = [], orders = [], staff = [], ingredients = [] } = adminData;

  const roundTo = (v, d = 2) => Math.round((Number(v) + Number.EPSILON) * 10 ** d) / 10 ** d;
  const [activePie, setActivePie] = useState(null);
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  /* filtered orders */
  const filteredOrders = useMemo(() => orders.filter(o => {
    const d = (o.date || o.createdAt || "").slice(0, 10);
    if (reportFrom && d < reportFrom) return false;
    if (reportTo && d > reportTo) return false;
    return true;
  }), [orders, reportFrom, reportTo]);

  /* derived */
  const groomData = useMemo(() => parseGroomingData(grooming, staff, reportFrom, reportTo), [grooming, staff, reportFrom, reportTo]);
  const miseData = useMemo(() => parseMiseData(mise), [mise]);
  const assignData = useMemo(() => parseKitchenAssign(kitchenAssign), [kitchenAssign]);
  const attData = useMemo(() => parseAttendanceStats(staff, reportFrom, reportTo), [staff, reportFrom, reportTo]);
  const catData = useMemo(() => parseOrderCategoryData(filteredOrders), [filteredOrders]);

  const stockData = useMemo(() => ingredients.map(ing => {
    const rem = roundTo(ing.stockRemaining ?? 0, 2);
    const mx = Number(ing.stockMax ?? 0);
    const pct = mx > 0 ? Math.round((rem / mx) * 100) : 0;
    return { name: ing.name, stock: rem, stockMax: mx, percent: pct };
  }).sort((a, b) => a.percent - b.percent), [ingredients]);

  /* kpi numbers */
  const totalOrders = filteredOrders.length;
  const completedOrders = filteredOrders.filter(o => o.status === "completed").length;
  const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
  const totalIngredients = ingredients.length;
  const lowStock = ingredients.filter(i => { const pct = i.stockMax > 0 ? (i.stockRemaining / i.stockMax) * 100 : 100; return pct < 35; }).length;
  const miseVerified = miseData.filter(m => m.verified).length;
  const misePending = miseData.filter(m => !m.verified).length;
  const avgGroom = groomData.length ? Math.round(groomData.reduce((s, g) => s + g.score, 0) / groomData.length) : 0;

  /* attendance summary */
  const totalPresent = attData.reduce((s, x) => s + x.present, 0);
  const totalLeave = attData.reduce((s, x) => s + x.leave, 0);
  const totalAbsent = attData.reduce((s, x) => s + x.absent, 0);

  const exportReport = () => {
    // Attendance sheet
    const attRows = attData.map(s => ({
      Name: s.name, Present: s.present, Leave: s.leave, Absent: s.absent,
      "Attendance %": `${s.pct}%`,
    }));
    // Grooming sheet
    const groomRows = groomData.map(g => ({ Name: g.name, "Grooming Score %": `${g.score}%` }));
    // Orders sheet
    const orderRows = catData.map(c => ({ Category: c.name, "Item Qty": c.qty }));

    exportMultiSheet({
      sheets: [
        { name: "Attendance", rows: attRows },
        { name: "Grooming", rows: groomRows },
        { name: "Orders by Category", rows: orderRows },
      ],
      fileName: `kitchen_report_${reportFrom || "all"}_${reportTo || today}.xlsx`,
    });
  };

  /* pies */
  const stockPie = useMemo(() => {
    let high = 0, mid = 0, low = 0;
    ingredients.forEach(i => { const pct = i.stockMax > 0 ? (i.stockRemaining / i.stockMax) * 100 : 100; if (pct >= 60) high++; else if (pct >= 35) mid++; else low++; });
    return [
      { name: "Healthy (≥60%)", value: high, color: K.green },
      { name: "Warning (35–60%)", value: mid, color: K.amber },
      { name: "Critical (<35%)", value: low, color: K.red },
    ].filter(d => d.value > 0);
  }, [ingredients]);

  const stockColor = (pct) => pct >= 60 ? K.green : pct >= 35 ? K.amber : K.red;

  const StockTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const { name, stock, stockMax, percent } = payload[0].payload;
    const color = stockColor(percent);
    return (
      <div className="k-tooltip">
        <div className="k-tooltip-label" style={{ color }}>{name}</div>
        <div style={{ color, fontWeight: 700, fontSize: 14 }}>{roundTo(stock, 2)}/{roundTo(stockMax, 2)} kg ({percent}%)</div>
      </div>
    );
  };

  return (
    <div className="k-page">

      {/* HEADER */}
      <div className="k-header">
        <div>
          <h2 className="k-title">Kitchen Management</h2>
          <p className="k-subtitle">Operations &amp; Performance Report</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="kgroom-filter-label">From</span>
            <CustomDatePicker value={reportFrom} onChange={v => { setReportFrom(v); if (reportTo && v > reportTo) setReportTo(v); }} placeholder="Start date" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="kgroom-filter-label">To</span>
            <CustomDatePicker value={reportTo} min={reportFrom} max={today} onChange={setReportTo} placeholder="End date" />
          </div>
          {(reportFrom || reportTo) && (
            <button className="ae-clear-filter" onClick={() => { setReportFrom(""); setReportTo(""); }}>Clear</button>
          )}
          <button className="modal-save-btn" onClick={exportReport}>
            <span className="shadow"></span>
            <span className="edge"></span>
            <span className="front">Export</span>
          </button>
        </div>
      </div>

      {/* KPI ROW */}
      <div className="k-kpi-row">
        <KpiCard label="Total Orders" value={totalOrders} color={K.blue} sub="all time" />
        <KpiCard label="Completion Rate" value={`${completionRate}%`} color={K.green} sub={`${completedOrders} completed`} />
        <KpiCard label="Ingredients" value={totalIngredients} color={K.teal} sub={`${lowStock} low stock`} />
        <KpiCard label="Mise Tasks" value={`${miseVerified}/${miseData.length}`} color={K.orange} sub={`${misePending} pending`} />
        <KpiCard label="Avg Grooming" value={`${avgGroom}%`} color={K.purple} sub={`${groomData.length} staff tracked`} />
        <KpiCard label="Recipes" value={recipes.length} color={K.amber} sub="logged recipes" />
      </div>

      {/* ATTENDANCE KPI ROW */}
      <div className="k-att-kpi-row">
        <div className="k-att-kpi present">
          <span className="k-att-kpi-val">{totalPresent}</span>
          <span className="k-att-kpi-label">Present Days</span>
        </div>
        <div className="k-att-kpi leave">
          <span className="k-att-kpi-val">{totalLeave}</span>
          <span className="k-att-kpi-label">Leave Days</span>
        </div>
        <div className="k-att-kpi absent">
          <span className="k-att-kpi-val">{totalAbsent}</span>
          <span className="k-att-kpi-label">Absent Days</span>
        </div>
      </div>

      {/* MISE | ASSIGN | GROOMING */}
      <div className="k-grid-3">

        <div className="k-card rpt-fixed-card">
          <SectionTitle accent={K.teal}>Mise en Place <span style={{ fontSize: 11, fontWeight: 400, color: K.muted, marginLeft: 4 }}>— Today</span></SectionTitle>
          {miseData.length === 0 ? <p className="k-empty">No mise data for today</p> : (
            <div className="rpt-mise-grid rpt-inner-scroll">
              {miseData.map((m, i) => (
                <div key={i} className={`rpt-mise-item ${m.verified ? "verified" : "pending"}`}>
                  <div className="rpt-mise-check">{m.verified ? "✓" : "○"}</div>
                  <div className="rpt-mise-info">
                    <p className="rpt-mise-task">{m.task}</p>
                    <p className="rpt-mise-detail">{m.staff !== "—" ? `by ${m.staff}` : ""}{m.staff !== "—" && m.time !== "—" ? " · " : ""}{m.time !== "—" ? m.time : ""}</p>
                  </div>
                  <span className={`rpt-mise-badge ${m.verified ? "done" : "todo"}`}>{m.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="k-card rpt-fixed-card">
          <SectionTitle accent={K.blue}>Staff Assignment <span style={{ fontSize: 11, fontWeight: 400, color: K.muted, marginLeft: 4 }}>— Today</span></SectionTitle>
          {assignData.length === 0 ? <p className="k-empty">No assignments for today</p> : (
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

        <div className="k-card rpt-fixed-card">
          <SectionTitle accent={K.purple}>Staff Grooming</SectionTitle>
          {groomData.length === 0 ? <p className="k-empty">No grooming data</p> : (
            <div className="rpt-groom-bars rpt-inner-scroll">
              {groomData.map((g, i) => (
                <div key={i} className="rpt-groom-row">
                  <span className="rpt-groom-name">{g.name}</span>
                  <div className="rpt-groom-track">
                    <div className="rpt-groom-fill" style={{ width: `${g.score}%`, background: g.score >= 80 ? K.green : g.score >= 50 ? K.amber : K.red }} />
                  </div>
                  <span className="rpt-groom-score" style={{ color: g.score >= 80 ? K.green : g.score >= 50 ? K.amber : K.red }}>{g.score}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ATTENDANCE CHART */}
      <div className="k-card k-att-chart-card">
        <SectionTitle accent={K.blue}>Staff Attendance This Month</SectionTitle>
        {attData.length === 0 ? <p className="k-empty">No attendance data</p> : (
          <>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={attData} margin={{ top: 4, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: K.muted }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#bbb" }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="present" name="Present" fill={K.green} stackId="a" barSize={22} />
                <Bar dataKey="leave" name="Leave" fill={K.orange} stackId="a" barSize={22} />
                <Bar dataKey="absent" name="Absent" fill="#e9ecef" stackId="a" radius={[4, 4, 0, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
            <div className="k-att-rows">
              {attData.map((s, i) => (
                <div key={i} className="k-att-row">
                  <span className="k-att-name">{s.name}</span>
                  <div className="k-att-track">
                    <div className="k-att-fill" style={{ width: `${s.pct}%`, background: s.pct >= 75 ? K.green : s.pct >= 50 ? K.orange : K.red }} />
                  </div>
                  <div className="k-att-chips">
                    <span className="k-att-chip present">{s.present}P</span>
                    <span className="k-att-chip leave">{s.leave}L</span>
                    <span className="k-att-chip absent">{s.absent}A</span>
                    <span className="k-att-pct">{s.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="k-grid-2">
        {/* STOCK */}
        <div className="k-card k-card-split">
          <div style={{ display: "flex", flexDirection: "column", gap: "70px" }}>
            <SectionTitle accent={K.red}>Stock Health Overview</SectionTitle>
            {stockPie.length === 0 ? <p className="k-empty">No stock data</p> : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={stockPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={80} outerRadius={100}
                    animationEasing="cubic-bezier(0.4,0,0.2,1)" activeIndex={activePie} activeShape={renderActiveShape}
                    onMouseEnter={(_, idx) => setActivePie(idx)} onMouseLeave={() => setActivePie(null)}
                    isAnimationActive animationDuration={800}>
                    {stockPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="k-card k-card-split">
          <div>
            <SectionTitle accent={K.amber}>Ingredient Stock Levels (critical — {lowStock})</SectionTitle>
            {stockData.length === 0 ? <p className="k-empty">No stock data</p> : (
              <div className="k-stock-scroll">
                <ResponsiveContainer width="100%" height={Math.max(stockData.length * 20, 100)}>
                  <BarChart data={stockData} layout="vertical" barCategoryGap={4}>
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10, fill: "#111" }} />
                    <Tooltip content={<StockTooltip />} />
                    <Bar dataKey="stock" barSize={4} radius={[0, 6, 6, 0]}>
                      {stockData.map((e, i) => <Cell key={i} fill={stockColor(e.percent)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KitchenReports;