/**
 * Orders.js  —  Sam Cafe Admin Panel
 * Orders management page
 * Testing Branch MongoDB
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";

import { QRCodeCanvas } from "qrcode.react";

import { exportToExcel } from "../utils/excelUtils";
import api from "../api";
import socket from "../socket";
import { CustomDatePicker } from "../components/CustomDatePicker";
import CustomDropdown from "../components/CustomDropdown";
import "../components/CustomDropdown.css";

import closeIcon from "../icon/close-icon.png";
import { EmptyRow } from "../App";
import { formatDisplayDate } from "../App";
import { formatIndianTime } from "../App";
import { allowTextInput } from "../App";
import useInfiniteScroll from "../components/useInfiniteScroll";
import { useToast } from "../useToast";
import InfiniteScrollLoader, { InfiniteScrollOverlay } from "../components/InfiniteScrollLoader";
import Button3D from "../components/Button3D";
import ConfirmDialog from "../components/ConfirmDialog";
import CollapseChevron from "../components/CollapseChevron";
import CollapseSection from "../components/CollapseSection";
import { printBill as sendBillToPrinter, printKot as sendKotToPrinter } from "../printUtils";

import "./Orders.css";
import "./ModalCSS.css";
import "../Common.css";
import PageLoader from "../components/PageLoader";

const SEVEN_MIN = 7 * 60 * 1000;
const ONE_MIN = 60 * 1000;
const DATE_STORAGE_KEY = "orders_date_filter";

/**
 * computeBillTotal — the ONE place GST + round-off math happens for an
 * order/bill amount. Every other total shown anywhere (preview modal,
 * edit modal, printed receipt, UPI QR amount, split-by-bill, split-by-
 * amount) is derived from this, instead of each place re-implementing
 * the same subtotal→discount→GST→round formula slightly differently.
 *
 * That used to be exactly the failure mode this consolidates away: this
 * formula was duplicated across four separate spots in this file
 * (BillLayout's `totals`/`billGroups` memos, `computeGSTFromSubtotal`,
 * and buildPrinterOrder's own inline fallback), which is precisely the
 * kind of drift that can make the QR amount, the printed receipt, and
 * the on-screen total each round slightly differently — as far as a
 * customer or a payment reconciliation is concerned, an amount
 * mismatch between what's shown, what's printed, and what's in the QR
 * is a real integrity problem, not just a cosmetic one.
 *
 * Rounding rule: standard "round half up to the nearest rupee" via
 * Math.round(), applied ONCE, to the final GST-inclusive total — never
 * to the subtotal or the individual GST components, which stay as
 * exact paise (2 decimal places) so CGST/SGST always sum to exactly
 * half the tax each and the breakdown shown to the customer adds up.
 *
 * @param {number} subTotal - sum of active (non-cancelled) item prices, already in rupees
 * @param {number} [discountPercent=0] - 0-100
 * @returns {{ subTotal:number, discountPercent:number, discountAmount:number, taxableAmount:number, cgst:number, sgst:number, total:number }}
 */
function computeBillTotal(subTotal, discountPercent = 0) {
  const pct = Math.max(0, Math.min(100, Number(discountPercent) || 0));
  const discountAmount = +(subTotal * (pct / 100)).toFixed(2);
  const taxableAmount = +(subTotal - discountAmount).toFixed(2);
  const cgst = +(taxableAmount * 0.025).toFixed(2);
  const sgst = +(taxableAmount * 0.025).toFixed(2);
  const total = Math.round(taxableAmount + cgst + sgst);
  return { subTotal: +subTotal.toFixed(2), discountPercent: pct, discountAmount, taxableAmount, cgst, sgst, total };
}

const formatDuration = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}m ${seconds}s`;
};

const persistOrder = async (order, refresh) => {
  try {
    await api.put(`/orders/${order.id}`, order);
    refresh && refresh();
  } catch (err) {
    console.error("Failed to persist order", err);
  }
};

const persistOrderEverywhere = async (updatedOrder) => {
  // Update global orders (always valid)
  try {
    await api.put(`/orders/${updatedOrder.id}`, updatedOrder);
  } catch (err) {
    console.error("persistOrderEverywhere: failed to save order", err);
    throw err;
  }

  // If no userId → STOP (TAKE AWAY / guest orders)
  if (!updatedOrder.userId) {
    console.warn("Order has no userId, skipping user sync");
    return;
  }

  // Fetch user safely
  let user;
  try {
    const userRes = await api.get(`/users/${updatedOrder.userId}`);
    user = userRes.data;
  } catch {
    console.warn("User not found, skipping user sync");
    return;
  }

  if (!Array.isArray(user.orders)) return;

  // Update embedded order
  const updatedUser = {
    ...user,
    orders: user.orders.map(o =>
      o.id === updatedOrder.id ? updatedOrder : o
    )
  };

  try {
    await api.put(`/users/${user.id}`, updatedUser);
  } catch (err) {
    // The order itself already saved successfully above — this is just
    // the denormalized copy embedded in the user record falling out of
    // sync, which is non-fatal, so we log but don't re-throw.
    console.warn("persistOrderEverywhere: order saved, but user-record sync failed", err);
  }
};

const getCreatedTime = (order) => {
  if (order.createdAt) {
    const t = new Date(order.createdAt).getTime();
    return isNaN(t) ? Date.now() : t;
  }

  if (order.date) {
    const t = new Date(order.date).getTime();
    return isNaN(t) ? Date.now() : t;
  }

  return Date.now();
};

const normalizeStatus = (status = "") =>
  status.toLowerCase().trim();

// Payment status is stored as "pending" | "completed" on the order itself
// (see server.js POST /orders + payments.js markOrderPaid). Anything else
// unrecognized falls back to "pending" rather than rendering blank.
const normalizePaymentStatus = (order) => {
  const s = (order?.paymentStatus || "pending").toLowerCase().trim();
  return s === "completed" ? "completed" : "pending";
};

// The two possible states of a UPI QR payment record — this system has
// no gateway to report FAILED/USER_DROPPED/EXPIRED/CANCELLED outcomes
// the way Cashfree's simulator could, since nothing but the admin's own
// "Mark as Paid" click ever changes this (see payments.js's file-level
// comment for why). Used by the Payment Status modal.
const PAYMENT_OUTCOME_INFO = {
  PAID: {
    title: "Payment Completed",
    message: "Marked as paid — the payment has been confirmed received.",
    tone: "success"
  },
  PENDING: {
    title: "Awaiting Payment",
    message: "Waiting for the customer to pay, and for staff to confirm it was received.",
    tone: "pending"
  },
  NONE: {
    title: "No Payment Attempted",
    message: "No payment QR has been generated for this order yet.",
    tone: "pending"
  }
};

const STATUS_ORDER = {
  placed: 1,
  preparing: 2,
  "service pickup": 3,
  completed: 4
};

// Any status not in STATUS_ORDER (e.g. "cancelled") falls back to this rank
// instead of undefined, which previously made the sort comparator return
// NaN and break sort stability/order.
const statusRank = (status) => STATUS_ORDER[normalizeStatus(status)] ?? 99;

const resolveQty = (item) =>
  Number(item.qty ?? item.quantity ?? 0);

const resolveUnitPrice = (item) =>
  item.price != null
    ? Number(item.price)
    : resolveQty(item) > 0
      ? Number(item.totalPrice || 0) / resolveQty(item)
      : 0;

const StableQRCode = React.memo(({ value }) => {
  return (
    <QRCodeCanvas
      value={value}
      size={120}
      level="M"
      includeMargin
    />
  );
});

const PAYMENT_POLL_MS = 4000;
/**
 * UpiQrSection — generates a direct UPI payment QR for the current bill
 * amount (no payment gateway) and lets an admin confirm receipt once
 * they've verified the payment themselves (UPI app / bank SMS /
 * statement). See payments.js's file-level comment for the full
 * rationale — there's no webhook or gateway to poll here, so there's
 * nothing to auto-detect; the QR shows what to pay, and confirmation is
 * a deliberate, guarded manual step instead.
 */
const UpiQrSection = React.memo(({ orderId, billNo, amount, onPaid }) => {
  const [payment, setPayment] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const hasFiredOnPaidRef = useRef(false); // onPaid must fire exactly once per order
  const lastCreatedRef = useRef(null); // { orderId, billNo, amountPaise } for the last record actually created
  const { toast } = useToast();

  // Round to paise once so downstream float noise (e.g. a parent
  // re-render recomputing totals via slightly different summation
  // order) can't be mistaken for a real amount change and trigger a
  // spurious re-create of the QR.
  const amountPaise = Math.round(Number(amount) * 100);

  // Create the Payment record (and its upi://pay QR string) for this
  // bill amount. Guarded against both (a) unchanged (orderId, billNo,
  // amount) not re-creating a record, and (b) a burst of renders before
  // the first POST resolves — the ref is set synchronously before the
  // await, not after, so an in-flight request is never duplicated even
  // if the effect re-fires several times in a row.
  useEffect(() => {
    if (!(amountPaise > 0)) return undefined;

    const requestKey = `${orderId}|${billNo ?? ""}|${amountPaise}`;
    if (lastCreatedRef.current === requestKey) return undefined;
    lastCreatedRef.current = requestKey;

    let cancelled = false;

    const createPaymentRecord = async () => {
      setCreating(true);
      setError("");
      try {
        const res = await api.post("/payments/orders", {
          orderId,
          billNo: billNo ?? null,
          amount: amountPaise / 100,
        });
        if (!cancelled) setPayment(res.data);
      } catch (err) {
        console.error("Failed to generate UPI payment QR", err);
        if (!cancelled) {
          setError(err?.response?.data?.error || "Could not generate payment QR");
          lastCreatedRef.current = null; // allow a genuine retry after a failure
        }
      } finally {
        if (!cancelled) setCreating(false);
      }
    };

    createPaymentRecord();
    return () => { cancelled = true; };
  }, [orderId, billNo, amountPaise]);

  const handleConfirmPaid = async () => {
    if (!payment?.id) return;
    setConfirming(true);
    try {
      const res = await api.post(`/payments/orders/${payment.id}/confirm`, { orderId });
      setPayment(res.data);
      setShowConfirmDialog(false);
    } catch (err) {
      console.error("Failed to confirm payment", err);
      toast.error(err?.response?.data?.error || "Could not confirm payment — please try again.");
    } finally {
      setConfirming(false);
    }
  };

  // Notify the parent page exactly once when this order's payment
  // resolves to PAID — the Orders page uses this to auto-open the
  // Payment Status modal.
  useEffect(() => {
    if (payment?.status === "PAID" && !hasFiredOnPaidRef.current) {
      hasFiredOnPaidRef.current = true;
      onPaid && onPaid();
    }
  }, [payment?.status, onPaid]);

  if (payment?.status === "PAID") {
    return (
      <div className="bill-qr-section bill-qr-outcome bill-qr-success">
        <div className="bill-qr-outcome-title">Payment Received ✅</div>
        <div className="bill-qr-amount">₹{Math.round(Number(amount))}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bill-qr-section">
        <div className="bill-qr-title">Scan To Pay via UPI</div>
        <div className="bill-qr-error">{error}</div>
      </div>
    );
  }

  if (creating || !payment?.upiUrl) {
    return (
      <div className="bill-qr-section">
        <div className="bill-qr-title">Scan To Pay via UPI</div>
        <div className="bill-qr-loading">Generating payment QR…</div>
      </div>
    );
  }

  return (
    <div className="bill-qr-section">
      <div className="bill-qr-title">Scan To Pay via UPI</div>
      <StableQRCode value={payment.upiUrl} />
      <div className="bill-qr-amount">₹{Math.round(Number(amount))}</div>
      <div className="bill-qr-status">Waiting for payment…</div>
      <button
        type="button"
        className="bill-qr-confirm-btn"
        onClick={() => setShowConfirmDialog(true)}
      >
        Mark as Paid
      </button>

      {showConfirmDialog && (
        <ConfirmDialog
          open
          title="Confirm payment received"
          message={
            <>
              Confirm that <strong>₹{Math.round(Number(amount))}</strong> was received via UPI for
              Order <strong>{orderId}</strong>{billNo ? <> (Bill {billNo})</> : null}?
              <br />
              Only confirm after verifying the payment in your own UPI app, bank SMS, or statement —
              this cannot be undone.
            </>
          }
          confirmLabel={confirming ? "Confirming…" : "Yes, Mark as Paid"}
          onCancel={() => !confirming && setShowConfirmDialog(false)}
          onConfirm={handleConfirmPaid}
        />
      )}
    </div>
  );
});

/**
 * PaymentStatusModal — shows a UPI payment record's current status for
 * an order, with full details, in a shared modal-overlay/admin-modal.
 * Only two real states exist in this system — PENDING (QR generated,
 * not yet confirmed) and PAID (an admin clicked "Mark as Paid" — see
 * UpiQrSection / payments.js) — there's no gateway to report
 * FAILED/USER_DROPPED/etc, since nothing but that manual confirmation
 * ever changes a record's status.
 */
const PaymentStatusModal = ({ order, onClose }) => {
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    if (!order) return;
    let cancelled = false;
    setLoading(true);
    setFetchError("");

    (async () => {
      try {
        const res = await api.get(`/payments/orders`, { params: { orderId: order.id } });
        if (!cancelled) {
          const docs = Array.isArray(res.data) ? res.data : [];
          // Prefer an actually-PAID document over merely "most recent" —
          // a stray/duplicate QR record can end up created after the
          // real successful one (e.g. a receipt reprinted before the
          // buildPrinterOrder fix that stopped doing this), leaving a
          // never-confirmed PENDING record with a LATER createdAt than
          // the payment that actually went through. Showing "most
          // recent" unconditionally would then report an already-paid
          // order as still pending. The order's own paymentStatus (set
          // once via markOrderPaid, see payments.js) is the true
          // source of truth — find the PAID doc to show its details if
          // the order is marked completed; otherwise fall back to the
          // most recent attempt.
          const paidDoc = docs.find(d => d.status === "PAID");
          const mostRecent = docs[0] || null;
          setPayment(
            normalizePaymentStatus(order) === "completed"
              ? (paidDoc || mostRecent)
              : mostRecent
          );
        }
      } catch (err) {
        console.error("Failed to fetch payment status", err);
        if (!cancelled) setFetchError("Could not load payment status.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [order]);

  if (!order) return null;

  // Same authoritative-order-status override for the outcome card itself:
  // if the order is genuinely marked completed, never show anything other
  // than the success card, even if the payment doc we ended up with
  // (paidDoc might not exist if it was never fetched) says otherwise.
  const info = normalizePaymentStatus(order) === "completed"
    ? PAYMENT_OUTCOME_INFO.PAID
    : (PAYMENT_OUTCOME_INFO[payment?.status] || PAYMENT_OUTCOME_INFO.NONE);

  const formatDateTime = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "—" : d.toLocaleString("en-IN");
  };

  return (
    <div className="modal-overlay modal-anim-in" >
      <div className="admin-modal modal-anim-in payment-status-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3>Payment Status — Order {order.id}</h3>
          <Button3D variant="cancel" iconOnly onClick={onClose}>
            <img src={closeIcon} alt="Close" />
          </Button3D>
        </div>

        <div className="admin-modal-body">
          {loading ? (
            <div className="payment-status-loading">Checking payment status…</div>
          ) : fetchError ? (
            <div className="payment-status-outcome payment-status-failed">
              <div className="payment-status-outcome-title">{fetchError}</div>
            </div>
          ) : (
            <>
              <div className={`payment-status-outcome payment-status-${info.tone}`}>
                <div className="payment-status-outcome-title">{info.title}</div>
                <p className="payment-status-outcome-message">{info.message}</p>
              </div>

              {payment && (
                <div className="payment-status-details">
                  <div className="payment-status-detail-row">
                    <span>Amount</span>
                    <span>₹{Math.round(Number(payment.amount))}</span>
                  </div>
                  <div className="payment-status-detail-row">
                    <span>Transaction Reference</span>
                    <span className="payment-status-detail-mono">{payment.id}</span>
                  </div>
                  <div className="payment-status-detail-row">
                    <span>UPI ID</span>
                    <span className="payment-status-detail-mono">{payment.upiVpa}</span>
                  </div>
                  {payment.confirmedBy && (
                    <div className="payment-status-detail-row">
                      <span>Confirmed By</span>
                      <span>{payment.confirmedBy}</span>
                    </div>
                  )}
                  {payment.confirmedAt && (
                    <div className="payment-status-detail-row">
                      <span>Confirmed At</span>
                      <span>{formatDateTime(payment.confirmedAt)}</span>
                    </div>
                  )}
                  {payment.billNo != null && (
                    <div className="payment-status-detail-row">
                      <span>Bill No.</span>
                      <span>{payment.billNo}</span>
                    </div>
                  )}
                  <div className="payment-status-detail-row">
                    <span>Initiated</span>
                    <span>{formatDateTime(payment.createdAt)}</span>
                  </div>
                  <div className="payment-status-detail-row">
                    <span>Last Updated</span>
                    <span>{formatDateTime(payment.updatedAt)}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="admin-modal-footer">
          <Button3D variant="cancel" onClick={onClose}>Close</Button3D>
        </div>
      </div>
    </div>
  );
};

const BillLayout = React.memo(({
  order,
  editable,
  onQtyChange,
  onBillAssign,
  onClose,
  splitPeople,
  setSplitPeople,
  splitBills,
  setSplitBills,
  applySplitAmount,
  applySplitBill,
  onPaid
}) => {
  const totals = useMemo(() => {
    // Cancelled items are excluded from the bill entirely (not just relying
    // on totalPrice already being 0) — this is what the QR/preview amount
    // and the printed receipt total are ultimately derived from.
    const activeItems = order.items.filter(i => normalizeStatus(i.status) !== "cancelled");
    const subTotal = activeItems.reduce(
      (sum, i) => sum + Number(i.totalPrice || 0),
      0
    );
    return computeBillTotal(subTotal, order.discount?.percent);
  }, [order.items, order.discount]);

  const billGroups = useMemo(() => {
    if (order.splitType !== "bill" || !order.splitBillCount) return null;

    const billCount = Number(order.splitBillCount);
    const discountPercent = order.discount?.percent;

    const groups = Array.from({ length: billCount }, (_, i) => {
      const billNo = i + 1;
      const items = order.items.filter(
        it => Number(it.billAssignment) === billNo && normalizeStatus(it.status) !== "cancelled"
      );
      const subTotal = +items.reduce((sum, it) => sum + Number(it.totalPrice || 0), 0).toFixed(2);
      const { total } = computeBillTotal(subTotal, discountPercent);
      return { billNo, itemCount: items.length, subTotal, total };
    });

    const unassignedCount = order.items.filter(
      it => !it.billAssignment && normalizeStatus(it.status) !== "cancelled"
    ).length;
    return { groups, unassignedCount };
  }, [order.splitType, order.splitBillCount, order.items, order.discount]);

  const finalAmount =
    order.splitType === "amount"
      ? order.splitDetails?.perHead
      : order.splitType === "bill"
        ? billGroups?.groups?.[0]?.total
        : totals.total;

  const finalBillNo = order.splitType === "bill" ? billGroups?.groups?.[0]?.billNo ?? null : null;

  return (
    <div className="bill-receipt">
      <div className="bill-header">
        <Button3D variant="cancel" iconOnly style={{ position: "absolute", right: 0 }}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}><img src={closeIcon} alt="" /></Button3D>
        <h3>Sam Cafe</h3>
        <p>Contact: +91-9080179608</p>
        <hr />
        <p>Name : {order.userName}</p>
        <p>Order : {order.id}</p>
        <p>Date  : {formatDisplayDate(order.date)}</p>
        <p>
          Time  : {formatIndianTime(order.date, order.time)}
        </p>
        <hr />
      </div>

      <div className="bill-table">
        <div className="bill-row head">
          <span>ITEM</span>
          <span>QTY</span>
          <span>TOTAL</span>
        </div>

        {order.items.map((item, idx) => {
          const showBillPicker = editable && order.splitType === "bill" && order.splitBillCount > 0;
          const rowClass = [
            "bill-row",
            editable && "bill-row--editable",
            showBillPicker && "bill-row--split"
          ].filter(Boolean).join(" ");

          return (
            <div key={idx} className={rowClass}>
              <span>{item.dishName}</span>

              {editable ? (
                <>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) =>
                      onQtyChange(idx, {
                        quantity: e.target.value,
                        price: resolveUnitPrice(item)
                      })
                    }
                  />

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={resolveUnitPrice(item)}
                    onChange={(e) =>
                      onQtyChange(idx, {
                        quantity: item.quantity,
                        price: Number(e.target.value)
                      })
                    }
                  />
                </>
              ) : (
                <span>{item.quantity}</span>
              )}

              <span>₹{item.totalPrice}</span>

              {showBillPicker && (
                <select
                  className={`bill-assign-select ${!item.billAssignment ? "bill-assign-select--empty" : ""}`}
                  value={item.billAssignment || ""}
                  onChange={(e) => onBillAssign(idx, e.target.value ? Number(e.target.value) : null)}
                  title="Assign this dish to a bill"
                >
                  <option value="">Unassigned</option>
                  {Array.from({ length: Number(order.splitBillCount) }, (_, i) => i + 1).map(billNo => (
                    <option key={billNo} value={billNo}>Bill {billNo}</option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>

      <hr />

      <div className="bill-summary">
        {order.splitType === "amount" && (
          <div className="bill-split-info">
            Split: {order.splitDetails?.customers} people <br />
            Per Head: ₹{order.splitDetails?.perHead}
          </div>
        )}

        {order.splitType === "bill" && billGroups && (
          <div className="bill-split-info">
            {billGroups.groups.map(g => (
              <div key={g.billNo}>
                Bill {g.billNo}: {g.itemCount} item{g.itemCount === 1 ? "" : "s"} — ₹{g.total}
              </div>
            ))}
            {billGroups.unassignedCount > 0 && (
              <div className="bill-split-warning">
                ⚠ {billGroups.unassignedCount} item{billGroups.unassignedCount === 1 ? "" : "s"} not yet assigned to a bill
              </div>
            )}
          </div>
        )}
        <div><span>Subtotal</span><span>₹{totals.subTotal}</span></div>
        {totals.discountPercent > 0 && (
          <div className="bill-discount-row">
            <span>Discount ({totals.discountPercent}%){order.discount?.reason ? ` — ${order.discount.reason}` : ""}</span>
            <span>−₹{totals.discountAmount}</span>
          </div>
        )}
        <div><span>CGST @2.5%</span><span>₹{totals.cgst}</span></div>
        <div><span>SGST @2.5%</span><span>₹{totals.sgst}</span></div>
        <div className="total">
          <span>TOTAL</span>
          <span>₹{totals.total}</span>
        </div>
      </div>

      {editable && (
        <div className="bill-split-actions">

          {/* SPLIT BY PEOPLE */}
          <div className="split-box">
            <input
              type="number"
              placeholder="No. of people"
              value={splitPeople}
              onChange={(e) => setSplitPeople(e.target.value)}
            />
            <Button3D iconOnly onClick={applySplitAmount}>Split Amount</Button3D>
          </div>

          {/* SPLIT BY BILL */}
          <div className="split-box">
            <input
              type="number"
              placeholder="No. of bills"
              value={splitBills}
              onChange={(e) => setSplitBills(e.target.value)}
            />
            <Button3D iconOnly onClick={applySplitBill}>Split Bill</Button3D>
          </div>

        </div>
      )}

      {/* QR only shows on the Preview modal and printed receipt — not the
          Edit modal, since the bill amount can still change there — and
          never once the order's payment is already marked completed,
          since there's nothing left to collect. */}
      {!editable && (
        normalizePaymentStatus(order) === "completed" ? (
          <div className="bill-qr-section bill-qr-outcome bill-qr-success">
            <div className="bill-qr-outcome-title">Payment Received ✅</div>
            <div className="bill-qr-amount">₹{Math.round(Number(finalAmount))}</div>
          </div>
        ) : (
          <UpiQrSection orderId={order.id} billNo={finalBillNo} amount={finalAmount} onPaid={onPaid} />
        )
      )}
    </div>
  );
});

const ItemTimer = React.memo(({ item, order }) => {

  const [, setTick] = useState(0);

  const isDone =
    item.status === "completed" ||
    item.status === "service pickup";

  useEffect(() => {
    if (isDone) return;
    const interval = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(interval);
  }, [isDone]);

  if (isDone) return "—";

  if (item.pickupStatus) return null; // handled by pickupStatus block above

  const start = item.createdAt
    ? new Date(item.createdAt).getTime()
    : getCreatedTime(order);

  if (isNaN(start)) return "—";

  const elapsed = Date.now() - start;

  if (elapsed <= SEVEN_MIN) {
    return (
      <span style={{ color: "#2e7d32", fontWeight: 600 }}>
        {formatDuration(SEVEN_MIN - elapsed)}
      </span>
    );
  }

  return (
    <span style={{ color: "#d32f2f", fontWeight: 600 }}>
      +{formatDuration(elapsed - SEVEN_MIN)}
    </span>
  );
});

/**
 * OrderActionsMenu — the Orders table row's "⋮" actions menu, rebuilt to
 * match the same custom-dropdown look used elsewhere in the admin panel
 * (Dishes page's "Select Ingredient" popup / CustomDropdown component):
 * a centered dimmed-backdrop overlay with a rounded popup card, portal-
 * rendered to document.body so it always sits above the table regardless
 * of scroll position. Unlike CustomDropdown (single-value picker), this
 * renders arbitrary actions — including disabled and danger-styled ones —
 * so it's a dedicated small component rather than reusing CustomDropdown
 * directly.
 */
const OrderActionsMenu = ({ title, items, onClose }) => {
  return createPortal(
    <div className="cdd-overlay">
      <div className="cdd-popup" onMouseDown={(e) => e.stopPropagation()}>
        {title && <div className="cdd-popup-title">{title}</div>}
        <div className="cdd-options">
          {items.map((item, i) => (
            <div
              key={i}
              className={[
                "cdd-option",
                item.danger ? "cdd-option-danger" : "",
                item.disabled ? "cdd-option-disabled" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => {
                if (item.disabled) return;
                onClose();
                item.onClick();
              }}
            >
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
};

const OrderRow = React.memo(({
  order,
  isActive,
  onToggle,
  onPickup,
  onCancelItem,
  onOptionsClick,
  navigate,
  orderStatus,
  setAdminData,
  toast,
  isMenuOpen,
  onMenuAction
}) => {
  const isPaymentCompleted = normalizePaymentStatus(order) === "completed";
  const isOrderCancelled = normalizeStatus(order.status) === "cancelled";
  return (
    <React.Fragment>
      <tr
        ref={undefined}
        className={`order-main-row ${order.priority ? "priority-row" : ""}`}
        onClick={(e) => {
          if (e.target.closest(".options-btn")) return;
          onToggle(order.id);
        }}
      >
        <td>
          <span className="clickable" onClick={() => navigate(`/orders/${order.id}`)}>{order.id}</span>
        </td>
        <td>{formatDisplayDate(order.date)}</td>
        <td>{formatIndianTime(order.date, order.time)}</td>
        <td>{order.userName}</td>
        <td>{order.mode ? order.mode.toUpperCase() : "TAKE AWAY"}</td>
        <td>{order.tableNo != null ? order.tableNo : "---"}</td>
        <td>{order.items.length}</td>
        <td>₹{Math.round(order.resolvedTotal)}</td>
        <td onClick={(e) => e.stopPropagation()}>
          {orderStatus !== "completed" && orderStatus !== "cancelled" ? (
            <input
              type="checkbox"
              checked={order.priority || false}
              onChange={async (e) => {
                const previousOrder = order;
                const updatedOrder = {
                  ...order,
                  priority: e.target.checked
                };

                // 1. INSTANT UI UPDATE
                setAdminData(prev => ({
                  ...prev,
                  orders: prev.orders.map(o =>
                    o.id === order.id ? updatedOrder : o
                  )
                }));

                // 2. BACKEND UPDATE
                try {
                  await persistOrderEverywhere(updatedOrder);
                } catch (err) {
                  toast.error("Failed to update priority");
                  console.error("Failed to update priority", err);
                  // Roll back the optimistic flip — without this the
                  // checkbox stayed showing the new value even though the
                  // server never actually saved it, silently disagreeing
                  // with the backend until the next reload/socket sync.
                  setAdminData(prev => ({
                    ...prev,
                    orders: prev.orders.map(o =>
                      o.id === order.id ? previousOrder : o
                    )
                  }));
                }
              }}
            />
          ) : (
            "---"
          )}
        </td>
        <td>
          <div className={`status status-${normalizeStatus(orderStatus).replace(/\s+/g, "-")}`}>
            {orderStatus}
          </div>
        </td>
        <td>
          <div className={`status status-${normalizePaymentStatus(order)}`}>
            {normalizePaymentStatus(order) === "completed" ? "Completed" : "Pending"}
          </div>
        </td>
        <td className="icon-width">
          <div className="bill-actions">
            <button
              className="options-btn"
              onClick={(e) => {
                e.stopPropagation();
                onOptionsClick(order.id);
              }}
            >
              ⋮
            </button>
            {isMenuOpen && (
              <OrderActionsMenu
                title={`Order ${order.id}`}
                onClose={() => onOptionsClick(order.id)}
                items={[
                  {
                    label: "Edit",
                    disabled: isOrderCancelled || isPaymentCompleted,
                    onClick: () => onMenuAction("edit", order),
                  },
                  {
                    label: "Preview",
                    disabled: isOrderCancelled,
                    onClick: () => onMenuAction("preview", order),
                  },
                  {
                    label: "Print",
                    disabled: isOrderCancelled,
                    onClick: () => onMenuAction("print", order),
                  },
                  {
                    label: "Print KOT",
                    disabled: isOrderCancelled,
                    onClick: () => onMenuAction("printKot", order),
                  },
                  {
                    label: "Payment Status",
                    disabled: isOrderCancelled,
                    onClick: () => onMenuAction("paymentStatus", order),
                  },
                  {
                    label: "Add Discount",
                    disabled: isOrderCancelled || isPaymentCompleted,
                    onClick: () => onMenuAction("discount", order),
                  },
                  {
                    label: "Cancel Order",
                    danger: true,
                    disabled: isOrderCancelled || isPaymentCompleted,
                    onClick: () => onMenuAction("cancel", order),
                  },
                ]}
              />
            )}
          </div>
        </td>
      </tr>

      <tr className={`order-sub-row ${isActive ? "open" : ""}`}>
        <td colSpan={12}>
          <div className="order-sub-content">
            {normalizeStatus(order.status) === "cancelled" && order.cancelReason && (
              <div
                className="cancel-reason-banner"
                style={{
                  background: "#fff0ee",
                  border: "1px solid #f5b7b1",
                  color: "#c0392b",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  marginBottom: "10px",
                  fontSize: "14px"
                }}
              >
                <strong>Cancellation Reason:</strong> {order.cancelReason}
              </div>
            )}
            <table className="order-items-table">
              <thead>
                <tr>
                  <th>Dish</th>
                  <th>Notes</th>
                  <th>Qty</th>
                  <th>Timer</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, idx) => {
                  const itemStatus = normalizeStatus(item.status);
                  const isCancellable =
                    itemStatus !== "cancelled" &&
                    itemStatus !== "completed" &&
                    itemStatus !== "service pickup" &&
                    normalizeStatus(order.status) !== "cancelled" &&
                    normalizePaymentStatus(order) !== "completed";

                  return (
                    <tr key={idx} className={itemStatus === "cancelled" ? "order-item-cancelled" : ""}>
                      <td>
                        <span
                          className={item.categoryId === "combo" ? "combo-item" : "clickable"}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (item.categoryId === "combo") return;
                            navigate(
                              `/dishes/${item.categoryId}/${item.dishId || "__custom__"}`,
                              { state: { fromOrder: true, orderItem: item } }
                            );
                          }}
                        >
                          {item.dishName}
                        </span>
                      </td>
                      <td>{item.notes ? item.notes : "-----------"}</td>
                      <td>{item.qty ?? item.quantity}</td>
                      <td>
                        {item.pickupStatus === "on_time" && (
                          <span style={{ color: "#2e7d32", fontWeight: 600 }}>On Time</span>
                        )}
                        {item.pickupStatus === "late" && (
                          <span style={{ color: "#d32f2f", fontWeight: 600 }}>Late Order</span>
                        )}
                        {!item.pickupStatus && <ItemTimer item={item} order={order} />}
                      </td>
                      <td>
                        <div className={`status status-${itemStatus.replace(/\s+/g, "-")}`}>
                          {item.status}
                        </div>
                      </td>
                      <td>
                        <div className="order-item-actions">
                          {order.status === "preparing" && item.status === "preparing" && (
                            <Button3D style={{ boxSizing: "border-box" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onPickup({ orderId: order.id, itemIndex: idx, item });
                              }}>Order Pickup</Button3D>
                          )}
                          {isCancellable && (
                            <Button3D
                              variant="cancel"
                              onClick={(e) => {
                                e.stopPropagation();
                                onCancelItem({ order, itemIndex: idx, item });
                              }}
                            >
                              Cancel
                            </Button3D>
                          )}
                          {itemStatus === "cancelled" && (
                            <span className="order-item-cancelled-label">Cancelled</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </td>
      </tr>
    </React.Fragment>
  );
});


const Orders = ({ adminData, setAdminData }) => {
  // Orders owns its own sort state instead of sharing App.js's global
  // sortConfig. The shared sortConfig was also written to by Categories,
  // Dishes, Stocks, Favourites, and Users — so navigating here after
  // sorting Users by "mobile" left sortConfig.key = "mobile", which falls
  // through to this page's `default: return 0` case and silently skips
  // sorting entirely. A page-local sort key avoids that cross-page leak.

  // ── Hooks

  const [sortConfig, setSortConfig] = useState({ key: "id", direction: "desc" });
  const handleSort = useCallback((key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  }, []);
  const { toast } = useToast();
  const navigate = useNavigate();
  const orders = adminData.orders || [];
  const [activeOrderIds, setActiveOrderIds] = useState([]);
  const [pickupConfirm, setPickupConfirm] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [originalBill, setOriginalBill] = useState(null);
  const [splitPeople, setSplitPeople] = useState("");
  const [splitBills, setSplitBills] = useState("");

  // Use local date string to avoid UTC offset shifting the date (e.g. UTC+5:30)
  const toLocalISO = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const todayISO = toLocalISO(new Date());

  const getWeekRange = () => {
    const today = new Date();
    const day = today.getDay(); // 0=Sun
    const mon = new Date(today); mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    return { from: toLocalISO(mon), to: todayISO };
  };

  const getMonthRange = () => {
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: toLocalISO(first), to: todayISO };
  };

  // Full previous calendar month (1st through last day) — distinct from
  // "This Month", which runs from the 1st of the current month to today.
  const getLastMonthRange = () => {
    const today = new Date();
    const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: toLocalISO(firstOfLastMonth), to: toLocalISO(lastOfLastMonth) };
  };

  const [datePreset, setDatePreset] = useState(() => {
    const saved = JSON.parse(localStorage.getItem(DATE_STORAGE_KEY) || "null");
    return saved?.preset || "today";
  });

  const applyPreset = useCallback((preset) => {
    setDatePreset(preset);
    if (preset === "today") { setFromDate(todayISO); setToDate(todayISO); }
    else if (preset === "week") { const r = getWeekRange(); setFromDate(r.from); setToDate(r.to); }
    else if (preset === "month") { const r = getMonthRange(); setFromDate(r.from); setToDate(r.to); }
    else if (preset === "lastMonth") { const r = getLastMonthRange(); setFromDate(r.from); setToDate(r.to); }
  }, [todayISO]);

  const toggleOrder = useCallback((orderId) => {
    setActiveOrderIds(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  }, []);

  // Always recompute range from saved preset so "month"/"week" are never stale
  const [fromDate, setFromDate] = useState(() => {
    const saved = JSON.parse(localStorage.getItem(DATE_STORAGE_KEY) || "null");
    const preset = saved?.preset || "today";
    if (preset === "month") {
      const d = new Date(); const first = new Date(d.getFullYear(), d.getMonth(), 1);
      const y = first.getFullYear(), m = String(first.getMonth() + 1).padStart(2, "0"), day = String(first.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
    if (preset === "week") {
      const today = new Date();
      const day = today.getDay();
      const mon = new Date(today);
      mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
      return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
    }
    if (preset === "lastMonth") {
      const d = new Date(); const first = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const y = first.getFullYear(), m = String(first.getMonth() + 1).padStart(2, "0"), day = String(first.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
    return saved?.fromDate || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
  });

  const [toDate, setToDate] = useState(() => {
    const saved = JSON.parse(localStorage.getItem(DATE_STORAGE_KEY) || "null");
    const preset = saved?.preset || "today";
    // For month and week, "to" is always today
    const n = new Date();
    const todayLocal = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
    if (preset === "month" || preset === "week") return todayLocal;
    if (preset === "lastMonth") {
      const lastOfLastMonth = new Date(n.getFullYear(), n.getMonth(), 0);
      return `${lastOfLastMonth.getFullYear()}-${String(lastOfLastMonth.getMonth() + 1).padStart(2, "0")}-${String(lastOfLastMonth.getDate()).padStart(2, "0")}`;
    }
    return saved?.toDate || todayLocal;
  });
  const location = useLocation();
  const isOrdersPage = location.pathname === "/orders";
  const orderRefs = useRef({});
  const [openMenuOrderId, setOpenMenuOrderId] = useState(null);
  const [editBillOrder, setEditBillOrder] = useState(null);
  const [previewBillOrder, setPreviewBillOrder] = useState(null);
  const [editableBill, setEditableBill] = useState(null);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [cancelOrderConfirm, setCancelOrderConfirm] = useState(null);
  const [cancelItemConfirm, setCancelItemConfirm] = useState(null);
  const [cancelItemReason, setCancelItemReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonOption, setCancelReasonOption] = useState("");
  const [cancelItemReasonOption, setCancelItemReasonOption] = useState("");
  const [discountModalOrder, setDiscountModalOrder] = useState(null);
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [paymentStatusOrder, setPaymentStatusOrder] = useState(null);

  const CANCEL_REASONS = [
    "Customer changed their mind",
    "Item out of stock",
    "Kitchen delay / unable to prepare",
    "Order placed by mistake",
    "Others",
  ];
  const tableWrapperRef = useRef(null);

  useEffect(() => {
    const id = location.state?.scrollToOrderId;
    if (!id) return;

    const el = orderRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("blink");

      setTimeout(() => {
        el.classList.remove("blink");
      }, 900);
    }
  }, [location.state]);

  // Creates a UPI QR payment record for this bill and returns the
  // upi://pay deep-link to encode as the printed-receipt QR (the
  // on-screen bill preview uses UpiQrSection directly instead, which
  // creates its own record the same way). No fallback UPI ID here on
  // failure — unlike the old Cashfree integration, there's no gateway
  // that could legitimately be "down" independent of this call; if this
  // fails, it's because no UPI ID is configured in Admin → Bank
  // Accounts (or a genuine network/server error), and silently
  // printing a QR against some other placeholder UPI ID would send a
  // real customer's real payment to the wrong account — a bug far
  // worse than a receipt printing without a QR and an error being
  // surfaced instead.
  const buildUpiUrl = useCallback(async (amount, orderId, billNo = null) => {
    try {
      const res = await api.post("/payments/orders", { orderId, billNo, amount: Number(amount) });
      return res.data?.upiUrl || null;
    } catch (err) {
      console.error("Could not generate UPI payment QR for printed bill", err);
      toast.error(err?.response?.data?.error || "Could not generate payment QR — printing receipt without one.");
      return null;
    }
  }, [toast]);

  /* ---------------- SAFE TOTAL RESOLUTION ---------------- */
  const resolveItemTotal = useCallback(
    (item) =>
      Number(
        item.totalPrice ??
        (item.price && item.qty ? item.price * item.qty : 0)
      ),
    []
  );

  /* ---------------- NORMALIZE ORDERS (RUNS ONCE PER CHANGE) ---------------- */
  const normalizedOrders = useMemo(() => {
    return orders.map(o => ({
      ...o,
      resolvedTotal:
        o.totalAmount ??
        o.items.reduce(
          (sum, item) => sum + resolveItemTotal(item),
          0
        ),
    }));
  }, [orders, resolveItemTotal]);

  const filteredOrders = useMemo(() => {
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);

    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    return normalizedOrders.filter(order => {
      if (!order.date) return false;

      const orderDate = new Date(order.date);
      const withinDate = orderDate >= from && orderDate <= to;

      const matchesStatus =
        statusFilter === "all" ||
        normalizeStatus(order.status) === statusFilter;

      const orderMode = (order.mode || "take away").toLowerCase();

      const matchesMode =
        modeFilter === "all" ||
        orderMode === modeFilter;

      const q = orderSearch.trim().toLowerCase();
      const matchesSearch = !q || (
        (order.id || "").toLowerCase().includes(q) ||
        (order.userName || "").toLowerCase().includes(q) ||
        order.items.some(i => (i.dishName || "").toLowerCase().includes(q)) ||
        String(order.tableNo ?? "").includes(q)
      );

      return withinDate && matchesStatus && matchesMode && matchesSearch;
    });
  }, [normalizedOrders, fromDate, toDate, statusFilter, modeFilter, orderSearch]);

  const sortedOrders = useMemo(() => {
    const data = [...filteredOrders];

    const sortKey = sortConfig.key ?? "id";
    const sortDir = sortConfig.direction ?? "desc";

    data.sort((a, b) => {

      // PRIORITY FIRST (GLOBAL OVERRIDE)
      if (a.priority && !b.priority) return -1;
      if (!a.priority && b.priority) return 1;

      // NORMAL SORTING
      switch (sortKey) {
        case "id": {
          const idA = a.id || "";
          const idB = b.id || "";
          return sortDir === "asc"
            ? idA.localeCompare(idB)
            : idB.localeCompare(idA);
        }

        case "date":
          return sortDir === "asc"
            ? new Date(a.date) - new Date(b.date)
            : new Date(b.date) - new Date(a.date);

        case "total":
          return sortDir === "asc"
            ? a.resolvedTotal - b.resolvedTotal
            : b.resolvedTotal - a.resolvedTotal;

        case "status":
          return sortDir === "asc"
            ? statusRank(a.status) - statusRank(b.status)
            : statusRank(b.status) - statusRank(a.status);

        default:
          return 0;
      }
    });

    return data;
  }, [filteredOrders, sortConfig]);

  const { displayLimit, sentinelRef, hasMore, isLoadingMore } =
    useInfiniteScroll(sortedOrders.length, 50, tableWrapperRef.current);

  const deriveOrderStatusFromItems = useCallback((items, currentStatus) => {
    if (normalizeStatus(currentStatus) === "cancelled") return "cancelled";
    const activeItems = items.filter(i => normalizeStatus(i.status) !== "cancelled");
    if (activeItems.length === 0) return "cancelled";
    if (activeItems.every(i => i.status === "completed")) return "completed";
    if (activeItems.some(i => i.status === "preparing" || i.status === "service pickup"))
      return "preparing";
    return "placed";
  }, []);

  useEffect(() => {
    if (!orders.length) return;

    let changed = false;

    const normalized = orders.map(o => {
      const items = o.items.map(item => {
        const updated = {
          ...item,
          status: item.status || "placed",
          createdAt: item.createdAt || o.createdAt,
          pickupAt: item.pickupAt || null
        };

        if (
          item.status === updated.status &&
          item.createdAt === updated.createdAt &&
          item.pickupAt === updated.pickupAt
        ) {
          return item;
        }

        changed = true;
        return updated;
      });

      if (items === o.items && o.status) {
        return o;
      }

      changed = true;

      return {
        ...o,
        status: o.status || "placed",
        items
      };
    });

    if (!changed) return;

    setAdminData(prev => ({
      ...prev,
      orders: normalized
    }));
  }, []);

  useEffect(() => {

    if (!isOrdersPage) return;

    const interval = setInterval(() => {

      setAdminData(prev => {

        let changed = false;

        const updatedOrders = prev.orders.map(order => {

          let orderChanged = false;
          const start = new Date(order.createdAt).getTime();

          const items = order.items.map(item => {

            if (item.status === "placed" && Date.now() - start >= ONE_MIN) {
              orderChanged = true;
              return { ...item, status: "preparing" };
            }

            if (item.status === "service pickup" && item.pickupAt) {
              const pickupStart = new Date(item.pickupAt).getTime();

              if (!isNaN(pickupStart) && Date.now() - pickupStart >= ONE_MIN) {
                orderChanged = true;
                return { ...item, status: "completed" };
              }
            }

            return item;
          });

          const newStatus = deriveOrderStatusFromItems(items, order.status);

          if (!orderChanged && newStatus === order.status) return order;

          changed = true;

          const updatedOrder = {
            ...order,
            items,
            status: newStatus
          };

          // persistOrder() does PUT /orders/:id, and the server itself
          // broadcasts the resulting "data-change" event to other tabs
          // (this tab is excluded via the X-Socket-Id header in api.js).
          // We do NOT also call socket.emit("data-change", ...) here —
          // the server has no listener for an incoming client-side
          // "data-change" event, so that call was a no-op, and removing
          // it also removes one of the two redundant code paths that
          // were racing against this same optimistic update.
          if (orderChanged || newStatus !== order.status) {
            persistOrder(updatedOrder);
          }

          return updatedOrder;
        });

        return changed
          ? { ...prev, orders: updatedOrders }
          : prev;

      });

    }, 5000);

    return () => clearInterval(interval);

  }, [isOrdersPage]);

  useEffect(() => {
    localStorage.setItem(
      DATE_STORAGE_KEY,
      JSON.stringify({ fromDate, toDate, preset: datePreset })
    );
  }, [fromDate, toDate, datePreset]);

  useEffect(() => {
    if (!location.state) return;

    const { mode, status, fromDate: fd, toDate: td } = location.state;

    if (mode) setModeFilter(mode);
    if (status) setStatusFilter(status);
    if (fd) setFromDate(fd);
    if (td) setToDate(td);

  }, [location.state]);

  // Note: the status/mode filters render via CustomDropdown, which owns
  // its own open/close state internally — a leftover
  // window-click-to-close-dropdowns effect (referencing state that no
  // longer exists) used to live here and has been removed.

  const exportOrders = (orders, from, to) => {
    if (!orders.length) {
      toast.warning("No orders in selected date range");
      return;
    }

    const rows = [];

    sortedOrders.forEach(order => {
      order.items.forEach((item, index) => {
        const ingredients = (item.ingredients || [])
          .map(i => `${i.name} - ${i.quantity}g`)
          .join(", ");

        rows.push({
          OrderID: index === 0 ? order.id : "",
          Date: index === 0 ? order.date : "",
          Time: index === 0 ? order.time : "",
          Customer: index === 0 ? (order.userName || "Guest") : "",
          Category: item.categoryName || item.categoryId || "",
          Dish: item.dishName,
          Quantity: item.quantity ?? item.qty ?? 0,
          Customized: item.isCustomized ? "Yes" : "No",
          Ingredients: ingredients
        });
      });
    });

    exportToExcel({ rows, sheetName: "Orders", fileName: `orders_${from}_to_${to}.xlsx` });
  };

  // Builds the printer-shaped payload for a single receipt. `overrides`
  // lets split-bill printing swap in a filtered item list / per-bill
  // totals without duplicating the base mapping logic.
  const buildPrinterOrder = async (order, overrides = {}) => {
    const totalWithGST = overrides.totalWithGST || order.totalWithGST || (() => {
      const subTotal = Number(order.resolvedTotal || 0);
      return computeBillTotal(subTotal, order.discount?.percent);
    })();

    const sourceItems = overrides.items || order.items;

    // Once the order's payment is already completed, there's nothing left
    // to collect — printing/re-printing a receipt must NOT create yet
    // another payment record every time (buildUpiUrl below does exactly
    // that unconditionally). Each of those stray records leaves behind
    // its own Payment document stuck at PENDING forever (nobody ever
    // scans a QR nobody asked for), and since GET /payments/orders
    // returns the newest one first, that dangling PENDING record — not
    // the real PAID one — is what the Payment Status modal then shows,
    // even though the order is genuinely fully paid. Skip QR creation
    // entirely here.
    const upiUrl = overrides.upiUrl
      || (normalizePaymentStatus(order) === "completed" ? null : await buildUpiUrl(totalWithGST.total, order.id, overrides.billNo ?? null));

    return {
      id: order.id,
      date: order.date,
      time: order.time,
      tableNo: order.tableNo,
      staffName: order.staffName,
      userName: order.userName || "Guest",
      items: sourceItems.map(item => ({
        dishName: item.dishName,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
        selectedSize: item.selectedSize,
        spiciness: item.spiciness
      })),
      totalWithGST,
      upiUrl,
      ...(overrides.splitLabel ? { splitLabel: overrides.splitLabel } : {}),
      ...(overrides.perHeadNote ? { perHeadNote: overrides.perHeadNote } : {})
    };
  };

  const printBill = async (order) => {
    // previewBillOrder / editableBill (built via recalcOrderTotals) already
    // carry a correct totalWithGST object computed from the actual line
    // items. Orders coming straight from the table only have
    // `resolvedTotal`. Prefer the former — recomputing from
    // resolvedTotal when it's missing (e.g. after a bill edit) was
    // silently producing NaN/undefined totals that never made it to the
    // printer.

    // ── SPLIT AMOUNT: still a single receipt with every item listed —
    //    the split is only a payment note ("split N ways, ₹X/head")
    //    printed at the bottom, not a change to what's billed.
    if (order.splitType === "amount" && order.splitDetails?.customers > 0) {
      const { customers, perHead } = order.splitDetails;
      const printerOrder = await buildPrinterOrder(order, {
        perHeadNote: `Split ${customers} ways — ₹${perHead} per head`
      });

      const result = await sendBillToPrinter(socket, printerOrder);
      if (!result.success) {
        toast.error(result.error || "Failed to print bill");
        console.error("Bill print failed:", result.error);
      }
      return;
    }

    // ── SPLIT BILL: item-level split — each bill only lists the dishes
    //    assigned to it (via the per-row bill picker), with its own
    //    subtotal/tax/total computed from just those items. Prints one
    //    receipt per bill.
    if (order.splitType === "bill" && order.splitBillCount > 0) {
      const billCount = Number(order.splitBillCount);
      const discountPercent = Math.max(0, Math.min(100, Number(order.discount?.percent) || 0));

      const unassigned = order.items.filter(it => !it.billAssignment);
      if (unassigned.length > 0) {
        toast.error(`${unassigned.length} item(s) aren't assigned to a bill yet — assign every dish before printing.`);
        return;
      }

      let allOk = true;
      for (let billNo = 1; billNo <= billCount; billNo++) {
        const billItems = order.items.filter(it => Number(it.billAssignment) === billNo);
        if (billItems.length === 0) continue; // nothing assigned to this bill — skip, don't print an empty receipt

        const subTotal = +billItems.reduce((sum, it) => sum + Number(it.totalPrice || 0), 0).toFixed(2);
        const totalWithGST = computeBillTotal(subTotal, discountPercent);

        const printerOrder = await buildPrinterOrder(order, {
          items: billItems,
          totalWithGST,
          billNo,
          splitLabel: `Bill ${billNo} of ${billCount}`
        });

        const result = await sendBillToPrinter(socket, printerOrder);
        if (!result.success) {
          allOk = false;
          toast.error(result.error || `Failed to print bill ${billNo}/${billCount}`);
          console.error(`Split bill ${billNo}/${billCount} print failed:`, result.error);
        }
      }
      if (allOk) toast.success(`Printed ${billCount} split bills`);
      return;
    }

    // ── NORMAL (unsplit) bill — single receipt, unchanged behaviour.
    const printerOrder = await buildPrinterOrder(order);
    const result = await sendBillToPrinter(socket, printerOrder);
    if (!result.success) {
      toast.error(result.error || "Failed to print bill");
      console.error("Bill print failed:", result.error);
    }
  };

  const printKot = async (order) => {
    const printerOrder = {
      id: order.id,
      date: order.date,
      time: order.time,
      tableNo: order.tableNo,
      staffName: order.userName,
      items: (order.items || [])
        .filter(item => normalizeStatus(item.status) !== "cancelled")
        .map(item => ({
          dishName: item.dishName,
          quantity: item.quantity,
          selectedSize: item.selectedSize,
          spiciness: item.spiciness,
          notes: item.notes
        }))
    };

    const result = await sendKotToPrinter(socket, printerOrder);
    if (!result.success) {
      toast.error(result.error || "Failed to print KOT");
      console.error("KOT print failed:", result.error);
    } else {
      toast.success("KOT sent to printer");
    }
  };

  const cancelOrder = async (order, reason) => {
    const updatedOrder = {
      ...order,
      status: "cancelled",
      cancelReason: reason.trim(),
      cancelledAt: new Date().toISOString(),
      items: order.items.map(item => ({
        ...item,
        status: "cancelled"
      }))
    };

    // 1. INSTANT UI UPDATE
    setAdminData(prev => ({
      ...prev,
      orders: prev.orders.map(o => (o.id === order.id ? updatedOrder : o))
    }));

    // 2. BACKEND UPDATE
    try {
      await persistOrderEverywhere(updatedOrder);
      socket.emit("data-change", {
        resource: "orders",
        action: "updated",
        payload: updatedOrder
      });
      toast.success("Order cancelled");
    } catch (err) {
      toast.error("Failed to cancel order");
      console.error("Failed to cancel order", err);
    }
  };

  const cancelOrderItem = async (order, itemIndex, reason) => {
    const items = order.items.map((item, idx) =>
      idx === itemIndex
        ? {
          ...item,
          status: "cancelled",
          cancelReason: reason.trim(),
          cancelledAt: new Date().toISOString(),
          // Zero out billing contribution — cancelled dishes shouldn't be charged.
          totalPrice: 0
        }
        : item
    );

    const recalced = recalcOrderTotals({ ...order, items });
    const newStatus = deriveOrderStatusFromItems(recalced.items, order.status);

    const updatedOrder = {
      ...recalced,
      status: newStatus
    };

    // 1. INSTANT UI UPDATE
    setAdminData(prev => ({
      ...prev,
      orders: prev.orders.map(o => (o.id === order.id ? updatedOrder : o))
    }));

    // 2. BACKEND UPDATE
    try {
      await persistOrderEverywhere(updatedOrder);
      socket.emit("data-change", {
        resource: "orders",
        action: "updated",
        payload: updatedOrder
      });
      toast.success("Dish cancelled");
    } catch (err) {
      toast.error("Failed to cancel dish");
      console.error("Failed to cancel dish", err);
    }
  };

  const applyDiscount = async (order, percent, reason) => {
    const pct = Math.max(0, Math.min(100, Number(percent) || 0));

    const updatedOrder = recalcOrderTotals({
      ...order,
      discount: { percent: pct, reason: reason.trim() }
    });

    // 1. INSTANT UI UPDATE
    setAdminData(prev => ({
      ...prev,
      orders: prev.orders.map(o => (o.id === order.id ? updatedOrder : o))
    }));

    // 2. BACKEND UPDATE
    try {
      await persistOrderEverywhere(updatedOrder);
      socket.emit("data-change", {
        resource: "orders",
        action: "updated",
        payload: updatedOrder
      });
      toast.success("Discount applied");
    } catch (err) {
      toast.error("Failed to apply discount");
      console.error("Failed to apply discount", err);
    }
  };

  const closeAllBillOverlays = useCallback(() => {
    setEditBillOrder(null);
    setPreviewBillOrder(null);
    if (originalBill) setEditableBill(originalBill);
    setOriginalBill(null);
    // Reset the split-input fields too — otherwise a half-typed "3" left
    // in the Split Amount/Split Bill box would carry over into the next
    // order's edit session and could be applied by mistake.
    setSplitPeople("");
    setSplitBills("");
  }, [originalBill]);

  const closeOptionsMenu = useCallback(() => {
    setOpenMenuOrderId(null);
  }, []);

  // No outside-click listener needed here: OrderActionsMenu's own
  // .cdd-overlay backdrop (mirroring CustomDropdown) already closes the
  // menu on any click outside the popup card, same pattern as the
  // Dishes-page "Select Ingredient" dropdown.

  // Single dispatcher for every row-level dropdown action — keeps the
  // custom (non-portal) dropdown's per-item onClick handlers thin.
  const handleMenuAction = useCallback((action, order) => {
    closeOptionsMenu();

    switch (action) {
      case "edit": {
        closeAllBillOverlays();
        const cloned = JSON.parse(JSON.stringify(order));
        setEditableBill(cloned);
        setOriginalBill(cloned);
        setEditBillOrder(true);
        break;
      }
      case "preview":
        closeAllBillOverlays();
        setPreviewBillOrder(order);
        break;
      case "print":
        printBill(order);
        break;
      case "printKot":
        printKot(order);
        break;
      case "paymentStatus":
        setPaymentStatusOrder(order);
        break;
      case "discount":
        setDiscountModalOrder(order);
        setDiscountPercent(order?.discount?.percent != null ? String(order.discount.percent) : "");
        setDiscountReason(order?.discount?.reason || "");
        break;
      case "cancel":
        setCancelOrderConfirm(order);
        setCancelReason("");
        setCancelReasonOption("");
        break;
      default:
        break;
    }
  }, [closeOptionsMenu, closeAllBillOverlays]);

  // No loading check here: App.js already gates the entire route tree
  // behind its own top-level loading screen (isAppLoading) and only
  // mounts this page once fetchAllData has fully resolved — so by the
  // time Orders.js renders at all, `adminData.orders` is guaranteed to
  // be the real, current result. A branch with zero orders (a brand-new
  // venue, for instance) is a valid final state, not a sign that data is
  // still loading, so an empty array here should render the normal empty
  // orders table, not a spinner.

  const recalcOrderTotals = (order) => {
    const items = order.items.map(item => {
      // Cancelled items must never contribute to the bill — their price
      // was zeroed out at cancellation time (see cancelOrderItem), and
      // recomputing totalPrice here from quantity×price would silently
      // undo that zeroing (qty/price are still stored on the item even
      // after it's cancelled) and add the dish's cost right back into
      // the total.
      if (normalizeStatus(item.status) === "cancelled") {
        return { ...item, totalPrice: 0 };
      }

      const qty = Number(item.quantity || 0);
      const price = Number(
        item.price ??
        item.unitPrice ??
        resolveUnitPrice(item)
      );

      const totalPrice = +(qty * price).toFixed(2);

      return {
        ...item,
        quantity: qty,
        price,
        unitPrice: price,
        totalPrice
      };
    });

    // Cancelled items are excluded here too (not just relying on their
    // totalPrice being 0 above) so the bill total is unambiguously
    // computed only from active items.
    const subTotal = +items
      .filter(i => normalizeStatus(i.status) !== "cancelled")
      .reduce((sum, i) => sum + i.totalPrice, 0)
      .toFixed(2);

    const discountPct = Math.max(0, Math.min(100, Number(order.discount?.percent) || 0));
    const { discountAmount, taxableAmount, cgst, sgst, total } = computeBillTotal(subTotal, discountPct);

    return {
      ...order,
      items,
      totalAmount: taxableAmount,
      totalWithGST: {
        subTotal,
        discountPercent: discountPct,
        discountAmount,
        cgst,
        sgst,
        total
      }
    };
  };

  const applySplitAmount = () => {
    if (!splitPeople || isNaN(splitPeople)) return;

    // Same "exclude cancelled items" rule as every other total on this
    // page (BillLayout's totals/billGroups, buildPrinterOrder) — this
    // previously summed ALL items including cancelled ones, which could
    // make a per-head split amount larger than the bill actually is.
    const subTotal = editableBill.items
      .filter(i => normalizeStatus(i.status) !== "cancelled")
      .reduce((sum, i) => sum + Number(i.totalPrice || 0), 0);

    // Split the GST-INCLUSIVE total, not the pre-tax subtotal — a
    // per-head amount that excluded tax would mean the group
    // collectively pays less than the actual bill (the tax has to come
    // from somewhere). Uses the same computeBillTotal every other total
    // on this page goes through, so this splits exactly the number
    // shown as "TOTAL" on the bill, not a different, untaxed figure.
    const { total } = computeBillTotal(subTotal, editableBill.discount?.percent);

    // Rounded to the nearest whole rupee — an unrounded per-head amount
    // (e.g. "150.3333...") is not a payable UPI amount and doesn't match
    // how every other total on this page rounds. Note N people at a
    // rounded per-head amount can sum to slightly more/less than the
    // bill's own rounded total (a few paise to a rupee either way,
    // depending on N) — an unavoidable consequence of splitting a
    // rounded whole-rupee total evenly; kept simple/predictable rather
    // than distributing the remainder unevenly across guests.
    const perHead = Math.round(total / Number(splitPeople));

    setEditableBill(prev => ({
      ...prev,
      splitType: "amount",
      splitDetails: {
        customers: Number(splitPeople),
        perHead
      }
    }));
  };

  const applySplitBill = () => {
    if (!splitBills || isNaN(splitBills)) return;
    const billCount = Number(splitBills);
    if (billCount < 1) return;

    // Item-level split: create `billCount` empty bill slots and clear any
    // existing assignments so staff can pick which bill each dish goes to
    // via the per-row bill-picker, rather than guessing an even split.
    setEditableBill(prev => ({
      ...prev,
      splitType: "bill",
      splitBillCount: billCount,
      items: prev.items.map(item => ({ ...item, billAssignment: null }))
    }));
  };

  const onBillAssign = (itemIndex, billNo) => {
    setEditableBill(prev => ({
      ...prev,
      items: prev.items.map((item, idx) =>
        idx === itemIndex ? { ...item, billAssignment: billNo } : item
      )
    }));
  };

  return (
    <div className="orders-page">
      <div className="orders-header">
        <div className="orders-header-div">
          <div className="header-title-row">
            <div className="header-collapse-col">
              <button
                type="button"
                className="header-collapse-btn"
                onClick={() => setHeaderCollapsed(prev => !prev)}
                data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={headerCollapsed ? "Expand header" : "Collapse header"}
                aria-expanded={!headerCollapsed}
              >
                <CollapseChevron collapsed={headerCollapsed} />
              </button>
            </div>
            <div className="header-title-col">
              <div className="header-title-with-count">
                <h2 className="orders-title">Orders</h2>
                <span className="result-count">{sortedOrders.length} order(s)</span>
              </div>
            </div>
          </div>
          <Button3D style={{ marginLeft: "auto" }} onClick={() => exportOrders(filteredOrders, fromDate, toDate)}>
            Export
          </Button3D>
        </div>

        <CollapseSection collapsed={headerCollapsed}>
          <div className="filter-bar">
            <div className="filter-groups">
              <div className="filter-group">
                <div className="orders-search-wrapper">
                  <input
                    className="search-input"
                    placeholder=" Search by order ID, customer, dish…"
                    value={orderSearch}
                    onChange={e => setOrderSearch(allowTextInput(orderSearch, e.target.value, 100, 5))}
                  />
                  {orderSearch && (
                    <button className="orders-search-clear" onClick={() => setOrderSearch("")}>✕</button>
                  )}
                </div>
              </div>

              <div className="filter-group">
                <button
                  type="button"
                  className={`filter-pill${datePreset === "today" ? " active" : ""}`}
                  onClick={() => applyPreset("today")}
                >
                  Today
                </button>
                <button
                  type="button"
                  className={`filter-pill${datePreset === "week" ? " active" : ""}`}
                  onClick={() => applyPreset("week")}
                >
                  This Week
                </button>
                <button
                  type="button"
                  className={`filter-pill${datePreset === "month" ? " active" : ""}`}
                  onClick={() => applyPreset("month")}
                >
                  This Month
                </button>
                <button
                  type="button"
                  className={`filter-pill${datePreset === "lastMonth" ? " active" : ""}`}
                  onClick={() => applyPreset("lastMonth")}
                >
                  Last Month
                </button>
              </div>

              <div className="filter-group">
                <div className="orders-div-group">
                  <CustomDatePicker
                    label="From"
                    value={fromDate}
                    max={toDate}
                    onChange={(s) => { setFromDate(s); setDatePreset("custom"); if (s > toDate) setToDate(s); }}
                  />
                  <CustomDatePicker
                    label="To"
                    value={toDate}
                    min={fromDate}
                    max={todayISO}
                    onChange={(s) => { setToDate(s); setDatePreset("custom"); }}
                  />
                </div>
              </div>
            </div>

            <div className="filter-group">
              <div className="orders-div-group">
                <CustomDropdown
                  value={modeFilter}
                  onChange={(val) => setModeFilter(val || "all")}
                  options={[
                    { value: "all", label: "All Modes" },
                    { value: "dine in", label: "dine in" },
                    { value: "take away", label: "take away" }
                  ]}
                  placeholder={null}
                />

                <CustomDropdown
                  value={statusFilter}
                  onChange={(val) => setStatusFilter(val || "all")}
                  options={[
                    { value: "all", label: "All Status" },
                    { value: "placed", label: "placed" },
                    { value: "preparing", label: "preparing" },
                    { value: "service pickup", label: "service pickup" },
                    { value: "completed", label: "completed" },
                    { value: "cancelled", label: "cancelled" }
                  ]}
                  placeholder={null}
                />
              </div>
            </div>
          </div>
        </CollapseSection>

      </div>

      <div className={`orders-table-wrapper${headerCollapsed ? " header-is-collapsed" : ""}`} ref={tableWrapperRef}>
        <table className="orders-table">
          <colgroup>
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col style={{ width: "120px" }} />
            <col style={{ width: "120px" }} />
            <col style={{ width: "60px" }} />
          </colgroup>
          <thead>
            <tr>
              <th
                onClick={() => handleSort("id")}
                className={sortConfig.key === "id" ? "sorted" : ""}
              >
                <span className="th-content sort-th">
                  <span>Order ID</span>
                  <span className="sort-arrow">
                    {sortConfig.key === "id"
                      ? sortConfig.direction === "asc" ? "▲" : "▼"
                      : ""}
                  </span>
                </span>
              </th>
              <th
                onClick={() => handleSort("date")}
                className={sortConfig.key === "date" ? "sorted" : ""}
              >
                <span className="th-content sort-th">
                  <span>Date</span>
                  <span className="sort-arrow">
                    {sortConfig.key === "date"
                      ? sortConfig.direction === "asc" ? "▲" : "▼"
                      : ""}
                  </span>
                </span>
              </th>
              <th>time of order</th>
              <th>Customer Name</th>
              <th>Mode</th>
              <th>Table No</th>
              <th>No of Items</th>
              <th>Total</th>
              <th>Priority</th>
              <th
                onClick={() => handleSort("status")}
                className={sortConfig.key === "status" ? "sorted" : ""}
              >
                <span className="th-content sort-th">
                  <span>Status</span>
                  <span className="sort-arrow">
                    {sortConfig.key === "status"
                      ? sortConfig.direction === "asc"
                        ? "▲"
                        : "▼"
                      : ""}
                  </span>
                </span>
              </th>
              <th>Payment Status</th>
              <th className="icon-width">Bill</th>
            </tr>
          </thead>

          <tbody>
            {sortedOrders.length === 0 ? (
              <EmptyRow colSpan={12} message="No orders for selected date range" />
            ) : (
              sortedOrders.slice(0, displayLimit).map(order => {
                const orderStatus = deriveOrderStatusFromItems(order.items, order.status);
                return (
                  <OrderRow
                    key={order.id}
                    colSpan={12}
                    order={order}
                    orderStatus={orderStatus}
                    isActive={activeOrderIds.includes(order.id)}
                    onToggle={toggleOrder}
                    onPickup={setPickupConfirm}
                    onCancelItem={setCancelItemConfirm}
                    onOptionsClick={(id) => {
                      setOpenMenuOrderId(prev => prev === id ? null : id);
                    }}
                    isMenuOpen={openMenuOrderId === order.id}
                    onMenuAction={handleMenuAction}
                    navigate={navigate}
                    setAdminData={setAdminData}
                    toast={toast}
                  />
                );
              }))}
            <InfiniteScrollLoader
              sentinelRef={sentinelRef}
              hasMore={hasMore}
              colSpan={12}
            />
          </tbody>
        </table>
      </div>
      <InfiniteScrollOverlay isLoading={isLoadingMore} />
      {pickupConfirm && (
        <div
          className="pickup-overlay"
          onClick={() => setPickupConfirm(null)}
        >
          <div
            className="pickup-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Confirm Order Pickup</h3>
            <p>Are you sure you want to mark this item as picked up?</p>

            {pickupConfirm?.item?.notes && (
              <div className="pickup-notes">
                <strong>Notes:</strong>
                <div className="pickup-notes-text">
                  {pickupConfirm.item.notes}
                </div>
              </div>
            )}

            {!pickupConfirm?.item?.notes && (
              <div className="pickup-notes muted">
                <strong>Notes:</strong> -----
              </div>
            )}

            <div className="pickup-actions">
              <Button3D variant="cancel" onClick={() => setPickupConfirm(null)}>Cancel</Button3D>

              <Button3D onClick={() => {
                const { orderId, itemIndex } = pickupConfirm;

                setAdminData(prev => ({
                  ...prev,
                  orders: prev.orders.map(o => {
                    if (o.id !== orderId) return o;

                    const items = o.items.map((i, index) => {
                      if (index !== itemIndex) return i;

                      const now = Date.now();
                      const start = i.createdAt
                        ? new Date(i.createdAt).getTime()
                        : getCreatedTime(o);

                      const pickupStatus =
                        now - start <= SEVEN_MIN ? "on_time" : "late";

                      return {
                        ...i,
                        status: "service pickup",
                        pickupAt: new Date().toISOString(),
                        pickupStatus
                      };
                    });

                    const newStatus = deriveOrderStatusFromItems(items, o.status);

                    const updated = {
                      ...o,
                      items,
                      status: newStatus
                    };
                    persistOrder(updated);

                    return updated;
                  })
                }));

                setPickupConfirm(null);
              }}>Confirm</Button3D>
            </div>
          </div>
        </div>
      )}

      {cancelOrderConfirm && (
        <div
          className="pickup-overlay"
        >
          <div
            className="pickup-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Cancel Order {cancelOrderConfirm.id}</h3>
            <p>Are you sure you want to cancel this order? Please select a reason.</p>

            <div className="cancel-reason-options" style={{ marginTop: "10px" }}>
              {CANCEL_REASONS.map((reason, i) => (
                <div className="form-check" key={i}>
                  <input
                    className="form-check-input"
                    type="radio"
                    name="cancelOrderReason"
                    id={`cancelOrderReason-${i}`}
                    checked={cancelReasonOption === reason}
                    onChange={() => {
                      setCancelReasonOption(reason);
                      setCancelReason(reason === "Others" ? "" : reason);
                    }}
                  />
                  <label className="form-check-label" htmlFor={`cancelOrderReason-${i}`}>
                    {reason}
                  </label>
                </div>
              ))}

              {cancelReasonOption === "Others" && (
                <input
                  type="text"
                  className="cancel-reason-others-input"
                  placeholder="Enter reason (max 5 words, 100 characters)…"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(allowTextInput(cancelReason, e.target.value, 100, 5))}
                  autoFocus
                  style={{
                    width: "100%",
                    marginTop: "10px",
                    padding: "8px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    boxSizing: "border-box",
                    fontFamily: "inherit"
                  }}
                />
              )}
            </div>

            <div className="pickup-actions">
              <Button3D
                variant="cancel"
                onClick={() => {
                  setCancelOrderConfirm(null);
                  setCancelReasonOption("");
                  setCancelReason("");
                }}
              >
                Back
              </Button3D>

              <Button3D
                disabled={!cancelReason.trim()}
                onClick={async () => {
                  await cancelOrder(cancelOrderConfirm, cancelReason);
                  setCancelOrderConfirm(null);
                  setCancelReason("");
                  setCancelReasonOption("");
                }}
              >
                Confirm Cancel
              </Button3D>
            </div>
          </div>
        </div>
      )}

      {cancelItemConfirm && (
        <div
          className="pickup-overlay"
        >
          <div
            className="pickup-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Cancel Dish</h3>
            <p>
              Are you sure you want to cancel{" "}
              <strong>{cancelItemConfirm?.item?.dishName}</strong>? Please select a reason.
            </p>

            <div className="cancel-reason-options" style={{ marginTop: "10px" }}>
              {CANCEL_REASONS.map((reason, i) => (
                <div className="form-check" key={i}>
                  <input
                    className="form-check-input"
                    type="radio"
                    name="cancelItemReason"
                    id={`cancelItemReason-${i}`}
                    checked={cancelItemReasonOption === reason}
                    onChange={() => {
                      setCancelItemReasonOption(reason);
                      setCancelItemReason(reason === "Others" ? "" : reason);
                    }}
                  />
                  <label className="form-check-label" htmlFor={`cancelItemReason-${i}`}>
                    {reason}
                  </label>
                </div>
              ))}

              {cancelItemReasonOption === "Others" && (
                <input
                  type="text"
                  className="cancel-reason-others-input"
                  placeholder="Enter reason (max 5 words, 100 characters)…"
                  value={cancelItemReason}
                  onChange={(e) => setCancelItemReason(allowTextInput(cancelItemReason, e.target.value, 100, 5))}
                  autoFocus
                  style={{
                    width: "100%",
                    marginTop: "10px",
                    padding: "8px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    boxSizing: "border-box",
                    fontFamily: "inherit"
                  }}
                />
              )}
            </div>

            <div className="pickup-actions">
              <Button3D
                variant="cancel"
                onClick={() => {
                  setCancelItemConfirm(null);
                  setCancelItemReason("");
                  setCancelItemReasonOption("");
                }}
              >
                Back
              </Button3D>

              <Button3D
                disabled={!cancelItemReason.trim()}
                onClick={async () => {
                  const { order, itemIndex } = cancelItemConfirm;
                  await cancelOrderItem(order, itemIndex, cancelItemReason);
                  setCancelItemConfirm(null);
                  setCancelItemReason("");
                  setCancelItemReasonOption("");
                }}
              >
                Confirm Cancel
              </Button3D>
            </div>
          </div>
        </div>
      )}

      {discountModalOrder && (
        <div className="pickup-overlay">
          <div
            className="pickup-modal discount-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Add Discount — Order {discountModalOrder.id}</h3>
            <p>Enter a discount percentage and the reason for it.</p>

            <div className="discount-modal-fields">
              <div className="mat">
                <input
                  type="number"
                  className="mat-input"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder=" "
                  value={discountPercent}
                  onChange={(e) => {
                    let v = e.target.value;
                    if (v !== "" && Number(v) > 100) v = "100";
                    if (v !== "" && Number(v) < 0) v = "0";
                    setDiscountPercent(v);
                  }}
                  autoFocus
                />
                <label className="mat-label">Discount %</label>
                <span className="mat-bar" />
              </div>

              <input
                type="text"
                className="discount-reason-input"
                placeholder="Reason for discount (max 5 words, 100 characters)…"
                value={discountReason}
                onChange={(e) => setDiscountReason(allowTextInput(discountReason, e.target.value, 100, 5))}
              />
            </div>

            <div className="pickup-actions">
              <Button3D
                variant="cancel"
                onClick={() => {
                  setDiscountModalOrder(null);
                  setDiscountPercent("");
                  setDiscountReason("");
                }}
              >
                Cancel
              </Button3D>

              <Button3D
                disabled={
                  discountPercent === "" ||
                  isNaN(Number(discountPercent)) ||
                  Number(discountPercent) <= 0 ||
                  !discountReason.trim()
                }
                onClick={async () => {
                  await applyDiscount(discountModalOrder, discountPercent, discountReason);
                  setDiscountModalOrder(null);
                  setDiscountPercent("");
                  setDiscountReason("");
                }}
              >
                Apply Discount
              </Button3D>
            </div>
          </div>
        </div>
      )}

      {paymentStatusOrder && (
        <PaymentStatusModal
          order={paymentStatusOrder}
          onClose={() => setPaymentStatusOrder(null)}
        />
      )}

      {editBillOrder && (
        <div className="overlay">
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <BillLayout
              onClose={closeAllBillOverlays}
              order={editableBill}
              editable

              splitPeople={splitPeople}
              setSplitPeople={setSplitPeople}
              splitBills={splitBills}
              setSplitBills={setSplitBills}
              applySplitAmount={applySplitAmount}
              applySplitBill={applySplitBill}
              onBillAssign={onBillAssign}

              onQtyChange={(idx, { quantity, price }) => {
                setEditableBill(prev => {
                  const q = quantity === "" ? "" : Number(quantity);
                  const p = Math.max(0, price);

                  const newItems = prev.items.map((item, i) =>
                    i === idx
                      ? {
                        ...item,
                        quantity: q,
                        price: p,
                        totalPrice: quantity === "" ? item.totalPrice : +(q * p).toFixed(2)
                      }
                      : item
                  );

                  return {
                    ...prev,
                    items: newItems
                  };
                });
              }}
            />

            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => setEditBillOrder(null)}>Cancel</Button3D>
              <Button3D
                className="modal-save-btn"
                onClick={() => {
                  const previewData = recalcOrderTotals(editableBill);

                  setEditBillOrder(null);
                  setPreviewBillOrder(previewData);
                }}
              >
                Preview
              </Button3D>
              <Button3D className="modal-save-btn" onClick={async () => {
                try {
                  const updatedOrder = recalcOrderTotals(
                    JSON.parse(JSON.stringify(editableBill))
                  );

                  await persistOrderEverywhere(updatedOrder);

                  setAdminData(prev => ({
                    ...prev,
                    orders: prev.orders.map(o =>
                      o.id === updatedOrder.id ? updatedOrder : o
                    )
                  }));

                  setEditBillOrder(null);
                } catch (err) {
                  toast.error("Failed to save bill");
                  console.error("Save failed", err);
                }
              }}>Save</Button3D>
            </div>
          </div>
        </div>
      )}

      {previewBillOrder && (
        <div className="overlay">
          <div className="admin-modal">
            <BillLayout
              onClose={closeAllBillOverlays}
              order={previewBillOrder}
              onPaid={() => {
                // Payment was just confirmed via "Mark as Paid" while staff
                // had the Preview modal open with the QR showing — surface
                // the outcome immediately via the Payment Status modal
                // instead of leaving them looking at a stale QR.
                const paidOrder = previewBillOrder;
                setPreviewBillOrder(null);
                setPaymentStatusOrder(paidOrder);
              }}
            />

            <div className="admin-modal-footer">
              <button
                className="modal-confirm-btn"
                onClick={() => {
                  printBill(previewBillOrder);
                  setPreviewBillOrder(null);
                }}
              >
                <span className="shadow"></span>
                <span className="edge"></span>
                <span className="front">Print</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Orders;