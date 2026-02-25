import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import whatsappRoute from "./routes/whatsapp.mjs";
import campaignRoute from "./routes/campaign.mjs";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
console.log("ES MODULE MODE ACTIVE");

// routes
app.use("/api/whatsapp", whatsappRoute);
app.use("/api", campaignRoute);

const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
