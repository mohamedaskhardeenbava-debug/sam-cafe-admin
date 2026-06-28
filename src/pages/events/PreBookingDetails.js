/**
 * PreBookingDetails.js  —  Sam Cafe Admin Panel
 * Single pre-booking detail page
 */

import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";

import api from "../../api";
import { fmtTime, fmtDateTime } from "../../utils/dateUtils";

import { useToast } from "../../useToast";
import Button3D from "../../components/Button3D";

import "./PreBookingDetails.css";

/* ── Constants ── */
const SLOT_GROUPS = {
  BF: { label: "Breakfast" },
  BR: { label: "Brunch" },
  LU: { label: "Lunch" },
  HT: { label: "Hi-Tea" },
  DI: { label: "Dinner" },
};

const slotFromTime = (time) => {
  if (!time) return { label: "—" };
  const h = parseInt(time.split(":")[0], 10);
  if (h >= 7 && h < 10) return { label: "Breakfast" };
  if (h >= 10 && h < 12) return { label: "Brunch" };
  if (h >= 12 && h < 15) return { label: "Lunch" };
  if (h >= 15 && h < 18) return { label: "Hi-Tea" };
  return { label: "Dinner" };
};

/* ── Component ── */
const PreBookingDetails = ({ adminData, setAdminData }) => {
  // ── Hooks

  const { toast } = useToast();
  const { id } = useParams();
  const navigate = useNavigate();

  // ── Helpers

  const data = (adminData?.preBookings || []).find((b) => b.id === id);
  const [saving, setSaving] = useState(false);
  const [localStatus, setLocalStatus] = useState(data?.status || "scheduled");

  if (!data) return (
    <div className="details-container">
      <div className="evt-details-container">
        <div className="details-header">
          <button className="back-btn" onClick={() => navigate(-1)} />
          <div>
            <h2 className="evt-details-title">PreBooking Detail</h2>
          </div>
        </div>
        <div className="evt-details-section">
          <p style={{ color: "#a3a3a3", fontSize: 14, margin: 0 }}>PreBooking not found.</p>
        </div>
      </div>
    </div>
  );

  const subtotal =
    data.subtotal ??
    data.items?.reduce((s, i) => s + Number(i.totalPrice || 0), 0) ??
    0;
  const discount = data.discount ?? 0;
  const totalAmount = data.totalAmount ?? subtotal - discount;

  const slot = data.slotGroup
    ? SLOT_GROUPS[data.slotGroup] || slotFromTime(data.time)
    : slotFromTime(data.time);

  const handleStatusChange = async (newStatus) => {
    setSaving(true);
    try {
      await api.patch(`/preBookings/${id}`, { status: newStatus });
      setLocalStatus(newStatus);
      toast.success(`Status updated to ${newStatus}.`);
      if (typeof setAdminData === "function") {
        setAdminData(p => ({
          ...p,
          preBookings: (p.preBookings || []).map(b =>
            b.id === id ? { ...b, status: newStatus } : b
          ),
        }));
      }
    } catch (err) {
      console.error("Update failed", err);
      toast.error("Failed to update status. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const infoRows = [
    { label: "Guest Name", val: data.name || "—" },
    { label: "Mobile", val: data.mobile || "—" },
    { label: "Email", val: data.email || "—" },
    { label: "No. of Guests", val: data.guests || "—" },
    { label: "Date", val: data.date || "—" },
    { label: "Time", val: fmtTime(data.time) },
    { label: "Dining Slot", val: slot.label },
    { label: "Table Preference", val: data.tablePref || "—" },
    { label: "Notes", val: data.notes || "—" },
    { label: "Created At", val: fmtDateTime(data.createdAt) },
  ];

  return (
    <div className="details-container">

      {/* ── HEADER ── */}
      <div className="details-header">
        <button className="back-btn" onClick={() => navigate(-1)} />
        <div>
          <h2 className="evt-details-title">PreBooking Detail</h2>
          <p className="evt-details-id">ID: <code>{data.id}</code></p>
        </div>
        <span className={`evt-details-status-badge evt-details-status-${localStatus}`}>{localStatus}</span>
      </div>

      <div className="details-body">

        {/* ── HERO CARD ── */}
        <div className="evt-details-hero">
          <div className="evt-details-hero-avatar">
            {(data.name || "?").charAt(0).toUpperCase()}
          </div>
          <div className="evt-details-hero-info">
            <div className="evt-details-hero-name">{data.name || "—"}</div>
            <div className="evt-details-hero-sub">
              {data.mobile}{data.email ? ` · ${data.email}` : ""}
            </div>
            <div className="evt-details-hero-meta">
              <span>{data.date || "—"}</span>
              <span>{fmtTime(data.time)}</span>
              <span>{slot.label}</span>
              <span>{data.guests || 1} guests</span>
              {data.tablePref && <span>{data.tablePref}</span>}
              {data.guests > 8 && <span>Group — 10% off</span>}
            </div>
          </div>
        </div>

        {/* ── INFO GRID ── */}
        <div className="evt-details-section">
          <div className="evt-details-section-title">Booking Information</div>
          <div className="evt-details-info-grid">
            {infoRows.map((row, i) => (
              <div key={i} className="evt-details-info-cell">
                <div>
                  <div className="evt-details-info-label">{row.label}</div>
                  <div className="evt-details-info-val">{row.val}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── PRE-ORDERED ITEMS ── */}
        <div className="evt-details-section">
          <div className="evt-details-section-title">
            Pre-Ordered Items ({data.items?.length || 0})
          </div>
          {data.items?.length > 0 ? (
            <table className="evt-details-items-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Size</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, index) => (
                  <tr key={index}>
                    <td>{item.name}</td>
                    <td>{item.selectedSize || "—"}</td>
                    <td>{item.quantity}</td>
                    <td>
                      ₹{item.unitPrice ??
                        (item.quantity
                          ? (Number(item.totalPrice) / item.quantity).toFixed(0)
                          : Number(item.totalPrice || 0))}
                    </td>
                    <td>₹{Number(item.totalPrice || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: "#a3a3a3", fontSize: 14, margin: 0 }}>No items pre-ordered.</p>
          )}
        </div>

        {/* ── BILL SUMMARY ── */}
        <div className="evt-details-section">
          <div className="evt-details-section-title">Bill Summary</div>
          <div className="evt-details-pricing-card">
            <div className="evt-details-pricing-row">
              <div className="evt-details-pricing-label">Subtotal</div>
              <div className="evt-details-pricing-val">₹{subtotal.toLocaleString()}</div>
            </div>
            {discount > 0 && (
              <div className="evt-details-pricing-row">
                <div className="evt-details-pricing-label">
                  Group Discount (10%) — {data.guests} guests
                </div>
                <div className="evt-details-pricing-val">− ₹{discount.toLocaleString()}</div>
              </div>
            )}
            <div className="evt-details-pricing-row evt-details-pricing-total">
              <div className="evt-details-pricing-label">Total (Advance Payment)</div>
              <div className="evt-details-pricing-val">₹{totalAmount.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* ── CALL HISTORY ── */}
        {data.callHistory?.length > 0 && (
          <div className="evt-details-section">
            <div className="evt-details-section-title">Call History ({data.callHistory.length})</div>
            <div className="evt-details-call-history">
              {data.callHistory.map((ts, i) => (
                <div key={i} className="evt-details-call-history-item">
                  <span>Call #{i + 1}</span>
                  <span style={{ marginLeft: "auto", color: "#a3a3a3" }}>{fmtDateTime(ts)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STATUS UPDATE ── */}
        <div className="evt-details-section">
          <div className="evt-details-section-title">Update Status</div>
          <div className="evt-details-status-row">
            {["scheduled", "confirmed", "completed", "cancelled"].map(s => (
              <Button3D variant="cancel" key={s}
                onClick={() => handleStatusChange(s)}
                disabled={saving || localStatus === s}>
                {saving && localStatus !== s ? "…" : s.charAt(0).toUpperCase() + s.slice(1)}
              </Button3D>
            ))}
          </div>
        </div>

        {/* ── CALL CARD ── */}
        <div className="evt-details-reminder">
          <div>
            <div className="evt-details-reminder-label">Reminder Call</div>
            <div className="evt-details-reminder-num">{data.mobile || "—"}</div>
          </div>
          <a
            className="modal-save-btn"
            href={data.mobile ? `tel:${data.mobile}` : undefined}
            onClick={e => !data.mobile && e.preventDefault()}
          >
            <span className="shadow"></span>
            <span className="edge"></span>
            <span className="front">Call Now</span>
          </a>
        </div>

      </div>
    </div>
  );
};

export default PreBookingDetails;
