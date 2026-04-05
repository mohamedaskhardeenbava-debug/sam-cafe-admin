import React, { useMemo, useState } from "react";
import "./KitchenReports.css";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Sector,
  Line, CartesianGrid
} from "recharts";

/* ─── PALETTE ─────────────────────────────────────────────── */
const K = {
  orange: "#ff9f43",
  amber: "#f0a500",
  green: "#1dd1a1",
  red: "#ee5253",
  blue: "#54a0ff",
  purple: "#9b59b6",
  teal: "#1abc9c",
  navy: "#2d3436",
  slate: "#636e72",
  text: "#111",
  muted: "#777",
  border: "#e8ecf0",
};

/* ─── HELPERS ─────────────────────────────────────────────── */
const groomingChecks = ["uniform", "shoes", "groom"];

const parseGroomingData = (grooming = {}, staff = []) => {
  return staff.map(s => {
    const dates = grooming[s.id] || {};

    let total = 0, passed = 0;

    Object.values(dates).forEach(checks => {
      groomingChecks.forEach(k => {
        total++;
        if (checks[k] === true) passed++;
      });
    });

    const score = total > 0 ? Math.round((passed / total) * 100) : 0;

    return {
      name: s.name,
      score
    };
  });
};

const parseMiseData = (mise = {}) =>
  Object.entries(mise).map(([task, data]) => ({
    task,
    verified: data.verified ? 1 : 0,
    time: data.time || "—",
    staff: data.staff || "—",
    label: data.verified ? "Done" : "Pending"
  }));

const parseRecipeData = (recipes = []) =>
  recipes.map(r => ({ name: r.name, steps: (r.description || "").split("\n").filter(Boolean).length }));

const parseOrderCategoryData = (orders = []) => {
  const map = {};
  orders.forEach(o => {
    o.items?.forEach(item => {
      const cat = item.categoryId || "other";
      const label = cat.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      map[label] = (map[label] || 0) + (item.quantity || 1);
    });
  });
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, qty]) => ({ name, qty }));
};

const parseCompletionTrend = (orders = []) => {
  const map = {};
  orders.forEach(o => {
    const d = (o.date || "").slice(0, 7);
    if (!d) return;
    if (!map[d]) map[d] = { total: 0, completed: 0 };
    map[d].total++;
    if (o.status === "completed") map[d].completed++;
  });
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({
    month: month.slice(5),
    rate: v.total > 0 ? Math.round((v.completed / v.total) * 100) : 0,
    total: v.total,
    completed: v.completed
  }));
};

/* ─── SMALL COMPONENTS ────────────────────────────────────── */
const KpiCard = ({ label, value, sub, color = K.orange, icon }) => (
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

/* ─── RADAR ACTIVE SHAPE ──────────────────────────────────── */
const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 4} outerRadius={outerRadius + 10}
        startAngle={startAngle} endAngle={endAngle} fill={fill}
        style={{ filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.15))" }} />
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize={13} fontWeight={700} fill="#111">{payload.name}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={12} fill="#777">{value} items</text>
    </g>
  );
};

/* ─── MAIN COMPONENT ──────────────────────────────────────── */
const KitchenReports = ({ adminData = {} }) => {
  const { grooming = {}, mise = {}, recipes = [], orders = [], staff = [], ingredients = [] } = adminData;

  const roundTo = (value, decimals = 2) =>
    Math.round((Number(value) + Number.EPSILON) * 10 ** decimals) /
    10 ** decimals;

  const [activePie, setActivePie] = useState(null);

  /* derived */
  const groomData = useMemo(() => parseGroomingData(grooming, staff), [grooming, staff]);
  const miseData = useMemo(() => parseMiseData(mise), [mise]);
  const recipeData = useMemo(() => parseRecipeData(recipes), [recipes]);
  const catData = useMemo(() => parseOrderCategoryData(orders), [orders]);
  const trendData = useMemo(() => parseCompletionTrend(orders), [orders]);

  const stockData = useMemo(() => {
    return ingredients.map(ing => {
      const remaining = roundTo(ing.stockRemaining ?? 0, 2);
      const max = Number(ing.stockMax ?? 0);

      const percent =
        max > 0 ? Math.round((remaining / max) * 100) : 0;

      return {
        name: ing.name,
        stock: remaining,
        stockMax: max,
        percent
      };
    })
      .sort((a, b) => a.percent - b.percent);

  }, [ingredients]);

  /* kpi numbers */
  const totalOrders = orders.length;
  const completedOrders = orders.filter(o => o.status === "completed").length;
  const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
  const totalIngredients = ingredients.length;
  const lowStock = ingredients.filter(i => {
    const pct = i.stockMax > 0 ? (i.stockRemaining / i.stockMax) * 100 : 100;
    return pct < 35;
  }).length;
  const miseVerified = miseData.filter(m => m.verified).length;
  const misePending = miseData.filter(m => !m.verified).length;
  const avgGroom = groomData.length
    ? Math.round(groomData.reduce((s, g) => s + g.score, 0) / groomData.length)
    : 0;

  /* pie chart for mise status */
  const misePieData = [
    { name: "Verified", value: miseVerified, color: K.green },
    { name: "Pending", value: misePending, color: K.red },
  ];

  /* stock criticality pie */
  const stockPie = useMemo(() => {
    let high = 0, mid = 0, low = 0;
    ingredients.forEach(i => {
      const pct = i.stockMax > 0 ? (i.stockRemaining / i.stockMax) * 100 : 100;
      if (pct >= 60) high++;
      else if (pct >= 35) mid++;
      else low++;
    });
    return [
      { name: "Healthy (≥60%)", value: high, color: K.green },
      { name: "Warning (35–60%)", value: mid, color: K.amber },
      { name: "Critical (<35%)", value: low, color: K.red },
    ].filter(d => d.value > 0);
  }, [ingredients]);

  /* grooming radar */
  const radarData = groomData.map(g => ({
    subject: g.name,
    Score: g.score,
    fullMark: 100
  }));

  /* stock bar – bottom 14 */
  const stockBar = useMemo(() =>
    ingredients.map(i => {
      const pct = i.stockMax > 0 ? Math.round((i.stockRemaining / i.stockMax) * 100) : 0;
      return { name: i.name, pct };
    }).sort((a, b) => a.pct - b.pct).slice(0, 14),
    [ingredients]
  );

  const stockColor = (pct) => pct >= 60 ? K.green : pct >= 35 ? K.amber : K.red;

  const getStockColor = (value) => {
    if (value >= 60) return "#1dd1a1";
    if (value >= 35) return "#ff9f43";
    return "#ee5253";
  };

  const StockTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;

    const { name, stock, stockMax, percent } = payload[0].payload;
    const color = getStockColor(percent);

    return (
      <div
        className="k-tooltip"
      >
        <div
          className="trend-tooltip-label"
          style={{ color }}
        >
          {name}
        </div>

        <div
          className="trend-tooltip-value"
          style={{ color }}
        >
          {roundTo(stock, 2)} / {roundTo(stockMax, 2)} kg ({percent}%)
        </div>
      </div>
    );
  };

  return (
    <div className="k-page">

      {/* ── HEADER ── */}
      <div className="k-header">
        <div>
          <h2 className="k-title">Kitchen Management</h2>
          <p className="k-subtitle">Operations & Performance Report</p>
        </div>
      </div>

      {/* ── KPI ROW ── */}
      <div className="k-kpi-row">
        <KpiCard label="Total Orders" value={totalOrders} color={K.blue} sub="all time" />
        <KpiCard label="Completion Rate" value={`${completionRate}%`} color={K.green} sub={`${completedOrders} completed`} />
        <KpiCard label="Ingredients" value={totalIngredients} color={K.teal} sub={`${lowStock} low stock`} />
        <KpiCard label="Mise Tasks" value={`${miseVerified}/${miseData.length}`} color={K.orange} sub={`${misePending} pending`} />
        <KpiCard label="Avg Grooming" value={`${avgGroom}%`} color={K.purple} sub={`${groomData.length} staff tracked`} />
        <KpiCard label="Recipes" value={recipes.length} color={K.amber} sub="logged recipes" />
      </div>

      {/* ── ROW 2: GROOMING RADAR + MISE TABLE ── */}
      <div className="k-grid-2">
        <div className="k-card">
          <SectionTitle accent={K.purple}>Staff Grooming Compliance</SectionTitle>
          {groomData.length === 0 ? <p className="k-empty">No grooming data</p> : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={radarData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  {/* GRID */}
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={K.border}
                    vertical={false}
                  />

                  {/* X AXIS */}
                  <XAxis
                    dataKey="subject"
                    tick={{ fontSize: 11, fill: K.muted }}
                    axisLine={false}
                    tickLine={false}
                  />

                  {/* Y AXIS */}
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: K.muted }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />

                  {/* TOOLTIP */}
                  <Tooltip content={<CustomTooltip />} />

                  {/* BAR */}
                  <Bar
                    dataKey="Score"
                    radius={[8, 8, 0, 0]}
                    barSize={24}
                  >
                    {radarData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          entry.Score >= 80
                            ? K.green
                            : entry.Score >= 50
                              ? K.amber
                              : K.red
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="k-groom-bars">
                {groomData.map((g, i) => (
                  <div key={i} className="k-groom-row">
                    <span className="k-groom-name">{g.name}</span>
                    <div className="k-groom-track">
                      <div className="k-groom-fill" style={{
                        width: `${g.score}%`,
                        background: g.score >= 80 ? K.green : g.score >= 50 ? K.amber : K.red
                      }} />
                    </div>
                    <span className="k-groom-score" style={{
                      color: g.score >= 80 ? K.green : g.score >= 50 ? K.amber : K.red
                    }}>{g.score}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="k-card">
          <SectionTitle accent={K.teal}>Mise en Place Status</SectionTitle>
          {miseData.length === 0 ? <p className="k-empty">No mise data</p> : (
            <div className="k-mise-grid">
              {miseData.map((m, i) => (
                <div key={i} className={`k-mise-item ${m.verified ? "verified" : "pending"}`}>
                  <div className="k-mise-check">{m.verified ? "✓" : "○"}</div>
                  <div className="k-mise-info">
                    <p className="k-mise-task">{m.task}</p>
                    <p className="k-mise-detail">{m.staff !== "—" ? `by ${m.staff}` : ""} {m.time !== "—" ? `· ${m.time}` : ""}</p>
                  </div>
                  <span className={`k-mise-badge ${m.verified ? "done" : "todo"}`}>{m.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="k-card k-card-split">
        <div>
          <SectionTitle accent={K.red}>Stock Health Overview</SectionTitle>
          {stockPie.length === 0 ? <p className="k-empty">No stock data</p> : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={stockPie} dataKey="value" nameKey="name" cx="50%" cy="50%"

                  innerRadius={80}
                  outerRadius={100}

                  /* ---- TRANSITION CORE ---- */
                  animationEasing="cubic-bezier(0.4, 0, 0.2, 1)"

                  activeIndex={activePie} activeShape={renderActiveShape}
                  onMouseEnter={(_, idx) => setActivePie(idx)}
                  onMouseLeave={() => setActivePie(null)}
                  isAnimationActive animationDuration={800}>
                  {stockPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="k-divider"></div>

        {/* ── ROW 3: STOCK STATUS ── */}

        <div>
          <SectionTitle accent={K.amber}>Ingredient Stock Levels (critical - {lowStock})</SectionTitle>
          {stockBar.length === 0 ? <p className="k-empty">No stock data</p> : (
            <div className="k-stock-scroll">
              <ResponsiveContainer
                width="100%"
                height={Math.max(stockData.length * 20, 100)}
              >
                <BarChart
                  data={stockData}
                  layout="vertical"
                  barCategoryGap={4}
                >
                  <XAxis type="number" />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={120}
                    tick={{ fontSize: 10, fill: "#111" }}
                  />
                  <Tooltip content={<StockTooltip />} />

                  <Bar dataKey="stock" barSize={4} radius={[0, 6, 6, 0]}>
                    {stockData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={getStockColor(entry.percent)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

      </div>


    </div>
  );
};

export default KitchenReports;
