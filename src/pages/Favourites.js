import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./Favourites.css";
import { EmptyRow } from "../App";


const Favourites = ({ adminData, handleSort, sortConfig }) => {
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

    return (
        <div className="favourites-page">
            <h2 className="favourites-title">Favourites</h2>

            <div className="favourites-table-wrapper">
                <table className="favourites-table">
                    <thead>
                        <tr>
                            <th>Image</th>
                            <th
                                onClick={() => handleSort("name")}
                                className={sortConfig.key === "name" ? "sorted" : ""}
                            >
                                <span className="th-content sort-th">
                                    <span>Dish Name</span>
                                    <span className="sort-arrow">
                                        {sortConfig.direction === "asc" ? "▲" : "▼"}
                                    </span>
                                </span>
                            </th>
                            <th>Price</th>
                        </tr>
                    </thead>

                    <tbody>
                        {sortedFavourites.length === 0 ? (
                            <EmptyRow colSpan={3} message="No favourite dishes added" />
                        ) : (
                            sortedFavourites.map((dish) => (
                                <tr key={dish.id}>
                                    <td
                                        className="clickable"
                                        onClick={() => navigate(`/favourites/${dish.id}`)}
                                    >
                                        <div className="favourites-image">
                                            <img
                                                src={dish.image}
                                                alt={dish.name}
                                            />
                                        </div>
                                    </td>

                                    <td
                                        className="clickable"
                                        onClick={() => navigate(`/favourites/${dish.id}`)}
                                    >
                                        {dish.name}
                                    </td>

                                    <td>₹{dish.totalPrice}</td>
                                </tr>
                            )))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Favourites;
