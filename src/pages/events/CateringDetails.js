import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../../api";
import "./CateringDetails.css";

const CateringDetails = ({adminData}) => {
  const { id } = useParams();
  const navigate = useNavigate();

  const data = adminData?.cateringOrders?.find(i => i.id === id);

  if (!data) return <div className="evt-catd-page">Loading...</div>;

  const totalAmount =
    data.totalAmount ??
    data.items?.reduce(
      (sum, item) => sum + Number(item.totalPrice || 0),
      0
    );

  const normalizeStatus = (status = "") =>
    status.toLowerCase().trim();

  return (
    <div className="evt-catd-page">
      <div className="evt-catd-container">

        {/* HEADER */}
        <div className="evt-catd-header">
          <button
            className="evt-catd-back-btn"
            onClick={() => navigate(-1)}
          />
          <h2>Catering {data.id}</h2>
        </div>

        {/* CUSTOMER INFO */}
        <div className="evt-catd-section">
          <div className="evt-catd-section-title">
            <span>Customer Information</span>
          </div>

          <table className="evt-catd-info-table">
            <tbody>
              <tr>
                <td><strong>Name:</strong> {data.name}</td>
                <td><strong>Mobile:</strong> {data.mobile}</td>
              </tr>
              <tr>
                <td><strong>Date:</strong> {data.date}</td>
                <td><strong>Guests:</strong> {data.guests || "-"}</td>
              </tr>
              <tr>
                <td>
                  <strong>Status:</strong>{" "}
                  <span
                    className={`evt-catd-status evt-catd-status-${normalizeStatus(data.status)}`}
                  >
                    {data.status || "pending"}
                  </span>
                </td>
                <td><strong>Address:</strong> {data.address || "-"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ITEMS */}
        <div className="evt-catd-section">
          <div className="evt-catd-section-title">
            <span>Ordered Items</span>
          </div>

          <table className="evt-catd-items-table">
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
        <div className="evt-catd-section">
          <div className="evt-catd-section-title">
            <span>Total Amount</span>
            <p className="evt-catd-total">₹{totalAmount}</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CateringDetails;