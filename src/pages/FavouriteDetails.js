/**
 * FavouriteDetails.js  —  Sam Cafe Admin Panel
 * Single favourite detail page
 */

import React from "react";
import { useParams, useNavigate } from "react-router-dom";

import "./FavouriteDetails.css";

const FavouriteDetails = ({ adminData }) => {
  // ── Hooks

  const { dishId } = useParams();
  const navigate = useNavigate();

  const dish = adminData.favourites?.find(
    (d) => String(d.id) === String(dishId)
  );

  if (!adminData.favourites || adminData.favourites.length === 0) {
    return <div className="page">No favourites added</div>;
  }

  if (!dish) {
    return <div className="page">Favourite not found</div>;
  }

  return (
    <div className="details-container">
      <div className="details-header">
        <button className="back-btn" onClick={() => navigate(-1)} />
        <h2>{dish.name}</h2>
      </div>

      <div className="details-body">
        <div className="horizontal-form-group">
          <div className="favourite-details-image">
            <img
              src={dish.image}
              alt={dish.name}
            />
          </div>

          <div className="section">
            <div className="section-title">
              <span>
                Name
              </span>
            </div>
            <p>{dish.name}</p>
          </div>

          <div className="section">
            <div className="section-title">
              <span>Base Price</span>
            </div>
            <p>₹{dish.totalPrice}</p>
          </div>
        </div>

        <div className="section">
          <div className="section-title">
            Description
          </div>
          <p>{dish.description}</p>

        </div>

        <div className="section">
          <div className="section-title with-action">
            <span>Ingredients</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Quantity (g)</th>
              </tr>
            </thead>
            <tbody>
              {dish.ingredients.map((ing, i) => (
                <tr key={i}>
                  <td>{ing.name}</td>
                  <td>{ing.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="section">
          <div className="section-title with-action">
            <span>Nutrition</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Nutrition</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {dish.benefits && Object.keys(dish.benefits).length > 0 ? (
                Object.entries(dish.benefits).map(([key, value]) => (
                  <tr key={key}>
                    <td>{key}</td>
                    <td>{value}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="2" style={{ textAlign: "center", color: "#777" }}>
                    No nutrition information available
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

export default FavouriteDetails;
