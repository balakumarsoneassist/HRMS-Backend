const mongoose = require("mongoose");

const payloadSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
  ctc: { type: Number, required: true },

  // Allowances
  basic: { enabled: Boolean, percent: Number },
  hra: { enabled: Boolean, percent: Number },
  da: { enabled: Boolean, percent: Number },
  ta: { enabled: Boolean, percent: Number },
  conveyance: { enabled: Boolean, percent: Number },
  medical: { enabled: Boolean, percent: Number },
  special: { enabled: Boolean, percent: Number },

  // Deductions
  pf: { enabled: Boolean, percent: Number },
  pt: { enabled: Boolean, percent: Number },
  tds: { enabled: Boolean, percent: Number },

  totalPercent: { type: Number, required: true },
  createdMonth: { type: String, required: true }, // e.g., "2025-10"
  untilMonth: { type: String, required: true },   // e.g., "2026-03"

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
  createdAt: { type: Date, default: Date.now },
  status: { type: Boolean, default: true }
});

module.exports = mongoose.model("payloads", payloadSchema);
