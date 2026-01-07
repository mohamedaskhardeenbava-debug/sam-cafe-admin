import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./FavouriteDetails.css";

const FavouriteDetails = ({ adminData }) => {
    const { dishId } = useParams();
    const navigate = useNavigate();

    const favouritesCategory = adminData.favourites?.find(
        (f) => f.id === "favourites"
    );

    const dish = favouritesCategory?.dishes.find(
        (d) => d.id === dishId
    );

    if (!favouritesCategory) {
        return <div className="page">No favourites data found</div>;
    }

    if (!dish) {
        return <div className="page">Favourite not found</div>;
    }

    return (
        <div className="favourite-details-page">


            <div className="favourite-container">
                <div className="favourite-details-header">
                    <button className="back-btn" onClick={() => navigate(-1)} />
                    <h2>{dish.name}</h2>
                </div>

                <div className="favourite-details-image">
                    <img
                        src={dish.image}
                        alt={dish.name}
                    />
                </div>


                <div className="section">
                    <div className="fav-section-title">
                        <span>
                            Name:  
                        </span>
                        <p>{dish.name}</p>
                    </div>
                </div>

                <div className="section">
                    <div className="fav-section-title">
                        <span>Base Price:</span>
                        <p>{dish.basePrice}</p>
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
                    <div className="table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Quantity (g)</th>
                                    <th>Calories</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dish.ingredients.map((ing, i) => (
                                    <tr key={i}>
                                        <td>{ing.name}</td>
                                        <td>{ing.quantity}</td>
                                        <td>{ing.calories}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>


            </div>
        </div>
    );
};

export default FavouriteDetails;
