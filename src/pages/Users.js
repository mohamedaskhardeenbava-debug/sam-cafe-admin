import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { sortArray } from "../App";
import "./Users.css";
import { EmptyRow } from "../App";

const Users = ({ handleSort, sortConfig, users }) => {
    const navigate = useNavigate();

    const sortedUsers = useMemo(
        () => sortArray(users, sortConfig),
        [users, sortConfig]
    );

    const sendCampaignToAllUsers = () => {
        const message =
            "🎉 Special offers are waiting for you at Sam Cafe!";

        const sendCampaignToAllUsers = async () => {
            await api.post("/campaign", { users });
            alert("Campaign sent successfully");
        };
    };

    const getTotalItemsOrdered = (user) => {
        if (!Array.isArray(user.orders)) return 0;

        return user.orders.reduce((orderAcc, order) => {
            if (!Array.isArray(order.items)) return orderAcc;

            const itemsCount = order.items.reduce(
                (itemAcc, item) => itemAcc + Number(item.quantity || 0),
                0
            );

            return orderAcc + itemsCount;
        }, 0);
    };

    return (
        <div className="users-page">
            <div className="users-header">
                <h2 className="users-title">Users</h2>
                <button className="campaign-btn" onClick={sendCampaignToAllUsers}>
                    Campaign
                </button>
            </div>

            <div className="users-table-wrapper">
                <table className="users-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th
                                onClick={() => handleSort("name")}
                                className={sortConfig.key === "name" ? "sorted" : ""}
                            >
                                <span className="th-content sort-th">
                                    <span>User Name</span>
                                    <span className="sort-arrow">
                                        {sortConfig.direction === "asc" ? "▲" : "▼"}
                                    </span>
                                </span>
                            </th>
                            <th
                                onClick={() => handleSort("mobile")}
                                className={sortConfig.key === "mobile" ? "sorted" : ""}
                            >
                                <span className="th-content sort-th">
                                    <span>Mobile Number</span>
                                    <span className="sort-arrow">
                                        {sortConfig.direction === "asc" ? "▲" : "▼"}
                                    </span>
                                </span>
                            </th>
                            <th>Total Orders</th>
                            <th>Total Dishes Ordered</th>
                        </tr>
                    </thead>

                    <tbody>
                        {sortedUsers.length === 0 ? (
                            <EmptyRow colSpan={5} message="No users found" />
                        ) : (
                            sortedUsers.map((user, index) => (
                                <tr key={user.id}>
                                    <td>{index + 1}</td>
                                    <td
                                        className="clickable"
                                        onClick={() => navigate(`/users/${user.id}`)}
                                    >
                                        {user.name}
                                    </td>
                                    <td>{user.mobile}</td>
                                    <td>{user.orders?.length || 0}</td>
                                    <td>{getTotalItemsOrdered(user)}</td>
                                </tr>
                            )))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Users;

// import React, { useEffect, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import api from "../api";
// import "./Ingredients.css"; // reuse Ingredients table styles

// const Users = () => {
//     const [users, setUsers] = useState([]);
//     const navigate = useNavigate();

//     useEffect(() => {
//         const fetchUsers = async () => {
//             try {
//                 const res = await api.get("/users");
//                 setUsers(res.data || []);
//             } catch (err) {
//                 console.error("Failed to fetch users", err);
//             }
//         };

//         fetchUsers();
//     }, []);

//     const normalizeIndianMobile = (mobile) => {
//         if (!mobile) return null;

//         let digits = mobile.toString().replace(/\D/g, "");

//         // remove leading 0 (VERY IMPORTANT)
//         if (digits.startsWith("0")) {
//             digits = digits.slice(1);
//         }

//         // remove country code if present
//         if (digits.startsWith("91") && digits.length === 12) {
//             digits = digits.slice(2);
//         }

//         // must be exactly 10 digits
//         if (digits.length !== 10) return null;

//         return `91${digits}`;
//     };

//     // const runWhatsappCampaign = (user) => {
//     //     if (!user || !user.mobile) return;

//     //     const phone = normalizeIndianMobile(user.mobile);
//     //     if (!phone) {
//     //         alert(`Invalid mobile number: ${user.mobile}`);
//     //         return;
//     //     }

//     //     const message =
//     //         `Hi ${user.name}, 🎉 Special offers are waiting for you at Sam Cafe!`;

//     //     const url =
//     //         `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;

//     //     window.open(url, "_blank");
//     // };

//     const sendCampaignToAllUsers = () => {
//         const message =
//             "🎉 Special offers are waiting for you at Sam Cafe! Order now 🍔🍕";

//         const url =
//             `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

//         window.open(url, "_blank");
//     };

//     return (
//         <div className="ingredients-page">
//             {/* HEADER */}
//             <div className="ingredient-header">
//                 <h2 className="ingredient-title">Users</h2>

//                 <button
//                     className="ingredient-add-btn"
//                     onClick={sendCampaignToAllUsers}
//                 >
//                     Send to All
//                 </button>
//             </div>

//             {/* TABLE */}
//             <div className="ingredient-table-wrapper">
//                 <table className="ingredient-table">
//                     <thead>
//                         <tr>
//                             <th>#</th>
//                             <th>User Name</th>
//                             <th>Mobile</th>
//                             <th>Orders</th>
//                             {/* <th>Campaign</th> */}
//                         </tr>
//                     </thead>

//                     <tbody>
//                         {users.length === 0 && (
//                             <tr>
//                                 <td colSpan="5">No users found</td>
//                             </tr>
//                         )}

//                         {users.map((user, index) => (
//                             <tr
//                                 key={user.id}
//                                 className="clickable"
//                                 onClick={() => navigate(`/users/${user.id}`)}
//                             >
//                                 <td>{index + 1}</td>
//                                 <td>{user.name}</td>
//                                 <td>{user.mobile}</td>
//                                 <td>{user.orders?.length || 0}</td>

//                                 {/* WhatsApp button */}
//                                 {/* <td
//                                     onClick={(e) => {
//                                         e.stopPropagation(); // prevent row navigation
//                                         runWhatsappCampaign(user);
//                                     }}
//                                 >
//                                     <button className="ingredient-add-btn">
//                                         WhatsApp
//                                     </button>
//                                 </td> */}
//                             </tr>
//                         ))}
//                     </tbody>
//                 </table>
//             </div>
//         </div>
//     );
// };

// export default Users;