import React, { useState } from "react";
import "./KitchenActivityLog.css";

export default function KitchenActivityLog({ adminData }) {

    const [date, setDate] = useState("");

    const list = adminData?.kitchenActivity || [];

    const filtered = date
        ? list.filter(i => i.date === date)
        : list;

    return (
        <div className="activity-page">

            <div className="activity-header">
                <h2 className="activity-title">Kitchen Activity Log</h2>

                <div style={{ display: "flex", gap: "10px" }}>
                    <input
                        className="activity-date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                    />

                    <button onClick={() => setDate("")}>
                        All Data
                    </button>
                </div>
            </div>

            <div className="activity-table-wrapper">
                <table className="activity-table">
                    <thead>
                        <tr>
                            <th>Work</th>
                            <th>Staff</th>
                            <th>Date</th>
                        </tr>
                    </thead>

                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan="3" style={{ textAlign: "center" }}>
                                    No activity found
                                </td>
                            </tr>
                        ) : (
                            filtered.map(item => (
                                <tr key={item.id}>
                                    <td>{item.work}</td>
                                    <td>{item.staff}</td>
                                    <td>{item.date}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}