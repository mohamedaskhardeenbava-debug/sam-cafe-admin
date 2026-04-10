import React, { useMemo, useState } from "react";
import "./ServiceReports.css";
import api from "../../api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Sector,
  AreaChart, Area, CartesianGrid,
  RadialBarChart, RadialBar, Legend
} from "recharts";

/* ─── PALETTE ─────────────────────────────────────────────── */
const S = {
  cyan: "#54a0ff",
  sky: "#38bdf8",
  indigo: "#5f27cd",
  violet: "#9b59b6",
  rose: "#ee5253",
  green: "#1dd1a1",
  amber: "#ff9f43",
  slate: "#636e72",
  card: "#ffffff",
  text: "#111",
  muted: "#777",
  border: "#e8ecf0",
};

/* ─── HELPERS ─────────────────────────────────────────────── */
const parseServiceMise = (serviceMise = {}) =>
  Object.entries(serviceMise).map(([task, data]) => ({
    task,
    verified: data.verified === true,
    time: data.time || "—",
    label: data.verified ? "Ready" : "Pending"
  }));

const parseServiceAssign = (serviceAssign = {}) =>
  Object.entries(serviceAssign).map(([task, data]) => ({
    task,
    staff: data.staff || "—",
    time: data.time || "—"
  }));

const parseServiceGrooming = (serviceGrooming = {}, staff = []) => {
  const staffMap = {};
  staff.forEach(s => { staffMap[s.id] = s.name; });
  return Object.entries(serviceGrooming).map(([staffId, dates]) => {
    const name = staffMap[staffId] || staffId.replace("staff_", "");
    let total = 0, passed = 0;
    Object.values(dates).forEach(checks => {
      ["uniform", "shoes", "groom"].forEach(k => {
        total++;
        if (checks[k] === true) passed++;
      });
    });
    const score = total > 0 ? Math.round((passed / total) * 100) : 0;
    return { name, score, days: Object.keys(dates).length };
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
    o.items?.forEach(item => {
      map[d].revenue += (item.totalPrice || 0);
    });
  });
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({
    month: month.slice(5),
    ...v,
    revenue: Math.round(v.revenue)
  }));
};

const parseTableStats = (orders = [], tables = []) => {
  const tableMap = {};
  orders.forEach(o => {
    if (o.mode?.toLowerCase() === "dine in" && o.tableNo) {
      const t = String(o.tableNo);
      tableMap[t] = (tableMap[t] || 0) + 1;
    }
  });
  return Object.entries(tableMap).sort((a, b) => Number(a[0]) - Number(b[0])).map(([table, count]) => ({
    table: `T${table}`,
    orders: count
  }));
};

const parseOrderStatusDist = (orders = []) => {
  const map = {};
  orders.forEach(o => {
    const s = o.status || "unknown";
    map[s] = (map[s] || 0) + 1;
  });
  const colors = { completed: S.green, preparing: S.amber, placed: S.rose, unknown: S.muted };
  return Object.entries(map).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: count,
    color: colors[status] || S.indigo
  }));
};

const parseReservationStatus = (reservations = [], celebrations = [], preBookings = []) => {
  const count = (arr, key) => arr.filter(r => r.status === key).length;
  return [
    { name: "Reservations", pending: count(reservations, "pending"), confirmed: count(reservations, "confirmed"), total: reservations.length },
    { name: "Celebrations", pending: count(celebrations, "pending"), confirmed: count(celebrations, "confirmed"), total: celebrations.length },
    { name: "Pre-Bookings", pending: count(preBookings, "pending"), confirmed: count(preBookings, "scheduled"), total: preBookings.length },
  ];
};

/* ─── SMALL COMPONENTS ────────────────────────────────────── */
const KpiCard = ({ label, value, sub, color = S.cyan, icon }) => (
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
        <p key={i} style={{ color: p.color || S.cyan }}>
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
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 4} outerRadius={outerRadius + 10}
        startAngle={startAngle} endAngle={endAngle} fill={fill}
        style={{ filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.18))" }} />
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize={13} fontWeight={700} fill="#111">{payload.name}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={12} fill="#777">{value.toLocaleString()}</text>
    </g>
  );
};

/* ─── MAIN COMPONENT ──────────────────────────────────────── */
const ServiceReports = ({ adminData = {} }) => {
  const {
    serviceAssign = {}, serviceGrooming = {}, serviceMise = {},
    orders = [], staff = [], tables = [],
    reservations = [], celebrations = [], preBookings = [], cateringOrders = []
  } = adminData;

  const [activePie, setActivePie] = useState(null);

  /* derived */
  const miseData = useMemo(() => parseServiceMise(serviceMise), [serviceMise]);
  const assignData = useMemo(() => parseServiceAssign(serviceAssign), [serviceAssign]);
  const groomData = useMemo(() => parseServiceGrooming(serviceGrooming, staff), [serviceGrooming, staff]);
  const trendData = useMemo(() => parseDineInTrend(orders), [orders]);
  const tableData = useMemo(() => parseTableStats(orders, tables), [orders, tables]);
  const statusDist = useMemo(() => parseOrderStatusDist(orders), [orders]);
  const eventData = useMemo(() => parseReservationStatus(reservations, celebrations, preBookings), [reservations, celebrations, preBookings]);

  /* kpi */
  const totalOrders = orders.length;
  const dineInOrders = orders.filter(o => o.mode?.toLowerCase() === "dine in").length;
  const takeAwayOrders = orders.filter(o => o.mode?.toLowerCase() !== "dine in").length;
  const totalRevenue = orders.reduce((s, o) => s + o.items?.reduce((is, i) => is + (i.totalPrice || 0), 0), 0);
  const miseReady = miseData.filter(m => m.verified).length;
  const eventTotal = (reservations.length || 0) + (celebrations.length || 0) + (preBookings.length || 0) + (cateringOrders.length || 0);
  const avgGroom = groomData.length ? Math.round(groomData.reduce((s, g) => s + g.score, 0) / groomData.length) : 0;

  /* radial bar for event stats */
  const radialData = [
    { name: "Reservations", value: reservations.length, fill: S.cyan },
    { name: "Celebrations", value: celebrations.length, fill: S.violet },
    { name: "Pre-Bookings", value: preBookings.length, fill: S.amber },
    { name: "Catering", value: cateringOrders.length, fill: S.green },
  ];

  return (
    <div className="s-page">

      {/* ── HEADER ── */}
      <div className="s-header">
        <div>
          <h2 className="s-title">Service Management</h2>
          <p className="s-subtitle">Floor Operations & Guest Experience Report</p>
        </div>
      </div>

      {/* ── KPI ROW ── */}
      <div className="s-kpi-row">
        <KpiCard label="Total Orders" value={totalOrders.toLocaleString()} icon="📦" color={S.cyan} sub="all time" />
        <KpiCard label="Dine In" value={dineInOrders} icon="🍽️" color={S.indigo} sub="table service" />
        <KpiCard label="Take Away" value={takeAwayOrders} icon="🛍️" color={S.violet} sub="carry out" />
        <KpiCard label="Table Mise" value={`${miseReady}/${miseData.length}`} icon="🪑" color={S.amber} sub="setup tasks done" />
        <KpiCard label="Event Bookings" value={eventTotal} icon="🎉" color={S.rose} sub="total bookings" />
        <KpiCard
          label="Tables"
          value={tables.length}
          icon="🪑"
          color={S.sky}
          sub="available"
        />
      </div>

      {/* ── ROW 1: DINE-IN TREND + ORDER STATUS ── */}
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
                  <Pie data={statusDist} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                    activeIndex={activePie} activeShape={renderActiveShape}
                    onMouseEnter={(_, i) => setActivePie(i)}
                    onMouseLeave={() => setActivePie(null)}
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

      {/* ── ROW 3: MISE + ASSIGN + GROOMING + EVENTS ── */}
      <div className="s-grid-3">

        {/* TABLE MISE */}
        <div className="s-card">
          <SectionTitle accent={S.amber}>Table Mise Status</SectionTitle>
          {miseData.length === 0 ? <p className="s-empty">No mise data</p> : (
            <div className="s-mise-list">
              {miseData.map((m, i) => (
                <div key={i} className={`s-mise-row ${m.verified ? "ok" : "no"}`}>
                  <div className="s-mise-indicator">
                    <div className={`s-mise-dot ${m.verified ? "ok" : "no"}`} />
                  </div>
                  <div className="s-mise-body">
                    <p className="s-mise-task">{m.task}</p>
                    <p className="s-mise-time">{m.time}</p>
                  </div>
                  <span className={`s-mise-tag ${m.verified ? "ok" : "no"}`}>{m.label}</span>
                </div>
              ))}
            </div>
          )}

          <div className="s-section-divider" />

          <SectionTitle accent={S.cyan}>Staff Assignment</SectionTitle>
          {assignData.length === 0 ? <p className="s-empty">No assignments</p> : (
            <div className="s-assign-list">
              {assignData.map((a, i) => (
                <div key={i} className="s-assign-row">
                  <div className="s-assign-icon">👤</div>
                  <div className="s-assign-body">
                    <p className="s-assign-task">{a.task}</p>
                    <p className="s-assign-staff">{a.staff} · {a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* GROOMING */}
        <div className="s-card">
          <SectionTitle accent={S.violet}>Service Staff Grooming</SectionTitle>
          {groomData.length === 0 ? (
            <div className="s-no-groom">
              <p className="s-empty">No grooming records yet</p>
              <div className="s-groom-demo">
                <p style={{ color: S.muted, fontSize: 12 }}>Avg Score</p>
                <div className="s-groom-circle" style={{ '--score': `${avgGroom}%`, '--color': S.violet }}>
                  <span>{avgGroom}%</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="s-groom-circle-wrap">
                <div className="s-groom-circle" style={{ '--score': `${avgGroom}%`, '--color': avgGroom >= 70 ? S.green : avgGroom >= 40 ? S.amber : S.rose }}>
                  <span>{avgGroom}%</span>
                </div>
                <p className="s-groom-label">Team Average</p>
              </div>
              <div className="s-groom-bars">
                {groomData.map((g, i) => (
                  <div key={i} className="s-groom-row">
                    <span className="s-groom-name">{g.name}</span>
                    <div className="s-groom-track">
                      <div className="s-groom-fill" style={{
                        width: `${g.score}%`,
                        background: g.score >= 70 ? S.green : g.score >= 40 ? S.amber : S.rose
                      }} />
                    </div>
                    <span className="s-groom-score">{g.score}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* EVENT BOOKINGS */}
        <div className="s-card">
          <SectionTitle accent={S.rose}>Event Bookings Overview</SectionTitle>
          <div className="s-event-stats">
            {eventData.map((e, i) => (
              <div key={i} className="s-event-card">
                <p className="s-event-name">{e.name}</p>
                <div className="s-event-nums">
                  <div className="s-event-num-item">
                    <span>{e.pending}</span>
                    <p>Pending</p>
                  </div>
                  <div className="s-event-num-item">
                    <span>{e.confirmed}</span>
                    <p>Confirmed</p>
                  </div>
                  <div className="s-event-num-item">
                    <span>{e.total}</span>
                    <p>Total</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="s-section-divider" />

          <SectionTitle accent={S.green}>Catering Orders</SectionTitle>
          {cateringOrders.length === 0 ? <p className="s-empty">No catering orders</p> : (
            <div className="s-catering-list">
              {cateringOrders.map((c, i) => (
                <div key={i} className="s-catering-row">
                  <div>
                    <p className="s-catering-name">{c.name}</p>
                    <p className="s-catering-detail">{c.eventDate} · {c.guests} guests · {c.location}</p>
                  </div>
                  <span className="s-catering-amount">₹{c.totalAmount?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServiceReports;
