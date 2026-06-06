import React, { useEffect, useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { sortArray } from "../App";
import "./Users.css";
import { EmptyRow } from "../App";
import useInfiniteScroll from "../components/useInfiniteScroll";
import InfiniteScrollLoader from "../components/InfiniteScrollLoader";

const Users = ({ handleSort, sortConfig, users }) => {
    const navigate = useNavigate();
    const [userSearch, setUserSearch] = useState("");

    const sortedUsers = useMemo(
        () => sortArray(users, sortConfig),
        [users, sortConfig]
    );

    const filteredUsers = useMemo(() => {
        const q = userSearch.toLowerCase();
        return q
            ? sortedUsers.filter(u =>
                (u.name || "").toLowerCase().includes(q) ||
                (u.mobile || "").includes(q)
            )
            : sortedUsers;
    }, [sortedUsers, userSearch]);

    const { displayLimit, sentinelRef, containerRef, hasMore } =
        useInfiniteScroll(filteredUsers.length, 30);

    const exportUsers = () => {
        if (!filteredUsers.length) { alert("No users to export"); return; }
        const rows = filteredUsers.map((u, i) => ({
            "#": i + 1,
            Name: u.name || "—",
            Mobile: u.mobile || "—",
            "Total Orders": u.orders?.length || 0,
            "Total Dishes Ordered": getTotalItemsOrdered(u),
        }));
        const sheet = XLSX.utils.json_to_sheet(rows);
        sheet["!cols"] = Object.keys(rows[0]).map(k => ({
            wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? "").length)) + 2,
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, sheet, "Users");
        XLSX.writeFile(wb, `users_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

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
                <div style={{ display: "flex", gap: 8 }}>
                    <button 
                    className="modal-save-btn" 
                    onClick={exportUsers}
                    >
                        <span className="shadow"></span>
                        <span className="edge"></span>
                        <span className="front">Export</span>
                    </button>
                    <button 
                    className="modal-save-btn" 
                    onClick={sendCampaignToAllUsers}
                    >
                        <span className="shadow"></span>
                        <span className="edge"></span>
                        <span className="front">Campaign</span>
                    </button>
                </div>
            </div>

            {/* FILTER BAR */}
            <div className="users-filter-bar">
                <input
                    className="search-input"
                    placeholder=" Search name or mobile…"
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                />
                {userSearch && (
                    <button className="ae-clear-filter" onClick={() => setUserSearch("")}>Clear</button>
                )}
                <span className="ae-result-count">{filteredUsers.length} user(s)</span>
            </div>

            <div className="users-table-wrapper" ref={containerRef}>
                <table className="users-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th onClick={() => handleSort("name")} className={sortConfig.key === "name" ? "sorted" : ""}>
                                <span className="th-content sort-th">
                                    <span>User Name</span>
                                    <span className="sort-arrow">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
                                </span>
                            </th>
                            <th onClick={() => handleSort("mobile")} className={sortConfig.key === "mobile" ? "sorted" : ""}>
                                <span className="th-content sort-th">
                                    <span>Mobile Number</span>
                                    <span className="sort-arrow">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
                                </span>
                            </th>
                            <th>Total Orders</th>
                            <th>Total Dishes Ordered</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.length === 0 ? (
                            <EmptyRow colSpan={5} message="No users found" />
                        ) : (
                            filteredUsers.slice(0, displayLimit).map((user, index) => (
                                <tr key={user.id}>
                                    <td>{index + 1}</td>
                                    <td className="clickable" onClick={() => navigate(`/users/${user.id}`)}>
                                        {user.name}
                                    </td>
                                    <td>{user.mobile}</td>
                                    <td>{user.orders?.length || 0}</td>
                                    <td>{getTotalItemsOrdered(user)}</td>
                                </tr>
                            ))
                        )}
                        <InfiniteScrollLoader
                            sentinelRef={sentinelRef}
                            hasMore={hasMore}
                            colSpan={5}
                        />
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Users;