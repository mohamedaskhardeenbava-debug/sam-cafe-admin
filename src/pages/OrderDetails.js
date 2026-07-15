/**
 * OrderDetails.js  —  Sam Cafe Admin Panel
 * Single order detail page
 */

import { useParams, useNavigate } from "react-router-dom";

import { formatDisplayDate } from "../App"

import "./OrderDetails.css";

const OrderDetails = ({ orders, menu }) => {
  // ── Hooks

  const { orderId } = useParams();
  const navigate = useNavigate();

  // ── Helpers

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

    // Make Your Own
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
      <div className="details-container">

        {/* HEADER */}
        <div className="details-header">
          <button
            className="back-btn"
            onClick={() => navigate(-1)}
          />
          <h2>Order {order.id}</h2>
        </div>

        <div className="details-body">
          {/* ORDER INFO */}
          <div className="section">
            <div className="section-title">
              <span>Order Information</span>
            </div>

            <table className="data-table">
              <tbody>
                <tr>
                  <td><strong>Date:</strong> {formatDisplayDate(order.date)}</td>
                  <td><strong>Order ID:</strong> {order.id ?? "-"}</td>
                </tr>
                <tr>
                  <td>
                    <strong>Status:</strong>{" "}
                    <span
                      className={`dd-status status-${normalizeStatus(order.status).replace(/\s+/g, "-")}`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td><strong>Customer Name:</strong> {order.userName ?? "-"}</td>
                </tr>
                {normalizeStatus(order.status) === "cancelled" && order.cancelReason && (
                  <tr>
                    <td colSpan={2}>
                      <strong>Cancellation Reason:</strong> {order.cancelReason}
                    </td>
                  </tr>
                )}
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

            <table className="data-table">
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
                  const qty = Number(item.quantity ?? item.qty ?? 1) || 1;
                  const unitPrice = item.price != null
                    ? Number(item.price)
                    : +(itemTotal / qty).toFixed(2);

                  return (
                    <tr key={index}>
                      <td style={{ textTransform: 'capitalize' }}>{item.categoryName || item.categoryId}</td>
                      <td>
                        <span
                          className={item.categoryId === "combo" ? "" : "clickable"}
                          onClick={() => {
                            // Do nothing for combo items
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
                        </span>
                      </td>
                      <td>{item.notes?.trim() ? item.notes : "-"}</td>
                      <td>{qty}</td>
                      <td>₹{unitPrice}</td>
                      <td>₹{itemTotal}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* TOTAL */}
          <div className="section">
            {order.splitType && (
              <div className="section">
                <div className="section-title">
                  <span>Split Details</span>
                </div>

                {order.splitType === "amount" && (
                  <p>
                    {order.splitDetails?.customers} People • ₹{order.splitDetails?.perHead} per head
                  </p>
                )}

                {order.splitType === "bill" && (
                  <div>
                    {order.splitDetails?.map((bill, i) => (
                      <p key={i}>
                        Bill {i + 1}: ₹{bill.total}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="section-title">
              <span>Total Amount</span>
              <p className="order-total">₹{totalAmount}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default OrderDetails;