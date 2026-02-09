import React, { useEffect, useMemo, useState } from "react";
import "./Dashboard.css";
import * as XLSX from "xlsx";
import { EmptyRow } from "../App";

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

const applyAutoColumnWidth = (sheet, rows) => {
  if (!rows.length) return;

  sheet["!cols"] = Object.keys(rows[0]).map(key => ({
    wch: Math.max(
      key.length,
      ...rows.map(r => String(r[key] ?? "").length)
    ) + 2
  }));
};

const NoChartData = ({ message = "No data available" }) => (
  <div
    style={{
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#777",
      fontWeight: 500
    }}
  >
    {message}
  </div>
);

const Dashboard = ({ adminData, orders = [] }) => {
  const ingredients = adminData.ingredients || [];
  const [activeIndex, setActiveIndex] = useState(null);

  const today = format(new Date(), "yyyy-MM-dd");
  const [fromDate, setFromDate] = useState(
    format(subDays(new Date(), 7), "yyyy-MM-dd")
  );
  const [toDate, setToDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );

  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const roundTo = (value, decimals = 2) =>
    Math.round((Number(value) + Number.EPSILON) * 10 ** decimals) /
    10 ** decimals;

  const resolveQty = (item) =>
    Number(item.qty ?? item.quantity ?? 0);

  const resolveUnitPrice = (item) =>
    item.price != null
      ? Number(item.price)
      : resolveQty(item) > 0
        ? Number(item.totalPrice || 0) / resolveQty(item)
        : 0;

  const resolveRevenue = (item) =>
    Number(item.totalPrice ?? resolveUnitPrice(item) * resolveQty(item));

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

  const hasOrders = filteredOrders.length > 0;

  const handleExport = () => {
    if (filteredOrders.length === 0) {
      alert("No data available for selected date range");
      return;
    }

    /* ---------- SHEET 1: ORDERS ---------- */
    const orderRows = [];

    filteredOrders.forEach(order => {
      order.items.forEach(item => {

        const isCustomized =
          Array.isArray(item.ingredients) && item.ingredients.length > 0 ||
          Boolean(item.notes);

        const ingredientsText = isCustomized
          ? item.ingredients
            ?.map(ing => `${ing.name} - ${ing.quantity}g`)
            .join(", ")
          : "-";

        orderRows.push({
          OrderID: order.id,
          Date: order.date,
          Time: order.time ?? new Date(order.createdAt).toLocaleTimeString(),
          Customer: order.userName || "",
          Category: item.categoryId,
          Dish: item.dishName,
          Quantity: resolveQty(item),
          Customized: isCustomized ? "Yes" : "No",
          Ingredients: ingredientsText,
          UnitPrice: resolveUnitPrice(item),
          TotalPrice: resolveRevenue(item)
        });
      });
    });

    const ordersSheet = XLSX.utils.json_to_sheet(orderRows);
    applyAutoColumnWidth(ordersSheet, orderRows);

    /* ---------- SHEET 3: CATEGORY SALES SUMMARY ---------- */
    const categorySheet =
      XLSX.utils.json_to_sheet(categoryItemSummary);

    applyAutoColumnWidth(categorySheet, categoryItemSummary);

    /* ---------- SHEET 2: DAILY REVENUE ---------- */
    const dailyRevenueRows = dailyRevenue.map(row => ({
      Date: row.date,
      TotalRevenue: row.revenue
    }));

    const dailyRevenueSheet =
      XLSX.utils.json_to_sheet(dailyRevenueRows);

    applyAutoColumnWidth(dailyRevenueSheet, dailyRevenueRows);

    /* ---------- WORKBOOK ---------- */
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, ordersSheet, "Orders");
    XLSX.utils.book_append_sheet(workbook, dailyRevenueSheet, "Daily Revenue");
    XLSX.utils.book_append_sheet(
      workbook,
      categorySheet,
      "Category Sales Summary"
    );

    XLSX.writeFile(
      workbook,
      `dashboard_${fromDate}_to_${toDate}.xlsx`
    );
  };

  /* ---------------- KPIs ---------------- */
  const totalSales = filteredOrders.reduce(
    (sum, order) =>
      sum +
      order.items.reduce(
        (s, item) => s + resolveRevenue(item),
        0
      ),
    0
  );

  const totalOrders = filteredOrders.reduce(
    (sum, order) =>
      sum +
      (order.items || []).reduce(
        (s, item) => s + resolveQty(item),
        0
      ),
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
        (s, item) => s + resolveRevenue(item),
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
        const amount = resolveRevenue(item);
        if (amount <= 0) return;

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

  const categoryItemSummary = useMemo(() => {
    const map = {};
    let grandRevenue = 0;

    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        const category = item.categoryId || "unknown";
        const qty = resolveQty(item);
        const revenue = resolveRevenue(item);

        if (!map[category]) {
          map[category] = {
            category,
            itemsSold: 0,
            revenue: 0
          };
        }

        map[category].itemsSold += qty;
        map[category].revenue += revenue;
        grandRevenue += revenue;
      });
    });

    return Object.values(map).map(row => ({
      Category: row.category,
      "Items Sold": row.itemsSold,
      "Total Revenue": row.revenue,
      "Revenue %":
        grandRevenue > 0
          ? Number(((row.revenue / grandRevenue) * 100).toFixed(2))
          : 0
    }));
  }, [filteredOrders]);

  /* ---------------- ALL INGREDIENT STOCK ---------------- */
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

  const getStockColor = (value) => {
    if (value >= 60) return "#1dd1a1";
    if (value >= 35) return "#ff9f43";
    return "#ee5253";
  };

  const dailyRevenue = useMemo(() => {
    const map = {};

    filteredOrders.forEach(order => {
      const date = order.date;

      order.items.forEach(item => {
        const revenue = resolveRevenue(item);
        map[date] = (map[date] || 0) + revenue;
      });
    });

    return Object.entries(map)
      .sort(([a], [b]) => new Date(a) - new Date(b))
      .map(([date, revenue]) => ({
        date,
        revenue
      }));
  }, [filteredOrders]);

  const monthlyRevenue = useMemo(() => {
    const map = {};

    filteredOrders.forEach(order => {
      // YYYY-MM
      const month = format(new Date(order.date), "yyyy-MM");

      order.items.forEach(item => {
        const revenue = resolveRevenue(item);
        map[month] = (map[month] || 0) + revenue;
      });
    });

    return Object.entries(map)
      .sort(([a], [b]) => new Date(a) - new Date(b))
      .map(([month, revenue]) => ({
        month,
        revenue
      }));
  }, [filteredOrders]);

  const revenueTrendData = useMemo(() => {
    return dailyRevenue.map(d => {
      const monthKey = d.date.slice(0, 7); // YYYY-MM
      const monthData = monthlyRevenue.find(m => m.month === monthKey);

      return {
        date: d.date,
        dailyRevenue: d.revenue,
        monthlyRevenue: monthData ? monthData.revenue : 0
      };
    });
  }, [dailyRevenue, monthlyRevenue]);

  const TrendTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;

    const value = payload[0].value;

    return (
      <div className="trend-tooltip">
        <div className="trend-tooltip-label">{label}</div>

        <div className="trend-tooltip-value">
          ₹{num(value).toLocaleString()}
        </div>
      </div>
    );
  };

  const MonthlyTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;

    // Find monthly line payload
    const monthly = payload.find(
      p => p.dataKey === "monthlyRevenue"
    );

    if (!monthly || !monthly.value) return null;

    const month =
      monthly.payload.date.slice(0, 7); // YYYY-MM

    return (
      <div className="trend-tooltip">
        <div className="trend-tooltip-label">
          Month: {month}
        </div>

        <div className="trend-tooltip-value">
          ₹{Number(monthly.value).toLocaleString()}
        </div>
      </div>
    );
  };

  const StockTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;

    const { name, stock, stockMax, percent } = payload[0].payload;
    const color = getStockColor(percent);

    return (
      <div
        className="trend-tooltip"
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
    <div className="dashboard-page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 className="dashboard-title">Dashboard</h2>

        <button
          className="dashboard-export-btn"
          onClick={handleExport}
        >
          Export
        </button>
      </div>

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

            {categorySales.length === 0 ? (
              <NoChartData message="No category sales data" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                {hasOrders ? (
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
                ) : (
                  <p className="empty-state">No data for selected date range</p>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* LINE CHART */}
        <div className="dashboard-linechart">
          <div className="chart-card line">
            <div className="chart-header">
              <h4>
                Revenue Trend
              </h4>
            </div>

            {revenueTrendData.length === 0 ? (
              <NoChartData message="No revenue data for selected period" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={revenueTrendData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                >
                  {/* subtle grid (Y only) */}
                  <CartesianGrid
                    vertical={false}
                    stroke="#e3e3e3"
                  //strokeDasharray="3 3"
                  />

                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#777" }}
                    tickFormatter={(date) =>
                      format(new Date(date), "dd MMM")
                    }
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
                    dataKey="dailyRevenue"
                    stroke="none"
                    fill="url(#trendGradient)"
                    isAnimationActive
                  />

                  {/* main trend line */}
                  <Line
                    type="monotone"
                    dataKey="dailyRevenue"
                    stroke="#54a0ff"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{
                      r: 6,
                      fill: "#54a0ff",
                      stroke: "#fff",
                      strokeWidth: 2,
                    }}

                    isAnimationActive
                  />

                  <Line
                    type="monotone"
                    dataKey="monthlyRevenue"
                    stroke="#ff9f43"
                    strokeWidth={3}
                    dot={false}
                    name="Monthly Revenue"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* BAR CHART */}
        <div className="dashboard-barchart">
          <div className="chart-card bar">
            <h4>Ingredient Stock</h4>

            <div className="stock-chart-wrapper">
              {stockData.length === 0 ? (
                <NoChartData message="No stock data available" />
              ) : (
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

                    <Bar dataKey="stock" barSize={2}>
                      {stockData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={getStockColor(entry.percent)}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
