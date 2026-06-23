import { useState } from "react";
import * as XLSX from "xlsx";
import api from "../../api";
import "./TableManagement.css";
import closeIcon from "../../icon/close-icon.png";
import deleteIcon from "../../icon/delete-icon.png";
import qrIcon from "../../icon/qr-icon.png";
import logo from "../../icon/logo.png";

import { QRCodeCanvas } from "qrcode.react";
import { useToast } from "../../useToast";

const TableManagement = ({ adminData, setAdminData }) => {
  const { toast } = useToast();
  const tables = adminData.tables?.[0]?.list || [];
  const [newTable, setNewTable] = useState("");
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);

  const addTable = async () => {
    if (!newTable) return;
    const num = Number(newTable);
    if (tables.includes(num)) {
      toast.warning("Table already exists");
      return;
    }
    const updated = [...tables, num].sort((a, b) => a - b);
    try {
      await api.put("/tables/1", { id: 1, list: updated });
      setAdminData(prev => ({ ...prev, tables: [{ id: 1, list: updated }] }));
      setNewTable("");
      toast.success("Table added successfully.");
    } catch (err) {
      console.error("Failed to add table:", err);
      toast.error("Failed to add table");
    }
  };

  const removeTable = async (tableNo) => {
    const updated = tables.filter(t => t !== tableNo);
    try {
      await api.put("/tables/1", { id: 1, list: updated });
      setAdminData(prev => ({ ...prev, tables: [{ id: 1, list: updated }] }));
      toast.success("Table removed.");
    } catch (err) {
      console.error("Failed to remove table:", err);
      toast.error("Failed to remove table");
    }
  };

  const getQRValue = (tableNo) =>
    `${process.env.REACT_APP_USER_PANEL_URL || "https://samcafe.vercel.app"}/?table=${tableNo}`;

  const exportTables = () => {
    if (!tables.length) { toast.warning("No tables to export"); return; }

    // We build one canvas per table, convert to data-URL, then write to XLSX
    const processNext = (idx, rows) => {
      if (idx >= tables.length) {
        // All canvases rendered — write file
        const sheet = XLSX.utils.json_to_sheet(rows);
        sheet["!cols"] = [
          { wch: 10 },  // Table No
          { wch: 50 },  // QR URL
          { wch: 30 },  // QR Link label (clickable in Excel)
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, sheet, "Tables");
        XLSX.writeFile(wb, `tables_qr_${new Date().toISOString().slice(0, 10)}.xlsx`);
        return;
      }
      const t = tables[idx];
      const url = getQRValue(t);

      // Create an off-screen canvas, render QR into it, export as PNG download-link
      const offCanvas = document.createElement("canvas");
      offCanvas.width = 300;
      offCanvas.height = 300;

      // Use qrcode library directly to draw on canvas
      import("qrcode").then(QRCode => {
        QRCode.toCanvas(offCanvas, url, { width: 300, margin: 1, errorCorrectionLevel: "H" }, (err) => {
          const dataUrl = err ? "" : offCanvas.toDataURL("image/png");
          rows.push({
            "Table No": t,
            "QR URL": url,
            "QR Download": dataUrl
              ? { t: "s", v: "Download QR", l: { Target: dataUrl } }
              : url,
          });
          processNext(idx + 1, rows);
        });
      }).catch(() => {
        // fallback: just store the URL
        rows.push({ "Table No": t, "QR URL": url, "QR Download": url });
        processNext(idx + 1, rows);
      });
    };

    processNext(0, []);
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

    const exportSize = 1000;
    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = exportSize;
    finalCanvas.height = exportSize;
    const ctx = finalCanvas.getContext("2d");

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
      const padding = 12;
      const radius = 20;
      const boxSize = Math.max(drawWidth, drawHeight) + padding * 2;
      const rectX = (exportSize - boxSize) / 2;
      const rectY = (exportSize - boxSize) / 2;

      ctx.fillStyle = "#fff";
      drawRoundedRect(ctx, rectX, rectY, boxSize, boxSize, radius);
      ctx.fill();

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

      {/* HEADER */}
      <div className="table-mgmt-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 className="table-mgmt-title">Table Management</h2>
          <span style={{ fontSize: 14, color: "#555", fontWeight: 500 }}>
            {tables.length} table{tables.length !== 1 ? "s" : ""}
          </span>
          <div className="table-mgmt-add">
            <input
              type="number"
              className="table-mgmt-input"
              placeholder="Table number"
              value={newTable}
              onChange={e => setNewTable(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addTable()}
              min="1"
            />
            <button className="modal-save-btn" style={{ marginTop: "0px" }} onClick={addTable}>
              <span className="shadow"></span>
              <span className="edge"></span>
              <span className="front">Add Table</span>
            </button>
          </div>
        </div>

        <button className="modal-save-btn" onClick={exportTables}>
          <span className="shadow"></span>
          <span className="edge"></span>
          <span className="front">Export</span>
        </button>

      </div>

      {/* GRID */}
      <div className="table-mgmt-grid-wrapper">
        {tables.length > 0 ? (
          <div className="table-mgmt-grid">
            {tables.map(t => (
              <div className="table-card" key={t}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#a3a3a3", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>
                    Table
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: "#0f0f0f", letterSpacing: "-0.02em", lineHeight: 1 }}>
                    {t}
                  </div>
                </div>

                <div className="table-actions">
                  <button
                    className="modal-cancel-btn"
                    title="Show QR"
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedTable(t);
                      setShowQRModal(true);
                    }}
                  >
                    <span className="shadow"></span>
                    <span className="edge"></span>
                    <span className="front close-padding">
                      <img src={qrIcon} alt="QR" className="qr-icon" />
                    </span>
                  </button>

                  <button
                    className="modal-cancel-btn"
                    title="Remove table"
                    onClick={() => removeTable(t)}
                  >
                    <span className="shadow"></span>
                    <span className="edge"></span>
                    <span className="front close-padding">
                      <img src={deleteIcon} alt="" />
                    </span>                                    </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="table-empty">
            <div className="table-empty-icon">🪑</div>
            <p>No tables yet</p>
            <span>Add a table number above to get started</span>
          </div>
        )}
      </div>

      {/* QR MODAL */}
      {showQRModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowQRModal(false)}
        >
          <div
            className="qr-modal"
            onClick={e => e.stopPropagation()}
          >
            <div className="qr-modal-header">
              <h3>Table {selectedTable}</h3>
              <button
                className="modal-cancel-btn"
                onClick={() => setShowQRModal(false)}
              >
                <span className="shadow"></span>
                <span className="edge"></span>
                <span className="front close-padding"><img src={closeIcon} /></span>
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
                <img src={logo} alt="logo" className="qr-logo-center" />
              </div>

              <p className="qr-url-label">{getQRValue(selectedTable)}</p>

              <button
                className="modal-save-btn"
                onClick={downloadQR}
              >
                <span className="shadow"></span>
                <span className="edge"></span>
                <span className="front"> Download QR ↓</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableManagement;