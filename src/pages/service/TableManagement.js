import { useState } from "react";
import api from "../../api";
import "./TableManagement.css";
import deleteIcon from "../../icon/delete-icon.png";
import qrIcon from "../../icon/qr-icon.png"; // add icon
import logo from "../../icon/logo.png"; // your logo

import { QRCodeCanvas } from "qrcode.react";

const TableManagement = ({ adminData, setAdminData }) => {
    const tables = adminData.tables || [];
    const [newTable, setNewTable] = useState("");
    const [showQRModal, setShowQRModal] = useState(false);
    const [selectedTable, setSelectedTable] = useState(null);

    const addTable = async () => {
        if (!newTable) return;

        const num = Number(newTable);

        if (tables.includes(num)) {
            alert("Table already exists");
            return;
        }

        const updated = [...tables, num].sort((a, b) => a - b);

        await api.put("/tables/1", {
            id: 1,
            list: updated
        });

        setAdminData(prev => ({
            ...prev,
            tables: updated
        }));

        setNewTable("");
    };

    const removeTable = async (tableNo) => {
        const updated = tables.filter(t => t !== tableNo);

        await api.put("/tables/1", {
            id: 1,
            list: updated
        });

        setAdminData(prev => ({
            ...prev,
            tables: updated
        }));
    };

    const getQRValue = (tableNo) => {
        return `https://samcafe.vercel.app/?table=${tableNo}`;
    };

    const drawRoundedRect = (ctx, x, y, width, height, radius) => {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    };

    const downloadQR = () => {
        const qrCanvas = document.getElementById("table-qr");
        if (!qrCanvas) return;

        const exportSize = 1000; // 🔥 HIGH RESOLUTION

        const finalCanvas = document.createElement("canvas");
        finalCanvas.width = exportSize;
        finalCanvas.height = exportSize;

        const ctx = finalCanvas.getContext("2d");

        // Draw QR scaled up
        ctx.drawImage(qrCanvas, 0, 0, exportSize, exportSize);

        const image = new Image();
        image.src = logo;

        image.onload = () => {
            const maxLogoSize = exportSize * 0.2;

            const aspectRatio = image.width / image.height;

            let drawWidth, drawHeight;

            if (aspectRatio > 1) {
                drawWidth = maxLogoSize;
                drawHeight = maxLogoSize / aspectRatio;
            } else {
                drawHeight = maxLogoSize;
                drawWidth = maxLogoSize * aspectRatio;
            }

            const x = (exportSize - drawWidth) / 2;
            const y = (exportSize - drawHeight) / 2;

            // white background (bigger padding for clarity)
            ctx.fillStyle = "#fff";
            const padding = 12;
            const radius = 20;

            // 🔥 MAKE PERFECT SQUARE
            const boxSize = Math.max(drawWidth, drawHeight) + padding * 2;

            // center square
            const rectX = (exportSize - boxSize) / 2;
            const rectY = (exportSize - boxSize) / 2;

            // draw square background
            ctx.fillStyle = "#fff";
            drawRoundedRect(ctx, rectX, rectY, boxSize, boxSize, radius);
            ctx.fill();

            // 🔥 center logo INSIDE square
            const logoX = rectX + (boxSize - drawWidth) / 2;
            const logoY = rectY + (boxSize - drawHeight) / 2;

            ctx.drawImage(image, logoX, logoY, drawWidth, drawHeight);

            const url = finalCanvas.toDataURL("image/png");

            const link = document.createElement("a");
            link.href = url;
            link.download = `table-${selectedTable}.png`;
            link.click();
        };
    };

    return (
        <div className="table-mgmt-page">

            <div className="table-mgmt-header">
                <h2 className="table-mgmt-title">Table Management</h2>
            </div>

            <div className="table-mgmt-add">
                <input
                    type="number"
                    className="table-mgmt-input"
                    placeholder="Enter table number"
                    value={newTable}
                    onChange={(e) => setNewTable(e.target.value)}
                />
                <button className="table-mgmt-btn" onClick={addTable}>
                    Add Table
                </button>
            </div>

            <div className="table-mgmt-grid-wrapper">
                {tables.length > 0 ? (
                    <div className="table-mgmt-grid">
                        {tables.map(t => (
                            <div className="table-card">
                                <div>Table-{t}</div>

                                <div className="table-actions">
                                    {/* QR ICON */}
                                    <img
                                        src={qrIcon}
                                        alt="QR"
                                        className="qr-icon"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedTable(t);
                                            setShowQRModal(true);
                                        }}
                                    />

                                    {/* DELETE */}
                                    <img
                                        className="delete-icon"
                                        onClick={() => removeTable(t)}
                                        src={deleteIcon}
                                        alt="Delete"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="table-empty">
                        No tables available
                    </div>
                )}
            </div>

            {showQRModal && (
                <div
                    className="qr-modal-overlay"
                    onClick={() => setShowQRModal(false)}
                >
                    <div
                        className="qr-modal"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="qr-modal-header">
                            <h3>Table {selectedTable} QR</h3>
                            <button onClick={() => setShowQRModal(false)}>
                            </button>
                        </div>

                        <div className="qr-modal-body">
                            <div className="qr-preview">
                                <QRCodeCanvas
                                    id="table-qr"
                                    value={getQRValue(selectedTable)}
                                    size={200}
                                    level="H"
                                    includeMargin
                                />

                                {/* LOGO */}
                                <img
                                    src={logo}
                                    alt="logo"
                                    className="qr-logo-center"
                                />
                            </div>

                            <button
                                className="qr-download-btn"
                                onClick={downloadQR}
                            >
                                Download QR
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default TableManagement;