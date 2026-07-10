import express from "express";
import { sendTemplate } from "../aisensy.mjs";

const router = express.Router();

router.post("/order-status", async (req, res) => {
  try {
    const { phone, template, vars } = req.body;

    if (!phone || !template) {
      return res.status(400).json({ error: "Missing phone or template" });
    }

    await sendTemplate({
      phone,
      templateName: template,
      variables: vars || []
    });

    res.json({ success: true });
  } catch (err) {
    console.error("❌ WhatsApp send failed:", err.response?.data || err.message);
    res.status(500).json({ success: false });
  }
});

export default router;