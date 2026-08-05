/**
 * Favourites.js  —  Sam Cafe Admin Panel
 * Favourites list page
 */

import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { EmptyRow } from "../App";
import useInfiniteScroll from "../components/useInfiniteScroll";
import InfiniteScrollLoader, { InfiniteScrollOverlay } from "../components/InfiniteScrollLoader";

import "./Favourites.css";

const Favourites = ({ adminData, handleSort, sortConfig }) => {
  // ── Hooks

  const navigate = useNavigate();
  const dishes = adminData.favourites || [];

  const sortedFavourites = useMemo(() => {
    if (!sortConfig.key) return dishes;

    const data = [...dishes];

    data.sort((a, b) => {
      if (sortConfig.key === "name") {
        return sortConfig.direction === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }

      if (sortConfig.key === "price") {
        return sortConfig.direction === "asc"
          ? a.totalPrice - b.totalPrice
          : b.totalPrice - a.totalPrice;
      }

      return 0;
    });

    return data;
  }, [dishes, sortConfig]);

  const { displayLimit, sentinelRef, containerRef, hasMore, isLoadingMore } =
    useInfiniteScroll(sortedFavourites.length, 30);

  return (
    <div className="inner-page">
      <div className="header">
        <div className="header-title-with-count">
          <h2 className="title">Favourites</h2>
          <span className="result-count">{sortedFavourites.length} favourite(s)</span>
        </div>
      </div>

      <div className="table-wrapper" ref={containerRef}>
        <table >
          <thead>
            <tr>
              <th className="icon-width">Image</th>
              <th
                onClick={() => handleSort("name")}
                className={sortConfig.key === "name" ? "sorted" : ""}
              >
                <span className="th-content sort-th">
                  <span>Dish Name</span>
                  <span className="sort-arrow">
                    {sortConfig.key === "name"
                      ? sortConfig.direction === "asc" ? "▲" : "▼"
                      : ""}
                  </span>
                </span>
              </th>
              <th
                onClick={() => handleSort("price")}
                className={`${sortConfig.key === "price" ? "sorted" : ""}`}
              >
                <span className="th-content sort-th">
                  <span>Price</span>
                  <span className="sort-arrow">
                    {sortConfig.key === "price"
                      ? sortConfig.direction === "asc" ? "▲" : "▼"
                      : ""}
                  </span>
                </span>
              </th>
            </tr>
          </thead>

          <tbody>
            {sortedFavourites.length === 0 ? (
              <EmptyRow colSpan={3} message="No favourite dishes added" />
            ) : (
              sortedFavourites.slice(0, displayLimit).map((dish) => (
                <tr key={dish.id}>
                  <td
                    className="clickable icon-width"
                    onClick={() => navigate(`/favourites/${dish.id}`)}
                  >
                    <div className="favourites-image">
                      <img
                        src={dish.image}
                        alt={dish.name}
                      />
                    </div>
                  </td>

                  <td>
                    <span
                      className="clickable"
                      onClick={() => navigate(`/favourites/${dish.id}`)}
                    >
                      {dish.name}
                    </span>
                  </td>

                  <td>₹{dish.totalPrice}</td>
                </tr>
              )))}
            <InfiniteScrollLoader
              sentinelRef={sentinelRef}
              hasMore={hasMore}
              colSpan={3}
            />
          </tbody>
        </table>
        <InfiniteScrollOverlay isLoading={isLoadingMore} />
      </div>
    </div>
  );
};

export default Favourites;
