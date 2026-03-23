import { useParams, useNavigate } from "react-router-dom";
import "./OrderDetails.css";
import { formatDisplayDate } from "../App"

const OrderDetails = ({ orders, menu }) => {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const resolveItemTotal = (item) =>
    Number(
      item.totalPrice ??
      (item.price && item.qty ? item.price * item.qty : 0)
    );

  const order = orders.find(o => o.id === orderId);

  if (!order) {
    return <div className="page">Order not found</div>;
  }

  const totalAmount =
    order.totalAmount ??
    order.items.reduce(
      (sum, item) => sum + resolveItemTotal(item),
      0
    );

  const resolveDishRoute = (item) => {
    // Block combo
    if (item.categoryId === "combo") return null;

    // ✅ Make Your Own
    if (item.dishId === "__custom__") {
      return `/dishes/${item.categoryId}/__custom__`;
    }

    if (!menu?.categories) return null;

    for (const category of menu.categories) {

      const dish = (category.dishes || []).find(
        d => d.id === item.dishId
      );

      if (dish) {
        return `/dishes/${category.id}/${dish.id}`;
      }

      for (const sub of category.subCategories || []) {
        const subDish = (sub.dishes || []).find(
          d => d.id === item.dishId
        );

        if (subDish) {
          return `/dishes/${sub.id}/${subDish.id}`;
        }
      }

    }

    return null;
  };

  const normalizeStatus = (status = "") =>
    status.toLowerCase().trim();

  return (
    <div className="order-details-page">
      <div className="order-container">

        {/* HEADER */}
        <div className="order-details-header">
          <button
            className="back-btn"
            onClick={() => navigate(-1)}
          />
          <h2>Order {order.id}</h2>
        </div>

        {/* ORDER INFO */}
        <div className="section">
          <div className="section-title">
            <span>Order Information</span>
          </div>

          <table className="order-info-table">
            <tbody>
              <tr>
                <td><strong>Date:</strong> {formatDisplayDate(order.date)}</td>
                <td><strong>Order ID:</strong> {order.id ?? "-"}</td>
              </tr>
              <tr>
                <td>
                  <strong>Status:</strong>{" "}
                  <span
                    className={`status status-${normalizeStatus(order.status).replace(/\s+/g, "-")}`}
                  >
                    {order.status}
                  </span>
                </td>
                <td><strong>Customer Name:</strong> {order.userName ?? "-"}</td>
              </tr>
              <tr>
                <td><strong>Mode:</strong> {order.mode}</td>
                <td><strong>Table No:</strong> {order.tableNo ?? "-"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ITEMS */}
        <div className="section">
          <div className="section-title">
            <span>Ordered Items</span>
          </div>

          <table className="items-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Dish</th>
                <th>Notes</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Subtotal</th>
              </tr>
            </thead>

            <tbody>
              {order.items.map((item, index) => {
                const itemTotal = resolveItemTotal(item);

                return (
                  <tr key={index}>
                    <td style={{ textTransform: 'capitalize' }}>{item.categoryName || item.categoryId}</td>
                    <td
                      className={item.categoryId === "combo" ? "" : "clickable"}
                      onClick={() => {
                        // ✅ Do nothing for combo items
                        if (item.categoryId === "combo") return;

                        const route = resolveDishRoute(item);
                        if (route) {
                          navigate(route, {
                            state: {
                              fromOrder: true,
                              orderItem: item
                            }
                          });
                        }
                      }}
                    >
                      {item.dishName}
                    </td>
                    <td>{item.notes?.trim() ? item.notes : "-"}</td>
                    <td>{item.quantity ?? item.qty}</td>
                    <td>₹{itemTotal}</td>
                    <td>₹{itemTotal}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* TOTAL */}
        <div className="section">
          <div className="section-title">
            <span>Total Amount</span>
            <p className="order-total">₹{totalAmount}</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default OrderDetails;
