import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import "./UserDetails.css";
import { formatDisplayDate } from "../App"

const UserDetails = ({ users }) => {
  const { userId } = useParams();
  const navigate = useNavigate();

  const user = users.find(u => u.id === userId);

  if (!user) return null;

  const totalDishes =
    user.orders?.reduce(
      (sum, order) =>
        sum + (order.items?.reduce((s, i) => s + (i.quantity || 1), 0) || 0),
      0
    ) || 0;

  return (
    <div className="user-details-page">
      <div className="details-container ">

        <div className="details-header">
          <button className="back-btn" onClick={() => navigate(-1)} />
          <h2>{user.name}</h2>
        </div>

        <div className="section-title">
          <span>User Details</span>
        </div>
        {/* USER INFO TABLE */}
        <table className="user-info-table">
          <tbody>
            <tr>
              <td>User ID</td>
              <td>{user.id}</td>
            </tr>
            <tr>
              <td>Name</td>
              <td>{user.name}</td>
            </tr>
            <tr>
              <td>Mobile</td>
              <td>{user.mobile}</td>
            </tr>
            <tr>
              <td>Total Orders</td>
              <td>{user.orders?.length || 0}</td>
            </tr>
            <tr>
              <td>Total Dishes Ordered</td>
              <td>{totalDishes}</td>
            </tr>
          </tbody>
        </table>

        {/* ORDERS */}
        <div className="section">
          <div className="section-title">
            <span>Orders</span>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Date</th>
                <th>Time</th>
                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              {user.orders && user.orders.length > 0 ? (
                user.orders.map(order => (
                  <tr key={order.id}>
                    <td className="clickable" onClick={() => navigate(`/orders/${order.id}`)}>{order.id}</td>
                    <td>{formatDisplayDate(order.date)}</td>
                    <td>{order.time}</td>
                    <td>₹{order.totalAmount}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" style={{ textAlign: "center", padding: "16px" }}>
                    No orders found for this user
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};

export default UserDetails;
