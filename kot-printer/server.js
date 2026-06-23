const express = require("express");
const cors = require("cors");
const escpos = require("escpos");

escpos.Network = require("escpos-network");

const app = express();
app.use(cors());
app.use(express.json());

/* =========================================================
   CONFIG
========================================================= */
const PRINTER_IP = "192.168.1.87";
const PRINTER_PORT = 9100;

/* =========================================================
   FIXED WIDTH HELPERS (32 CHAR RECEIPT)
========================================================= */
const LINE_WIDTH = 32;
const DIVIDER = "--------------------------------";

const money = (v) => Number(v || 0).toFixed(2);

const padRight = (text, width) => {
  text = String(text || "");
  return text.length >= width ? text.slice(0, width) : text + " ".repeat(width - text.length);
};

const padLeft = (text, width) => {
  text = String(text || "");
  return text.length >= width ? text.slice(0, width) : " ".repeat(width - text.length) + text;
};

// ITEM (18) | QTY (6) | TOTAL (8)
const formatItemRow = (name, qty, total) =>
  padRight(name, 18) + padLeft(String(qty), 6) + padLeft(money(total), 8);

// LABEL ........... AMOUNT (right-aligned)
const formatAmountRow = (label, amount) =>
  padRight(label, LINE_WIDTH - 8) + padLeft(money(amount), 8);

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-GB") : "";

const formatTime = (date, time) => {
  if (!date || !time) return time || "";
  const dt = new Date(`${date}T${time}`);
  if (isNaN(dt.getTime())) return time;
  return dt.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

/* =========================================================
   OPEN PRINTER HELPER — avoids repeated boilerplate
   cb(printer) is called once device is open.
   Any device/printer error is caught and sent to res.
========================================================= */
function openPrinter(res, cb) {
  const device = new escpos.Network(PRINTER_IP, PRINTER_PORT, { timeout: 5000 });
  const printer = new escpos.Printer(device);

  device.open((err) => {
    if (err) {
      console.error("❌ Printer open failed:", err.message);
      return res.status(503).json({ success: false, error: "Printer not reachable. Check IP and WiFi." });
    }
    try {
      cb(printer, device);
    } catch (ex) {
      console.error("❌ Print job error:", ex.message);
      try { device.close(); } catch (_) { }
      res.status(500).json({ success: false, error: ex.message });
    }
  });
}

/* =========================================================
   KOT — Kitchen Order Ticket
   POST /print/kot
   Body: { order: { id, date, time, tableNo, staffName, items: [{ dishName, selectedSize, spiciness, notes, quantity }] } }
========================================================= */
app.post("/print/kot", (req, res) => {
  const { order } = req.body;

  if (!order || !Array.isArray(order.items) || order.items.length === 0) {
    return res.status(400).json({ success: false, error: "Invalid order data" });
  }

  console.log(`KOT — Order #${order.id} | Table: ${order.tableNo || "?"} | Items: ${order.items.length}`);

  openPrinter(res, (printer) => {
    printer
      .align("CT")
      .style("B")
      .size(1, 1)
      .text("SAM CAFE")
      .size(0, 0)
      .text("KITCHEN ORDER TICKET")
      .style("NORMAL")
      .text(DIVIDER)
      .align("LT")
      .text(`Order  : #${order.id}`)
      .text(`Date   : ${formatDate(order.date)}`)
      .text(`Time   : ${formatTime(order.date, order.time)}`)
      .text(`Table  : ${order.tableNo || "—"}`)
      .text(`Staff  : ${order.staffName || "Admin"}`)
      .text(DIVIDER);

    order.items.forEach((item, i) => {
      printer
        .style("B")
        .text(`${item.quantity}x  ${item.dishName}`)
        .style("NORMAL");

      if (item.selectedSize || item.spiciness) {
        printer.text(`     Variant : ${[item.selectedSize, item.spiciness].filter(Boolean).join(" / ")}`);
      }
      if (item.notes && item.notes.trim()) {
        printer.text(`     Note    : ${item.notes}`);
      }

      if (i < order.items.length - 1) printer.text("  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·");
    });

    printer
      .text(DIVIDER)
      .align("CT")
      .style("B")
      .text("** Prepare Immediately **")
      .style("NORMAL")
      .feed(3)
      .cut()
      .close();

    res.json({ success: true, message: `KOT printed for order #${order.id}` });
  });
});

/* =========================================================
   BILL
   POST /print/bill
   Body: { order: { id, date, time, tableNo, staffName, items: [{ dishName, quantity, totalPrice }],
           totalWithGST: { subTotal, cgst, sgst, total }, upiUrl } }
========================================================= */
app.post("/print/bill", (req, res) => {
  const { order } = req.body;

  if (!order || !Array.isArray(order.items) || !order.totalWithGST) {
    return res.status(400).json({ success: false, error: "Invalid bill data" });
  }

  console.log(`Bill — Order #${order.id} | Total: ₹${order.totalWithGST.total}`);

  openPrinter(res, (printer) => {
    // ── Header ──
    printer
      .align("CT")
      .style("B")
      .size(1, 1)
      .text("Sam Cafe")
      .size(0, 0)
      .style("NORMAL")
      .text("Contact: +91-9080179608")
      .text("Lavanya Complex, 9, Iyer Bungalow")
      .text("Moondrumavadi Main Road, GR Nagar")
      .text("Madurai - 625007")
      .text(DIVIDER)
      .align("LT")
      .text(`Order  : #${order.id}`)
      .text(`Date   : ${formatDate(order.date)}`)
      .text(`Time   : ${formatTime(order.date, order.time)}`)
      .text(`Table  : ${order.tableNo || "T1"}`)
      .text(`Staff  : ${order.staffName || "Admin"}`)
      .text(DIVIDER);

    // ── Column header ──
    printer
      .style("B")
      .text(padRight("ITEM", 18) + padLeft("QTY", 6) + padLeft("TOTAL", 8))
      .style("NORMAL")
      .text(DIVIDER);

    // ── Items ──
    order.items.forEach((item) => {
      printer.text(formatItemRow(item.dishName, item.quantity, item.totalPrice));

      // show variant/notes under the item if present
      if (item.selectedSize || item.spiciness) {
        printer.text(`  ${[item.selectedSize, item.spiciness].filter(Boolean).join(" / ")}`);
      }
    });

    // ── GST Summary ──
    printer
      .text(DIVIDER)
      .text(formatAmountRow("Subtotal", order.totalWithGST.subTotal))
      .text(formatAmountRow("CGST @2.5%", order.totalWithGST.cgst))
      .text(formatAmountRow("SGST @2.5%", order.totalWithGST.sgst))
      .text(DIVIDER)
      .style("B")
      .text(formatAmountRow("TOTAL  ₹", order.totalWithGST.total))
      .style("NORMAL")
      .text(DIVIDER);

    // ── UPI QR (optional) ──
    if (order.upiUrl && order.upiUrl.trim()) {
      printer
        .align("CT")
        .text("Scan to Pay")
        .qrimage(order.upiUrl, { type: "png", size: 6 }, () => {
          printer
            .text(DIVIDER)
            .align("CT")
            .text("Thank you for visiting Sam Cafe!")
            .text("Please come again :)")
            .feed(3)
            .cut()
            .close();

          res.json({ success: true, message: `Bill printed for order #${order.id}` });
        });

      return; // response sent inside qrimage callback
    }

    // ── Footer (no QR) ──
    printer
      .align("CT")
      .text("Thank you for visiting Sam Cafe!")
      .text("Please come again :)")
      .feed(3)
      .cut()
      .close();

    res.json({ success: true, message: `Bill printed for order #${order.id}` });
  });
});

/* =========================================================
   TEST PRINT
   GET /test-print
========================================================= */
app.get("/test-print", (req, res) => {
  console.log("Test print triggered");

  openPrinter(res, (printer) => {
    printer
      .align("CT")
      .style("B")
      .size(1, 1)
      .text("SAM CAFE")
      .size(0, 0)
      .style("NORMAL")
      .text("Printer Connected ✓")
      .text(DIVIDER)
      .text(`IP   : ${PRINTER_IP}`)
      .text(`Port : ${PRINTER_PORT}`)
      .text(`Time : ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`)
      .text(DIVIDER)
      .text("KOT & Bill printing ready!")
      .feed(3)
      .cut()
      .close();

    res.json({ success: true, message: "Test print sent" });
  });
});

/* =========================================================
   PRINTER STATUS
   GET /printer/status
========================================================= */
app.get("/printer/status", (req, res) => {
  const device = new escpos.Network(PRINTER_IP, PRINTER_PORT, { timeout: 3000 });

  device.open((err) => {
    if (err) {
      console.warn("Printer not reachable:", err.message);
      return res.status(503).json({ connected: false, message: "Printer not connected" });
    }
    device.close();
    console.log("Printer status: connected");
    res.json({ connected: true, message: "Printer connected", ip: PRINTER_IP, port: PRINTER_PORT });
  });
});

/* =========================================================
   START
========================================================= */
app.listen(9001, () => {
  console.log("╔══════════════════════════════════╗");
  console.log("║  Sam Cafe Print Server           ║");
  console.log("║  http://localhost:9001           ║");
  console.log(`║  Printer → ${PRINTER_IP}:${PRINTER_PORT}  ║`);
  console.log("╚══════════════════════════════════╝");
});