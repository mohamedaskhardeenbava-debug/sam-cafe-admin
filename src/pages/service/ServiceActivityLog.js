import React, { useState } from "react";
import "./ServiceActivityLog.css";
import api from "../../api";

export default function ServiceActivityLog({ adminData }) {

    const [date, setDate] = useState("");

    // ✅ ALWAYS ARRAY
    const list = adminData?.serviceActivity || [];

    // ✅ FILTER SIMPLE
    const filtered = date
        ? list.filter(item => item.date === date)
        : list;

    return (
        <div className="activity-page">

            <div className="activity-header">
                <h2 className="activity-title">Service Activity Log</h2>

                <div style={{ display: "flex", gap: "10px" }}>
                    <input
                        type="date"
                        className="activity-date"
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