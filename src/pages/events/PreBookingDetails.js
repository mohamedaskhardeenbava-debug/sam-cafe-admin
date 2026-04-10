import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../../api";
import "./PreBookingDetails.css";

const PreBookingDetails = ({ adminData }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const data = adminData?.preBookings || [];

  if (!data) return <div className="evt-pbd-page">Loading...</div>;

  const normalizeStatus = (status = "") =>
    status.toLowerCase().trim();

  const totalAmount =
    data.totalAmount ??
    data.items?.reduce(
      (sum, item) => sum + Number(item.totalPrice || 0),
      0
    );

  return (
    <div className="evt-pbd-page">
      <div className="evt-pbd-container">

        {/* HEADER */}
        <div className="evt-pbd-header">
          <button
            className="evt-pbd-back-btn"
            onClick={() => navigate(-1)}
          />
          <h2>PreBooking {data.id}</h2>
        </div>

        {/* CUSTOMER INFO */}
        <div className="evt-pbd-section">
          <div className="evt-pbd-section-title">
            <span>Customer Information</span>
          </div>

          <table className="evt-pbd-info-table">
            <tbody>
              <tr>
                <td><strong>Name:</strong> {data.name}</td>
                <td><strong>Mobile:</strong> {data.mobile}</td>
              </tr>
              <tr>
                <td><strong>Date:</strong> {data.date}</td>
                <td><strong>Time:</strong> {data.time}</td>
              </tr>
              <tr>
                <td>
                  <strong>Status:</strong>{" "}
                  <span
                    className={`evt-pbd-status evt-pbd-status-${normalizeStatus(data.status)}`}
                  >
                    {data.status || "scheduled"}
                  </span>
                </td>
                <td><strong>Notes:</strong> {data.notes || "-"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ITEMS */}
        <div className="evt-pbd-section">
          <div className="evt-pbd-section-title">
            <span>Ordered Items</span>
          </div>

          <table className="evt-pbd-items-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Subtotal</th>
              </tr>
            </thead>

            <tbody>
              {data.items?.map((item, index) => {
                const price = Number(item.totalPrice || 0);

                return (
                  <tr key={index}>
                    <td>{item.name}</td>
                    <td>{item.selectedSize || "-"}</td>
                    <td>{item.quantity}</td>
                    <td>₹{price}</td>
                    <td>₹{price}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* TOTAL */}
        <div className="evt-pbd-section">
          <div className="evt-pbd-section-title">
            <span>Total Amount</span>
            <p className="evt-pbd-total">₹{totalAmount}</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PreBookingDetails;