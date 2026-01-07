import React, { useEffect, useMemo, useState } from "react";
import "./Dashboard.css";
import api from "../api";
import {
  PieChart,
  Pie,
  Cell,
  Sector,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Area
} from "recharts";
import { format, subDays } from "date-fns";

const COLORS = ["#ff9f43", "#54a0ff", "#FFD700", "#1dd1a1", "#00FFFF", "#e93c3cff", "#FFFF00", "#FF8AFF"];

const renderActiveShape = (props) => {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    value
  } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 6}
        outerRadius={outerRadius + 14}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{
          transition: "all 0.45s cubic-bezier(0.4, 0, 0.2, 1)",
          filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.25))"
        }}
      />

      {/* TEXT FADE-IN */}
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        fontSize={14}
        fontWeight={600}
        fill="#111"
        style={{ opacity: 0, animation: "fadeIn 0.35s ease forwards" }}
      >
        {payload.name}
      </text>

      <text
        x={cx}
        y={cy + 16}
        textAnchor="middle"
        fontSize={13}
        fill="#555"
        style={{ opacity: 0, animation: "fadeIn 0.35s ease 0.1s forwards" }}
      >
        {value}% (₹{payload.amount})
      </text>
    </g>
  );
};

const renderPieLabel = ({
  cx,
  cy,
  midAngle,
  outerRadius,
  percent,
  payload
}) => {
  const RADIAN = Math.PI / 180;

  const radius = outerRadius + 18;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#333"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      fontSize={12}
      fontWeight={500}
    >
      {payload.name} ({(percent * 100).toFixed(1)}%)
    </text>
  );
};


const Dashboard = ({ adminData }) => {
  const orders = adminData.orders || [];
const ingredients = adminData.ingredients || [];
  const [activeIndex, setActiveIndex] = useState(null);
  const [view, setView] = useState("YEAR");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const todayDate = new Date();
  const todayYear = todayDate.getFullYear();
  const todayMonth = todayDate.getMonth();
  const todayDay = todayDate.getDate();

  const today = format(new Date(), "yyyy-MM-dd");
  const [fromDate, setFromDate] = useState(
    format(subDays(new Date(), 7), "yyyy-MM-dd")
  );
  const [toDate, setToDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );

  /* ---------------- FILTER ORDERS ---------------- */
  const filteredOrders = useMemo(() => {
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);

    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    return orders.filter(order => {
      const orderDate = new Date(order.date);
      return orderDate >= from && orderDate <= to;
    });
  }, [orders, fromDate, toDate]);


  /* ---------------- KPIs ---------------- */
  const totalSales = filteredOrders.reduce(
    (sum, order) =>
      sum +
      order.items.reduce(
        (s, item) => s + item.price * item.qty,
        0
      ),
    0
  );
  const totalOrders = filteredOrders.reduce(
    (sum, order) =>
      sum + order.items.reduce((s, i) => s + i.qty, 0),
    0
  );

  /* ---------------- SALES COMPARISON ---------------- */
  const previousOrders = useMemo(() => {
    const rangeMs =
      new Date(toDate).getTime() -
      new Date(fromDate).getTime();

    const prevFrom = new Date(
      new Date(fromDate).getTime() - rangeMs
    );
    const prevTo = new Date(fromDate);

    return orders.filter(order => {
      const d = new Date(order.date);
      return d >= prevFrom && d < prevTo;
    });
  }, [orders, fromDate, toDate]);

  const previousSales = previousOrders.reduce(
    (sum, order) =>
      sum +
      order.items.reduce(
        (s, item) => s + item.price * item.qty,
        0
      ),
    0
  );

  let salesChange = 0;

  if (previousSales === 0 && totalSales > 0) {
    salesChange = 100;
  } else if (previousSales === 0 && totalSales === 0) {
    salesChange = 0;
  } else {
    salesChange = (
      ((totalSales - previousSales) / previousSales) *
      100
    ).toFixed(1);
  }

  /* ---------------- CATEGORY % PIE ---------------- */
  const categorySales = useMemo(() => {
    const map = {};
    let grandTotal = 0;

    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        const amount = item.price * item.qty;
        grandTotal += amount;

        map[item.categoryId] =
          (map[item.categoryId] || 0) + amount;
      });
    });

    if (grandTotal === 0) return [];

    return Object.entries(map).map(
      ([name, value]) => ({
        name,
        value: Number(((value / grandTotal) * 100).toFixed(1)),
        amount: value
      })
    );
  }, [filteredOrders]);

  /* ---------------- ALL INGREDIENT STOCK ---------------- */
  const stockData = useMemo(() => {
    return [...ingredients]
      .map(ing => ({
        name: ing.name,
        stock: Number(ing.stockRemaining ?? 0)
      }))
      .sort((a, b) => b.stock - a.stock);
  }, [ingredients]);


  const getStockColor = (value) => {
    if (value >= 40) return "#1dd1a1";
    if (value >= 20) return "#ff9f43";
    return "#ee5253";
  };

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const getWeekOfMonth = (date) => {
    const d = new Date(date);
    const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);

    const dayOfMonth = d.getDate();
    const adjustedDay = dayOfMonth + startOfMonth.getDay();

    return Math.min(5, Math.ceil(adjustedDay / 7));
  };

  const availableYears = useMemo(() => {
    return [...new Set(orders.map(o => new Date(o.date).getFullYear()))].sort((a, b) => b - a);
  }, [orders]);

  const chartData = useMemo(() => {
    if (view === "YEAR") {
      const months = Object.fromEntries(monthNames.map(m => [m, 0]));

      orders.forEach(order => {
        const d = new Date(order.date);
        if (d.getFullYear() !== selectedYear) return;

        const revenue = order.items.reduce((s, i) => s + i.price * i.qty, 0);
        months[monthNames[d.getMonth()]] += revenue;
      });

      return monthNames
        .map((m, index) => ({
          label: m,
          revenue: months[m],
          index
        }))
        .filter(item =>
          selectedYear < todayYear || item.index <= todayMonth
        );
    }

    if (view === "MONTH") {
      const weekMap = new Map();

      orders.forEach(order => {
        const d = new Date(order.date);

        if (
          d.getFullYear() !== selectedYear ||
          monthNames[d.getMonth()] !== selectedMonth
        ) return;

        const weekNum = getWeekOfMonth(d);
        const revenue = order.items.reduce((s, i) => s + i.price * i.qty, 0);

        weekMap.set(
          weekNum,
          (weekMap.get(weekNum) || 0) + revenue
        );
      });

      return Array.from(weekMap.entries())
        .sort((a, b) => a[0] - b[0])   // ✅ FIX ordering
        .map(([weekNum, revenue]) => ({
          label: `Week ${weekNum}`,
          revenue
        }));
    }


    const days = {};

    orders.forEach(order => {
      const d = new Date(order.date);
      if (
        d.getFullYear() !== selectedYear ||
        monthNames[d.getMonth()] !== selectedMonth ||
        `Week ${getWeekOfMonth(d)}` !== selectedWeek
      ) return;

      const revenue = order.items.reduce((s, i) => s + i.price * i.qty, 0);
      days[d.getDate()] = (days[d.getDate()] || 0) + revenue;
    });

    const currentDayLimit =
      selectedYear === todayYear &&
        monthNames[todayMonth] === selectedMonth &&
        getWeekOfMonth(todayDate) === Number(selectedWeek.replace("Week ", ""))
        ? todayDay
        : Infinity;

    return Object.entries(days)
      .map(([label, revenue]) => ({
        label,
        revenue,
        dayNum: Number(label)
      }))
      .filter(d => d.dayNum <= currentDayLimit);

  }, [orders, view, selectedYear, selectedMonth, selectedWeek]);


  const handlePointClick = (data) => {
    if (view === "YEAR") {
      setSelectedMonth(data.label);
      setView("MONTH");
    }
    else if (view === "MONTH") {
      setSelectedWeek(data.label);
      setView("WEEK");
    }
  };


  const handleBack = () => {
    if (view === "WEEK") {
      setView("MONTH");
      setSelectedWeek(null);
    } else if (view === "MONTH") {
      setView("YEAR");
      setSelectedMonth(null);
    }
  };

  const TrendTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;

    const value = payload[0].value;

    return (
      <div className="trend-tooltip">
        <div className="trend-tooltip-label">{label}</div>

        <div className="trend-tooltip-value">
          ₹{value.toLocaleString()}
        </div>
      </div>
    );
  };

  const StockTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;

    const value = payload[0].value;

    return (
      <div className="trend-tooltip">
        <div className="trend-tooltip-label">{label}</div>

        <div
          className="trend-tooltip-value"
          style={{
            color:
              value >= 40
                ? "#1dd1a1"
                : value >= 20
                  ? "#ff9f43"
                  : "#ee5253"
          }}
        >
          {value} kg
        </div>
      </div>
    );
  };


  return (
    <div className="dashboard-page">
      <h2 className="dashboard-title">Dashboard</h2>

      {/* DATE FILTER */}
      <div className="dashboard-filter">
        {/* FROM DATE */}
        <input
          type="date"
          value={fromDate}
          max={toDate}
          onChange={(e) => {
            const selected = e.target.value;

            if (selected > toDate) {
              setFromDate(selected);
              setToDate(selected);
            } else {
              setFromDate(selected);
            }
          }}
        />

        {/* TO DATE */}
        <input
          type="date"
          value={toDate}
          min={fromDate}
          max={today}
          onChange={(e) => {
            const selected = e.target.value;

            if (selected < fromDate) {
              setToDate(fromDate);
            } else if (selected > today) {
              setToDate(today);
            } else {
              setToDate(selected);
            }
          }}
        />
      </div>

      {/* MAIN LAYOUT */}
      <div className="dashboard-main-layout">

        {/* LEFT PANEL */}
        <div className="dashboard-piechart">

          {/* KPIs */}
          <div className="dashboard-kpis">
            <div className="kpi-card">
              <p>Total Sales</p>
              <h3>₹{totalSales}</h3>
            </div>

            <div className="kpi-card">
              <p>Total Orders</p>
              <h3>{totalOrders}</h3>
            </div>

            <div
              className={`kpi-card ${salesChange >= 0 ? "positive" : "negative"
                }`}
            >
              <p>Sales Change</p>
              <h3>{salesChange}%</h3>
            </div>
          </div>

          {/* PIE CHART */}
          <div className="chart-card pie">
            <h4>Category-wise Sales (%)</h4>

            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={categorySales}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}

                  /* ---- TRANSITION CORE ---- */
                  isAnimationActive={true}
                  animationBegin={100}
                  animationDuration={800}
                  animationEasing="cubic-bezier(0.4, 0, 0.2, 1)"

                  activeIndex={activeIndex}
                  activeShape={renderActiveShape}

                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {categorySales.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>

              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* LINE CHART */}
        <div className="dashboard-linechart">
          <div className="chart-card">
            <div className="chart-header">
              <h4>
                Revenue Trend — {selectedYear}
                {selectedMonth && ` / ${selectedMonth}`}
                {selectedWeek && ` / ${selectedWeek}`}
              </h4>

              <div style={{ display: "flex", gap: 8 }}>
                {view === "YEAR" && (
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="year-selector"
                  >
                    {availableYears.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                )}

                {view !== "YEAR" && (
                  <button className="linechart-back-btn" onClick={handleBack}>
                  </button>
                )}
              </div>
            </div>

            <ResponsiveContainer width="100%" height={260}>
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              >
                {/* subtle grid (Y only) */}
                <CartesianGrid
                  vertical={false}
                  stroke="#eee"
                  strokeDasharray="3 3"
                />

                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#777" }}
                />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#777" }}
                  tickFormatter={(v) => `₹${v}`}
                />

                <Tooltip content={<TrendTooltip />} />

                {/* gradient fill */}
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#54a0ff" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#54a0ff" stopOpacity={0} />
                  </linearGradient>
                </defs>

                {/* area under line */}
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="none"
                  fill="url(#trendGradient)"
                  isAnimationActive
                />

                {/* main trend line */}
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#54a0ff"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{
                    r: 6,
                    fill: "#54a0ff",
                    stroke: "#fff",
                    strokeWidth: 2,
                    onClick: (_, { payload }) => {
                      if (view === "YEAR") {
                        handlePointClick(payload);
                      }

                      if (view === "MONTH" && payload.revenue > 0) {
                        handlePointClick(payload);
                      }
                    }
                  }}

                  isAnimationActive
                />
              </LineChart>
            </ResponsiveContainer>

          </div>
        </div>

        {/* BAR CHART */}
        <div className="dashboard-barchart">
          <div className="chart-card">
            <h4>Ingredient Stock (All Ingredients)</h4>

            <div className="stock-chart-wrapper">
              <ResponsiveContainer
                width="100%"
                height={Math.max(stockData.length * 31, 100)}
              >
                <BarChart
                  data={stockData}
                  layout="vertical"
                >
                  <XAxis type="number" />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={150}
                  />
                  <Tooltip content={<StockTooltip />} />

                  <Bar dataKey="stock" barSize={3}>
                    {stockData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={getStockColor(entry.stock)}
                      />
                    ))}
                  </Bar>

                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
