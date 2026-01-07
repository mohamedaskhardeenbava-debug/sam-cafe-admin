import React from "react";
import { useNavigate } from "react-router-dom";
import "./Favourites.css";

const Favourites = ({ adminData }) => {
    const navigate = useNavigate();

    const favouritesCategory = adminData.favourites?.[0];

    const dishes = favouritesCategory?.dishes || [];

    console.log("FAVOURITES DATA:", adminData.favourites);

    console.log("ADMIN DATA FULL:", adminData);

    return (
        <div className="favourites-page">
            <h2 className="page-title">Favourites</h2>

            <div className="favourites-table-wrapper">
                <table className="favourites-table">
                    <thead>
                        <tr>
                            <th>Image</th>
                            <th>Dish Name</th>
                            <th>Base Price</th>
                        </tr>
                    </thead>

                    <tbody>
                        {dishes.map((dish) => (
                            <tr key={dish.id}>
                                <td
                                    className="clickable"
                                    onClick={() => navigate(`/favourites/${dish.id}`)}
                                >
                                    <div className="favourites-image">
                                        <img
                                            src={dish.image}
                                            alt=""
                                        />
                                    </div>
                                </td>

                                <td
                                    className="clickable"
                                    onClick={() => navigate(`/favourites/${dish.id}`)}
                                >
                                    {dish.name}
                                </td>

                                <td>₹{dish.basePrice}</td>
                            </tr>
                        ))}

                        {dishes.length === 0 && (
                            <tr>
                                <td colSpan="3" className="empty-row">
                                    No favourite dishes added
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Favourites;
