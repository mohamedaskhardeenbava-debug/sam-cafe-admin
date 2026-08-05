/**
 * Dashboard.js  —  Sam Cafe Admin Panel
 * Role-aware landing page for "/".
 *
 * Revenue and sales figures are Super-Admin-only information — kitchen
 * and service staff shouldn't see them. Rather than filtering fields out
 * of one shared view, each role group gets routed to the page that
 * already matches what they're allowed to see:
 *
 *   - Super Admin (General Manager, Proprietor) → SalesDashboard
 *       full KPIs, sales/revenue charts, staff salary, schedules.
 *   - Kitchen roles (Sous Chef, Chef)            → KitchenReports
 *       same report kitchen staff already see under Kitchen Management
 *       → Reports. No revenue anywhere in that page.
 *   - Service roles (Captain, Service Manager)    → ServiceReports
 *       same report service staff already see under Service Management
 *       → Reports. No revenue anywhere in that page (the underlying
 *       per-month revenue figure is computed for the Excel export only,
 *       and is stripped there too — see ServiceReports.js).
 *
 * Any other/unrecognized role falls back to KitchenReports rather than
 * the revenue-bearing SalesDashboard, so a future role addition fails
 * closed (no revenue) instead of failing open.
 */
import { useAuth } from "../context/AuthContext";
import SalesDashboard from "./SalesDashboard";
import KitchenReports from "./kitchen/KitchenReports";
import ServiceReports from "./service/ServiceReports";

const KITCHEN_ROLE_TITLES = new Set(["Sous Chef", "Chef"]);
const SERVICE_ROLE_TITLES = new Set(["Captain", "Service Manager"]);

const Dashboard = ({ adminData, setAdminData, orders = [] }) => {
  const { admin } = useAuth();
  const roleTitle = admin?.roleTitle;

  if (admin?.roleGroup === "Super Admin") {
    return <SalesDashboard adminData={adminData} setAdminData={setAdminData} orders={orders} />;
  }

  if (SERVICE_ROLE_TITLES.has(roleTitle)) {
    return <ServiceReports adminData={adminData} />;
  }

  // Kitchen roles, plus the safe default for any unrecognized role.
  return <KitchenReports adminData={adminData} />;
};

export default Dashboard;
