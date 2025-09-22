const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const StandardMenuService = require("../services/standardMenu-service");

module.exports = async function ensureStandardMenus() {
  const svc = new StandardMenuService();

  // Normalize MongoDB extended JSON into plain usable values
  const normalizeValue = (val) => {
    if (val && typeof val === "object") {
      if (val.$oid && mongoose.isValidObjectId(val.$oid)) {
        return new mongoose.Types.ObjectId(val.$oid);
      }
      if (val.$date) {
        return new Date(val.$date);
      }
    }
    return val;
  };

  const normalizeDoc = (doc) => {
    const normalized = {};
    for (const key in doc) {
      if (Array.isArray(doc[key])) {
        normalized[key] = doc[key].map((item) =>
          typeof item === "object" ? normalizeDoc(item) : normalizeValue(item)
        );
      } else if (typeof doc[key] === "object" && doc[key] !== null) {
        normalized[key] = normalizeDoc(doc[key]);
      } else {
        normalized[key] = normalizeValue(doc[key]);
      }
    }
    return normalized;
  };

  const menusPath = path.join(__dirname, "standard-menus.json");
  let docs = JSON.parse(fs.readFileSync(menusPath, "utf-8"));

  // Deep normalize all docs
  docs = docs.map(normalizeDoc);

  for (const d of docs) {
    try {
      await svc.upsertOne({ roleId: d.roleId }, d);
    } catch (err) {
      console.error("❌ Failed to upsert menu for role:", d.role, err.message);
    }
  }

  console.log("✅ Standard menus ensured from JSON file.");
};
