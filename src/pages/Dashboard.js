import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import ScheduleSection from './DashboardScheduleSection';
import * as XLSX from "xlsx";
import dayjs from "dayjs";
import { useToast } from "../useToast";
import {
  PieChart, Pie, Cell, Sector,
  BarChart, Bar,
  XAxis, YAxis, Tooltip,
  ResponsiveContainer, LineChart, Line,
  CartesianGrid, Area
} from "recharts";
import { format } from "date-fns";
import { CustomDatePicker } from "../components/CustomDatePicker";

const COLORS = ["#ff9f43", "#54a0ff", "#FFD700", "#1dd1a1", "#00FFFF", "#e93c3c", "#FFFF00", "#FF8AFF"];
const STAFF_PALETTE = ["#4361ee", "#06d6a0", "#ffd166", "#ef476f", "#7209b7", "#4cc9f0", "#f72585", "#3a0ca3"];

const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 6} outerRadius={outerRadius + 14} startAngle={startAngle} endAngle={endAngle} fill={fill} style={{ transition: "all 0.45s cubic-bezier(0.4,0,0.2,1)", filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.25))" }} />
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize={14} fontWeight={600} fill="#111">{payload.name}</text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize={13} fill="#555">{value}% (₹{payload.amount})</text>
    </g>
  );
};

const SalaryActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 5} outerRadius={outerRadius + 12} startAngle={startAngle} endAngle={endAngle} fill={fill} style={{ filter: `drop-shadow(0 0 12px ${fill}66)` }} />
      <text x={cx} y={cy - 10} textAnchor="middle" fontSize={13} fontWeight={700} fill="#111">{payload.name}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={12} fill="#555">₹{Number(value).toLocaleString("en-IN")}</text>
    </g>
  );
};

const applyAutoColumnWidth = (sheet, rows) => {
  if (!rows.length) return;
  sheet["!cols"] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? "").length)) + 2 }));
};

const NoChartData = ({ message = "No data available" }) => (
  <div style={{ height: "100%", minHeight: 80, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontWeight: 500, fontSize: 13 }}>{message}</div>
);

const getThisMonthDates = () => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const dates = [];
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${day}`);
  }
  return dates;
};

const Dashboard = ({ adminData, setAdminData, orders = [] }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const ingredients = adminData.ingredients || [];
  const staff = adminData.staff || [];
  const [activeIndex, setActiveIndex] = useState(null);
  const [activeSalIdx, setActiveSalIdx] = useState(null);
  const today = format(new Date(), "yyyy-MM-dd");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [modeFilters, setModeFilters] = useState(new Set());
  const [statusFilters, setStatusFilters] = useState(new Set());
  const toggleFilter = (setter, val) => setter(prev => { const n = new Set(prev); n.has(val) ? n.delete(val) : n.add(val); return n; });
  const [datePreset, setDatePreset] = useState("today");

  // Staff table sorting
  const [staffSortKey, setStaffSortKey] = useState("name");
  const [staffSortDir, setStaffSortDir] = useState("asc");

  const fmtDate = (d) => {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const applyPreset = React.useCallback((preset) => {
    const now = new Date();
    if (preset === "today") {
      setFromDate(today); setToDate(today);
    } else if (preset === "weekly") {
      // Sunday to Saturday of the current week
      const sunday = new Date(now);
      sunday.setDate(now.getDate() - now.getDay());
      const saturday = new Date(sunday);
      saturday.setDate(sunday.getDate() + 6);
      setFromDate(fmtDate(sunday)); setToDate(fmtDate(saturday));
    } else if (preset === "monthly") {
      // 1st to last day of current month
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setFromDate(fmtDate(first)); setToDate(fmtDate(last));
    }
    setDatePreset(preset);
  }, [today]);

  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const roundTo = (v, d = 2) => Math.round((Number(v) + Number.EPSILON) * 10 ** d) / 10 ** d;
  const resolveQty = (item) => Number(item.qty ?? item.quantity ?? 0);
  const resolveUnitPrice = (item) => item.price != null ? Number(item.price) : resolveQty(item) > 0 ? Number(item.totalPrice || 0) / resolveQty(item) : 0;
  const resolveRevenue = (item) => Number(item.totalPrice ?? resolveUnitPrice(item) * resolveQty(item));

  const baseFilteredOrders = useMemo(() => {
    const from = new Date(fromDate); from.setHours(0, 0, 0, 0);
    const to = new Date(toDate); to.setHours(23, 59, 59, 999);
    return orders.filter(o => { const d = new Date(o.date); return d >= from && d <= to; });
  }, [orders, fromDate, toDate]);

  const modeFilteredOrders = useMemo(() => modeFilters.size === 0 ? baseFilteredOrders : baseFilteredOrders.filter(o => modeFilters.has((o.mode || "take away").toLowerCase())), [baseFilteredOrders, modeFilters]);
  const statusFilteredOrders = useMemo(() => statusFilters.size === 0 ? baseFilteredOrders : baseFilteredOrders.filter(o => statusFilters.has(o.status?.toLowerCase())), [baseFilteredOrders, statusFilters]);

  const itemStats = useMemo(() => {
    const stats = { total: 0, placed: 0, preparing: 0, servicePickup: 0, completed: 0 };
    const source = modeFilters.size > 0 ? modeFilteredOrders : statusFilters.size > 0 ? statusFilteredOrders : baseFilteredOrders;
    source.forEach(o => { o.items.forEach(i => { const qty = Number(i.quantity ?? 0); const s = i.status?.toLowerCase(); stats.total += qty; if (s === "placed") stats.placed += qty; else if (s === "preparing") stats.preparing += qty; else if (s === "service pickup") stats.servicePickup += qty; else if (s === "completed") stats.completed += qty; }); });
    return stats;
  }, [baseFilteredOrders, modeFilteredOrders, statusFilteredOrders, modeFilters, statusFilters]);

  const orderModeStats = useMemo(() => { let dineIn = 0, takeaway = 0; baseFilteredOrders.forEach(o => { const m = (o.mode || "").toLowerCase(); if (m === "dine in") dineIn++; else takeaway++; }); return { dineIn, takeaway }; }, [baseFilteredOrders]);
  const hasOrders = baseFilteredOrders.length > 0;
  const totalSales = baseFilteredOrders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + resolveRevenue(i), 0), 0);
  const totalOrders = baseFilteredOrders.length;

  const previousOrders = useMemo(() => { const ms = new Date(toDate).getTime() - new Date(fromDate).getTime(); const pf = new Date(new Date(fromDate).getTime() - ms), pt = new Date(fromDate); return orders.filter(o => { const d = new Date(o.date); return d >= pf && d < pt; }); }, [orders, fromDate, toDate]);
  const previousSales = previousOrders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + resolveRevenue(i), 0), 0);
  let salesChange = previousSales === 0 ? (totalSales > 0 ? 100 : 0) : Number(((totalSales - previousSales) / previousSales * 100).toFixed(1));

  const categorySales = useMemo(() => {
    const map = {}; let grand = 0;
    baseFilteredOrders.forEach(o => { o.items.forEach(i => { const a = resolveRevenue(i); if (!a) return; grand += a; map[i.categoryId] = (map[i.categoryId] || 0) + a; }); });
    if (!grand) return [];
    return Object.entries(map).map(([id, v]) => {
      let label = id;
      for (const c of adminData.categories) { if (c.id === id) { label = c.name; break; } const s = (c.subCategories || []).find(s => s.id === id); if (s) { label = s.name; break; } }
      return { name: label, value: Number(((v / grand) * 100).toFixed(1)), amount: v };
    });
  }, [baseFilteredOrders]);

  const categoryItemSummary = useMemo(() => {
    const map = {}; let gRev = 0;
    baseFilteredOrders.forEach(o => { o.items.forEach(i => { const c = i.categoryId || "unknown"; if (!map[c]) map[c] = { category: c, itemsSold: 0, revenue: 0 }; map[c].itemsSold += resolveQty(i); map[c].revenue += resolveRevenue(i); gRev += resolveRevenue(i); }); });
    return Object.values(map).map(r => ({ Category: r.category, "Items Sold": r.itemsSold, "Total Revenue": r.revenue, "Revenue %": gRev > 0 ? Number(((r.revenue / gRev) * 100).toFixed(2)) : 0 }));
  }, [baseFilteredOrders]);

  const stockData = useMemo(() => ingredients.map(ing => { const rem = roundTo(ing.stockRemaining ?? 0, 2); const mx = Number(ing.stockMax ?? 0); const pct = mx > 0 ? Math.round((rem / mx) * 100) : 0; return { name: ing.name, stock: rem, stockMax: mx, percent: pct }; }).sort((a, b) => a.percent - b.percent), [ingredients]);
  const getStockColor = (v) => v >= 60 ? "#1dd1a1" : v >= 35 ? "#ff9f43" : "#ee5253";
  const dailyRevenue = useMemo(() => { const map = {}; baseFilteredOrders.forEach(o => { o.items.forEach(i => { map[o.date] = (map[o.date] || 0) + resolveRevenue(i); }); }); return Object.entries(map).sort(([a], [b]) => new Date(a) - new Date(b)).map(([date, revenue]) => ({ date, revenue })); }, [baseFilteredOrders]);
  const monthlyRevenue = useMemo(() => { const map = {}; baseFilteredOrders.forEach(o => { const month = format(new Date(o.date), "yyyy-MM"); o.items.forEach(i => { map[month] = (map[month] || 0) + resolveRevenue(i); }); }); return Object.entries(map).sort(([a], [b]) => new Date(a) - new Date(b)).map(([month, revenue]) => ({ month, revenue })); }, [baseFilteredOrders]);
  const revenueTrendData = useMemo(() => dailyRevenue.map(d => { const mk = d.date.slice(0, 7); const md = monthlyRevenue.find(m => m.month === mk); return { date: d.date, dailyRevenue: d.revenue, monthlyRevenue: md ? md.revenue : 0 }; }), [dailyRevenue, monthlyRevenue]);

  const monthDates = getThisMonthDates();
  const workingDays = monthDates.length;

  const staffStats = useMemo(() => staff.map(s => {
    const att = s.attendance || [];
    const present = att.filter(a => a.status === "present").length;
    const leave = att.filter(a => a.status === "leave").length;
    const absent = att.filter(a => a.status === "absent").length;
    const salary = Number(s.salary) || 0;
    const advance = (s.remainingSalary || []).reduce((sum, r) => sum + Number(r.advance || 0), 0);
    const deduction = (s.remainingSalary || []).reduce((sum, r) => sum + Number(r.deduction || 0) + Number(r.penalty || 0), 0);
    const kDates = adminData.grooming?.[s.id] || {};
    const sDates = adminData.serviceGrooming?.[s.id] || {};
    const kTotal = Object.values(kDates).filter(d => typeof d === "object" && d !== null).length;
    const sTotal = Object.values(sDates).filter(d => typeof d === "object" && d !== null).length;
    const kPassed = Object.values(kDates).filter(d => d?.uniform && d?.shoes && d?.groom).length;
    const sPassed = Object.values(sDates).filter(d => d?.uniform && d?.shoes && d?.groom).length;
    const groomTotal = Math.max(kTotal, sTotal, 1);
    const groomPassed = kTotal >= sTotal ? kPassed : sPassed;
    const groomPct = Math.min(100, Math.round((groomPassed / groomTotal) * 100));
    const totalTracked = present + leave + absent;
    const attPct = totalTracked > 0 ? Math.round((present / totalTracked) * 100) : 0;
    return { id: s.id, name: s.name, role: s.role || "Staff", salary, advance, deduction, present, leave, absent, attPct, groomPct };
  }), [staff, adminData.grooming, adminData.serviceGrooming, workingDays]);

  const sortedStaffStats = useMemo(() => {
    return [...staffStats].sort((a, b) => {
      const aVal = String(a[staffSortKey] ?? "").toLowerCase();
      const bVal = String(b[staffSortKey] ?? "").toLowerCase();
      return staffSortDir === "asc" ? aVal.localeCompare(bVal, undefined, { numeric: true }) : bVal.localeCompare(aVal, undefined, { numeric: true });
    });
  }, [staffStats, staffSortKey, staffSortDir]);

  const toggleStaffSort = (key) => {
    if (staffSortKey === key) setStaffSortDir(d => d === "asc" ? "desc" : "asc");
    else { setStaffSortKey(key); setStaffSortDir("asc"); }
  };

  const SortIcon = ({ col }) => {
    if (staffSortKey !== col) return <span style={{ color: "#bbb", fontSize: 10 }}>⇅</span>;
    return <span style={{ fontSize: 10 }}>{staffSortDir === "asc" ? "↑" : "↓"}</span>;
  };

  const staffSummary = useMemo(() => ({
    total: staff.length,
    fullTime: staff.filter(s => s.workType === "full-time").length,
    partTime: staff.filter(s => s.workType !== "full-time").length,
    totalSalaryBill: staffStats.reduce((s, x) => s + x.salary, 0),
    totalAdvance: staffStats.reduce((s, x) => s + x.advance, 0),
    avgAttendance: staffStats.length > 0 ? Math.round(staffStats.reduce((s, x) => s + x.attPct, 0) / staffStats.length) : 0,
  }), [staffStats]);

  const attendanceBarData = staffStats.map(s => ({ name: s.name.split(" ")[0], Present: s.present, Leave: s.leave, Absent: s.absent, pct: s.attPct }));
  const salaryPieData = staffStats.map((s, i) => ({ name: s.name.split(" ")[0], value: s.salary, color: STAFF_PALETTE[i % STAFF_PALETTE.length], role: s.role }));
  const groomBarData = staffStats.map((s, i) => ({ name: s.name.split(" ")[0], value: s.groomPct, color: STAFF_PALETTE[i % STAFF_PALETTE.length] }));

  const TrendTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (<div className="trend-tooltip"><div className="trend-tooltip-label">{label}</div><div className="trend-tooltip-value">₹{num(payload[0].value).toLocaleString()}</div></div>);
  };
  const StockTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const { name, stock, stockMax, percent } = payload[0].payload;
    const color = getStockColor(percent);
    return (<div className="trend-tooltip"><div className="trend-tooltip-label" style={{ color }}>{name}</div><div className="trend-tooltip-value" style={{ color }}>{roundTo(stock, 2)}/{roundTo(stockMax, 2)} kg ({percent}%)</div></div>);
  };
  const AttTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (<div className="trend-tooltip"><div className="trend-tooltip-label">{label}</div>{payload.map((p, i) => (<div key={i} style={{ color: p.color, fontWeight: 600, fontSize: 13 }}>{p.name}: {p.value}</div>))}</div>);
  };
  const SalaryTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (<div className="trend-tooltip"><div className="trend-tooltip-label">{d.name}</div><div className="trend-tooltip-value" style={{ color: d.color }}>₹{Number(d.value).toLocaleString("en-IN")}</div>{d.role && <div style={{ fontSize: 11, color: "#888" }}>{d.role}</div>}</div>);
  };

  const handleExport = () => {
    if (!baseFilteredOrders.length) { toast.warning("No data available for selected date range"); return; }
    const orderRows = [];
    baseFilteredOrders.forEach(order => { order.items.forEach(item => { const isCustom = Array.isArray(item.ingredients) && item.ingredients.length > 0 || Boolean(item.notes); orderRows.push({ OrderID: order.id, Date: order.date, Time: order.time ?? new Date(order.createdAt).toLocaleTimeString(), Customer: order.userName || "", Category: item.categoryId, Dish: item.dishName, Quantity: resolveQty(item), Customized: isCustom ? "Yes" : "No", UnitPrice: resolveUnitPrice(item), TotalPrice: resolveRevenue(item) }); }); });
    const ws = XLSX.utils.json_to_sheet(orderRows); applyAutoColumnWidth(ws, orderRows);
    const drSheet = XLSX.utils.json_to_sheet(dailyRevenue.map(r => ({ Date: r.date, TotalRevenue: r.revenue }))); applyAutoColumnWidth(drSheet, [{ Date: "", TotalRevenue: 0 }]);
    const catSheet = XLSX.utils.json_to_sheet(categoryItemSummary); applyAutoColumnWidth(catSheet, categoryItemSummary);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    XLSX.utils.book_append_sheet(wb, drSheet, "Daily Revenue");
    XLSX.utils.book_append_sheet(wb, catSheet, "Category Sales Summary");
    XLSX.writeFile(wb, `dashboard_${fromDate}_to_${toDate}.xlsx`);
  };

  return (
    <div className="dashboard-page">
      {/* HEADER */}
      <div className="dashboard-header">
        <h2 className="dashboard-title">Dashboard</h2>
        <div className="dashboard-kpi-row-inheader">
          <div className="kpi-card kpi-small"><p>Total Orders</p><h3>{totalOrders}</h3></div>
          <div className={`kpi-card kpi-small link ${modeFilters.has("dine in") ? "active" : ""}`} onClick={() => toggleFilter(setModeFilters, "dine in")} onDoubleClick={() => navigate("/orders", { state: { mode: "dine in", fromDate, toDate } })}><p>Dine In</p><h3>{orderModeStats.dineIn}</h3></div>
          <div className={`kpi-card kpi-small link ${modeFilters.has("take away") ? "active" : ""}`} onClick={() => toggleFilter(setModeFilters, "take away")} onDoubleClick={() => navigate("/orders", { state: { mode: "take away", fromDate, toDate } })}><p>Take Away</p><h3>{orderModeStats.takeaway}</h3></div>
        </div>
      </div>

      {/* DATE FILTER */}
      <div className="dashboard-filter">
        <div className="dashboard-filter-date">
          <div className="dash-preset-btns">
            {[["today", "Today"], ["weekly", "This Week"], ["monthly", "This Month"]].map(([k, lbl]) => (
              <button key={k} className={`dash-preset-btn${datePreset === k ? " active" : ""}`} onClick={() => applyPreset(k)}>{lbl}</button>
            ))}
          </div>
          <div className = "dashboard-custom-datepickers">
            <CustomDatePicker label="From" value={fromDate} max={toDate} onChange={(s) => { setFromDate(s); if (s > toDate) setToDate(s); setDatePreset("custom"); }} />
            <CustomDatePicker label="To" value={toDate} min={fromDate} max={today} onChange={(s) => { setToDate(s); setDatePreset("custom"); }} />
          </div>
        </div>
        <button className="dashboard-export-btn" onClick={handleExport}>Export</button>
        <div className="dashboard-filter-kpis">
          <div className="dashboard-kpi-row">
            <div className="kpi-card kpi-small"><p>Total Items</p><h3>{itemStats.total}</h3></div>
            <div className={"kpi-card status-placed kpi-small link"} onClick={() => { toggleFilter(setStatusFilters, "placed"); navigate("/orders", { state: { status: "placed", fromDate, toDate } }); }}><p>Placed</p><h3>{itemStats.placed}</h3></div>
            <div className={"kpi-card kpi-small status-preparing link"} onClick={() => { toggleFilter(setStatusFilters, "preparing"); navigate("/orders", { state: { status: "preparing", fromDate, toDate } }); }}><p>Preparing</p><h3>{itemStats.preparing}</h3></div>
            <div className={"kpi-card kpi-small status-service-pickup link"} onClick={() => { toggleFilter(setStatusFilters, "service pickup"); navigate("/orders", { state: { status: "service pickup", fromDate, toDate } }); }}><p>Service Pickup</p><h3>{itemStats.servicePickup}</h3></div>
            <div className={"kpi-card kpi-small status-completed link"} onClick={() => { toggleFilter(setStatusFilters, "completed"); navigate("/orders", { state: { status: "completed", fromDate, toDate } }); }}><p>Completed</p><h3>{itemStats.completed}</h3></div>
          </div>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div className="dashboard-main-layout">
        <div className="dashboard-piechart">
          <div className="dashboard-kpis">
            <div className="kpi-card"><p>Total Sales</p><h3>₹{totalSales}</h3></div>
            <div className="kpi-card"><p>Total Orders</p><h3>{totalOrders}</h3></div>
            <div className={`kpi-card ${salesChange >= 0 ? "positive" : "negative"}`}><p>Sales Change</p><h3>{salesChange}%</h3></div>
          </div>
          <div className="chart-card pie">
            <h4>Category-wise Sales (%)</h4>
            {categorySales.length === 0 ? <NoChartData message="No category sales data" /> : (
              <ResponsiveContainer width="100%" height={260}>
                {hasOrders ? (
                  <PieChart>
                    <Pie data={categorySales} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} isAnimationActive animationBegin={100} animationDuration={800} animationEasing="cubic-bezier(0.4,0,0.2,1)" activeIndex={activeIndex} activeShape={renderActiveShape} onMouseEnter={(_, i) => setActiveIndex(i)} onMouseLeave={() => setActiveIndex(null)}
                      onClick={(data) => {
                        // FIX: guard against null/undefined data before navigating
                        if (data && data.name) {
                          navigate("/orders", { state: { category: data.name, fromDate, toDate } });
                        }
                      }}>
                      {categorySales.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                ) : <p className="empty-state">No data for selected date range</p>}
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="dashboard-linechart">
          <div className="chart-card line">
            <div className="chart-header"><h4>Revenue Trend</h4></div>
            {revenueTrendData.length === 0 ? <NoChartData message="No revenue data for selected period" /> : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={revenueTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#e3e3e3" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#777" }} tickFormatter={(d) => format(new Date(d), "dd MMM")} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#777" }} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip content={<TrendTooltip />} />
                  <defs><linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#54a0ff" stopOpacity={0.25} /><stop offset="100%" stopColor="#54a0ff" stopOpacity={0} /></linearGradient></defs>
                  <Area type="monotone" dataKey="dailyRevenue" stroke="none" fill="url(#trendGradient)" isAnimationActive />
                  <Line type="monotone" dataKey="dailyRevenue" stroke="#54a0ff" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: "#54a0ff", stroke: "#fff", strokeWidth: 2 }} isAnimationActive />
                  <Line type="monotone" dataKey="monthlyRevenue" stroke="#ff9f43" strokeWidth={3} dot={false} name="Monthly Revenue" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* BAR CHART – INGREDIENT STOCK */}
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
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#aaa" }} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={120}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "#111" }}
                    />
                    <Tooltip content={<StockTooltip />} />
                    <Bar dataKey="stock" barSize={4} radius={[0, 3, 3, 0]}>
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

      {/* STAFF OVERVIEW */}
      <div className="staff-section-title">
        <h3>Staff Overview</h3>
        <span className="staff-section-sub">Month-to-date analytics</span>
      </div>

      {/* STAFF KPIs */}
      <div className="staff-kpi-row">
        {[
          { label: "Total Staff", value: staffSummary.total, bg: "#e8f4fd", nav: "/staffs", state: {} },
          { label: "Full-Time", value: staffSummary.fullTime, bg: "#e8fdf4", nav: "/staffs", state: { workType: "full-time" } },
          { label: "Part-Time", value: staffSummary.partTime, bg: "#fff8e8", nav: "/staffs", state: { workType: "part-time" } },
          { label: "Salary Bill", value: `₹${staffSummary.totalSalaryBill.toLocaleString("en-IN")}`, bg: "#fde8e8", nav: "/staffs", state: {} },
          { label: "Avg Attendance", value: `${staffSummary.avgAttendance}%`, bg: "#f3e8fd", nav: "/staff-attendance", state: {} },
          { label: "Total Advance", value: `₹${staffSummary.totalAdvance.toLocaleString("en-IN")}`, bg: "#e8f4fd", nav: "/staffs", state: {} },
        ].map((k, i) => (
          <div key={i} className="staff-kpi-card" style={{ cursor: "pointer" }} onClick={() => navigate(k.nav, { state: k.state })}>
            <div><p>{k.label}</p><h3>{k.value}</h3></div>
          </div>
        ))}
      </div>

      {/* STAFF CHARTS */}
      <div className="staff-charts-grid">
        <div className="chart-card sc-card">
          <div className="sc-card-head">
            <h4>Attendance This Month</h4>
            <div className="sc-legend-pills">
              <span className="sc-pill" style={{ "--c": "#1dd1a1" }}>Present</span>
              <span className="sc-pill" style={{ "--c": "#ee5253" }}>Leave</span>
              <span className="sc-pill" style={{ "--c": "#d1d5db" }}>Absent</span>
            </div>
          </div>
          {attendanceBarData.length === 0 ? <NoChartData /> : (
            <div className="sc-att-rows">
              {attendanceBarData.map((s, i) => (
                <div key={i} className="sc-att-row">
                  <div className="sc-att-dot" style={{ background: STAFF_PALETTE[i % STAFF_PALETTE.length] }}>{s.name.charAt(0)}</div>
                  <span className="sc-att-name">{s.name}</span>
                  <div className="sc-att-track">
                    <div className="sc-att-fill" style={{ width: `${s.pct}%`, background: s.pct >= 75 ? "#1dd1a1" : s.pct >= 50 ? "#ff9f43" : "#ee5253" }} />
                  </div>
                  <span className="sc-att-pct" style={{ color: s.pct >= 75 ? "#1dd1a1" : s.pct >= 50 ? "#ff9f43" : "#ee5253" }}>{s.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="chart-card sc-card">
          <div className="sc-card-head">
            <h4>Salary Distribution</h4>
            <span className="sc-total-badge">₹{staffSummary.totalSalaryBill.toLocaleString("en-IN")}</span>
          </div>
          {salaryPieData.length === 0 ? <NoChartData /> : (
            <div className="sc-salary-wrap">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={salaryPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={82} isAnimationActive animationDuration={700} activeIndex={activeSalIdx} activeShape={<SalaryActiveShape />} onMouseEnter={(_, i) => setActiveSalIdx(i)} onMouseLeave={() => setActiveSalIdx(null)}>
                    {salaryPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip content={<SalaryTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="sc-salary-legend">
                <div className="sc-sal-header">
                  <span>Staff</span><span>Salary</span><span>Share</span>
                </div>
                {salaryPieData.map((s, i) => (
                  <div key={i} className={`sc-sal-row ${activeSalIdx === i ? "sc-sal-active" : ""}`} onMouseEnter={() => setActiveSalIdx(i)} onMouseLeave={() => setActiveSalIdx(null)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span className="sc-sal-dot" style={{ background: s.color }} />
                      <span className="sc-sal-name">{s.name}</span>
                    </div>
                    <span className="sc-sal-amount">₹{Number(s.value).toLocaleString("en-IN")}</span>
                    <span className="sc-sal-pct-val">{staffSummary.totalSalaryBill > 0 ? Math.round((s.value / staffSummary.totalSalaryBill) * 100) : 0}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="chart-card sc-card">
          <div className="sc-card-head">
            <h4>Grooming Compliance</h4>
            <span className="sc-week-badge">7-day avg</span>
          </div>
          {groomBarData.length === 0 ? <NoChartData /> : (
            <div className="sc-groom-list">
              {groomBarData.map((g, i) => (
                <div key={i} className="sc-groom-row">
                  <div className="sc-groom-avatar" style={{ background: g.color }}>{g.name.charAt(0)}</div>
                  <span className="sc-groom-name">{g.name}</span>
                  <div className="sc-groom-track">
                    <div className="sc-groom-fill" style={{ width: `${g.value}%`, background: g.value >= 80 ? "#1dd1a1" : g.value >= 50 ? "#ff9f43" : "#ee5253" }} />
                  </div>
                  <div className="sc-groom-badge" style={{ background: g.value >= 80 ? "#dcfce7" : g.value >= 50 ? "#fff7e0" : "#fee2e2", color: g.value >= 80 ? "#16a34a" : g.value >= 50 ? "#d97706" : "#dc2626" }}>
                    {g.value}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="chart-card sc-card sc-schedules-card">
          <div className="sc-card-head">
            <h4>Schedules Overview</h4>
          </div>
          <ScheduleSection adminData={adminData} navigate={navigate} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;