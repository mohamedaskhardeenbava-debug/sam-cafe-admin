const express = require("express");
const cors = require("cors");
const escpos = require("escpos");

escpos.Network = require("escpos-network");

const app = express();
app.use(cors());
app.use(express.json());

const PRINTER_IP = "192.168.1.87";
const PRINTER_PORT = 9100;

/* =========================================================
   FIXED WIDTH HELPERS (32 CHAR RECEIPT)
========================================================= */
const LINE_WIDTH = 32;

const money = (v) => Number(v || 0).toFixed(2);

const padRight = (text, width) =>
  text.length >= width ? text.slice(0, width) : text + " ".repeat(width - text.length);

const padLeft = (text, width) =>
  text.length >= width ? text.slice(0, width) : " ".repeat(width - text.length) + text;

// ITEM | QTY | TOTAL
const formatItemRow = (name, qty, total) => {
  const ITEM_W = 18;
  const QTY_W = 6;
  const TOTAL_W = 8;

  return (
    padRight(name, ITEM_W) +
    padLeft(String(qty), QTY_W) +
    padLeft(money(total), TOTAL_W)
  );
};

// LABEL ............... AMOUNT
const formatAmountRow = (label, amount) => {
  const LABEL_W = LINE_WIDTH - 8;
  return padRight(label, LABEL_W) + padLeft(money(amount), 8);
};

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-GB") : "";

const formatIndianTime = (date, time) => {
  if (!date || !time) return "";

  const dateTime = new Date(`${date}T${time}`);
  if (isNaN(dateTime.getTime())) return time;

  return dateTime.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
};

/* =========================================================
   BILL PRINT
========================================================= */
app.post("/print/bill", (req, res) => {
  try {
    const { order } = req.body;

    if (!order || !order.items || !order.totalWithGST) {
      return res.status(400).json({ error: "Invalid bill data" });
    }

    const device = new escpos.Network(PRINTER_IP, PRINTER_PORT);
    const printer = new escpos.Printer(device);

    device.open(() => {
      printer
        .align("CT")
        .style("B")
        .text("Sam Cafe")
        .style("NORMAL")
        .text("Contact Number: +91-9080179608")
        .text("--------------------------------")
        .align("LT")
        .text(`Order : ${order.id}`)
        .text(`Date  : ${formatDate(order.date)}`)
        .text(`Time : ${formatIndianTime(order.date, order.time)}`)
        .text("Staff : Admin")
        .text("Table : T1")
        .text("--------------------------------");

      // HEADER
      printer
        .text(
          padRight("ITEM", 18) +
          padLeft("QTY", 6) +
          padLeft("TOTAL", 8)
        )
        .text("--------------------------------");

      // ITEMS
      order.items.forEach(item => {
        printer.text(
          formatItemRow(
            item.dishName,
            item.quantity,
            item.totalPrice
          )
        );
      });

      // GST SUMMARY
      printer
        .text("--------------------------------")
        .text(formatAmountRow("Subtotal", order.totalWithGST.subTotal))
        .text(formatAmountRow("CGST @2.5%", order.totalWithGST.cgst))
        .text(formatAmountRow("SGST @2.5%", order.totalWithGST.sgst))
        .text("--------------------------------")
        .style("B")
        .text(formatAmountRow("TOTAL", order.totalWithGST.total))
        .style("NORMAL")
        .text("--------------------------------")
        .align("CT")
        .text("Scan To Pay")
        .qrimage(order.upiUrl || "", { type: "png", size: 6 })
        .text("--------------------------------")
        .text("Lavanya Complex, 9")
        .text("Iyer Bungalow")
        .text("Moondrumavadi Main Road")
        .text("GR Nagar")
        .text("Madurai - 625007")
        .cut()
        .close();
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Bill print failed", err);
    res.status(500).json({ error: "Bill print failed" });
  }
});

/* =========================================================
   TEST PRINT
========================================================= */
app.get("/test-print", (req, res) => {
  const device = new escpos.Network(PRINTER_IP, PRINTER_PORT);
  const printer = new escpos.Printer(device);

  device.open(() => {
    printer
      .align("CT")
      .text("TEST PRINT")
      .text("Printer Connected OK")
      .cut()
      .close();
  });

  res.send("Test print sent");
});

/* =========================================================
   PRINTER STATUS
========================================================= */
app.get("/printer/status", (req, res) => {
  const device = new escpos.Network(PRINTER_IP, PRINTER_PORT, { timeout: 3000 });

  device.open(err => {
    if (err) {
      return res.status(503).json({
        connected: false,
        message: "Printer not connected"
      });
    }

    device.close();
    res.json({
      connected: true,
      message: "Printer connected"
    });
  });
});

app.listen(9001, () => {
  console.log("Printer Service running on port 9001");
});