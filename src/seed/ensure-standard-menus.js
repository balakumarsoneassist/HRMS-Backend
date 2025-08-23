const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const StandardMenuService = require("../services/standardMenu-service");

module.exports = async function ensureStandardMenus() {
  const ObjectId = (v) => new mongoose.Types.ObjectId(v);
  const svc = new StandardMenuService();

  // Read JSON file
  const menusPath = path.join(__dirname, "standard-menus.json");
  let docs = JSON.parse(fs.readFileSync(menusPath, "utf-8"));

  // Convert roleId strings to ObjectId
  docs = docs.map(d => ({
    ...d,
    roleId: ObjectId(d.roleId)
  }));

  for (const d of docs) {
    await svc.upsertOne({ roleId: d.roleId }, d);
  }

  console.log("✅ Standard menus ensured from JSON file.");
};
