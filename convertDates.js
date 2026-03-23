const fs = require("fs");
const path = require("path");

// ✅ Absolute path (no path issues)
const filePath = path.join(__dirname, "../data/db.json");

// ---------- FORMAT FUNCTION ----------
const formatDate = (value) => {
  if (!value) return value;

  const d = new Date(value);

  // skip invalid dates
  if (isNaN(d)) return value;

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return `${day}-${month}-${year}`;
};

// ---------- RECURSIVE CONVERTER ----------
const convertDates = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(convertDates);
  }

  if (typeof obj === "object" && obj !== null) {
    const newObj = {};

    for (const key in obj) {
      const value = obj[key];

      // 🎯 Detect ALL date-like fields
      if (
        key.toLowerCase().includes("date") ||
        key.toLowerCase().includes("createdat") ||
        key.toLowerCase().includes("updatedat") ||
        key.toLowerCase().includes("dob") ||
        key.toLowerCase().includes("joining")
      ) {
        newObj[key] = formatDate(value);
      } else {
        newObj[key] = convertDates(value);
      }
    }

    return newObj;
  }

  return obj;
};

// ---------- MAIN ----------
try {
  console.log("📂 Reading:", filePath);

  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);

  const updated = convertDates(data);

  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));

  console.log("✅ All dates converted to dd-mm-yyyy successfully!");
} catch (err) {
  console.error("❌ Error:", err.message);
}