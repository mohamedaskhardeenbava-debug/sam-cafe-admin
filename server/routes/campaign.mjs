import express from "express";
import { sendTemplate } from "../aisensy.mjs";

const router = express.Router();

router.post("/campaign", async (req, res) => {
  const { users } = req.body;

  try {
    for (const user of users) {
      if (!user.mobile) continue;

      await sendTemplate({
        phone: `91${user.mobile}`,
        templateName: "promo_campaign",
        variables: [user.name]
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

export default router;