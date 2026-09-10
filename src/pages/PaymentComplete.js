/**
 * PaymentComplete.js — public "Transaction Completed" page.
 *
 * ⚠ NO LONGER REACHABLE IN NORMAL USE. This page existed for the old
 * Cashfree integration — a customer's phone would land here after
 * finishing (or backing out of) payment in their bank app, via
 * Cashfree's order_meta.return_url, and it polled the public
 * GET /payments/public-status/:id endpoint for the outcome.
 *
 * The Direct UPI QR Payment System (see payments.js) generates a plain
 * upi://pay deep-link QR instead of a Cashfree-hosted session — when a
 * customer's UPI app finishes paying, it simply returns to their own
 * phone's home screen; there is no redirect back to this admin panel's
 * domain at all, and GET /payments/public-status/:id no longer exists
 * server-side. This file is left in place rather than deleted (in case
 * something still links to it, and to avoid guessing at removal scope
 * beyond what was asked for) but the fetch below will now fail if this
 * route is ever visited directly.
 *
 * Original doc comment, for context:
 * This is the page a CUSTOMER's own phone lands on after they finish (or
 * back out of) the UPI payment flow in their bank app, via Cashfree's
 * order_meta.return_url. It has no admin session and needs none — it
 * only reads the Cashfree order id from the URL's ?order_id= query
 * param and polls the public, unauthenticated
 * GET /payments/public-status/:id endpoint for the outcome.
 *
 * This is intentionally simple and self-contained (own CSS, no AuthShell/
 * admin chrome) since it renders before any auth check and must work even
 * if the admin panel's own session/venue state is in a broken state.
 */

import { useEffect, useRef, useState } from "react";
import api from "../api";
import dishkyLogo from "../icon/dishky-logo.png";
import "./PaymentComplete.css";

// Same 4 outcomes tracked everywhere else in the app (Orders.js's
// PAYMENT_OUTCOME_INFO / payments.js's mapCashfreeStatus) — kept in sync
// with that copy, just phrased for the customer rather than staff.
const OUTCOME_INFO = {
  PAID: {
    icon: "✓",
    tone: "success",
    title: "Payment Successful",
    message: "Thanks — your payment has been received. The restaurant has been notified.",
  },
  PENDING: {
    icon: "…",
    tone: "pending",
    title: "Payment Pending",
    message: "We're still waiting for your bank/UPI app to confirm this payment. This page will update automatically.",
  },
  USER_DROPPED: {
    icon: "!",
    tone: "failed",
    title: "Payment Not Completed",
    message: "It looks like the payment was closed before finishing. No amount has been charged. Please try again from the restaurant's QR.",
  },
  FAILED: {
    icon: "✕",
    tone: "failed",
    title: "Payment Failed",
    message: "Your bank or the payment gateway declined this transaction. No amount has been charged. Please try again.",
  },
  EXPIRED: {
    icon: "✕",
    tone: "failed",
    title: "Payment Session Expired",
    message: "This payment link timed out before it was completed. Please scan the QR again to retry.",
  },
  CANCELLED: {
    icon: "✕",
    tone: "failed",
    title: "Payment Cancelled",
    message: "This payment was cancelled before it was completed. No amount has been charged.",
  },
};

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 2 * 60 * 1000; // stop auto-refreshing a PENDING result after 2 minutes

const PaymentComplete = () => {
  const [status, setStatus] = useState(null); // null while loading
  const [amount, setAmount] = useState(null);
  const [declineMessage, setDeclineMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const pollTimerRef = useRef(null);
  const startedAtRef = useRef(Date.now());

  const orderId = new URLSearchParams(window.location.search).get("order_id");

  useEffect(() => {
    if (!orderId) {
      setLoadError("Missing payment reference — nothing to show here.");
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await api.get(`/payments/public-status/${encodeURIComponent(orderId)}`);
        if (cancelled) return;
        setStatus(res.data?.status || null);
        setAmount(res.data?.amount ?? null);
        setDeclineMessage(res.data?.message || "");
        setLoadError("");

        const stillPending = res.data?.status === "PENDING";
        const withinTimeout = Date.now() - startedAtRef.current < POLL_TIMEOUT_MS;
        if (stillPending && withinTimeout) {
          pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load payment status", err);
        setLoadError("Couldn't load your payment status. Please check your bank/UPI app for confirmation.");
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [orderId]);

  const info = OUTCOME_INFO[status] || null;

  return (
    <div className="pc-page">
      <div className="pc-card">
        <img src={dishkyLogo} alt="" className="pc-logo" />

        {loadError && !info ? (
          <>
            <div className="pc-icon pc-icon-pending">?</div>
            <h1 className="pc-title">Status Unavailable</h1>
            <p className="pc-message">{loadError}</p>
          </>
        ) : !info ? (
          <>
            <div className="pc-icon pc-icon-pending pc-spin">…</div>
            <h1 className="pc-title">Checking Payment…</h1>
            <p className="pc-message">Please wait a moment while we confirm your transaction.</p>
          </>
        ) : (
          <>
            <div className={`pc-icon pc-icon-${info.tone}`}>{info.icon}</div>
            <h1 className="pc-title">{info.title}</h1>
            <p className="pc-message">{declineMessage || info.message}</p>
            {amount != null && (
              <p className="pc-amount">Amount: ₹{Math.round(Number(amount))}</p>
            )}
          </>
        )}

        <p className="pc-footer-note">You can close this tab now.</p>
      </div>
    </div>
  );
};

export default PaymentComplete;