const mongoose = require("mongoose");

const payloadSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },

  // Configured Monthly CTC entered by Admin
  ctc: { type: Number, required: true },

  // --- ALLOWANCES (Percentages of Gross Salary) ---
  basic: {
    enabled: { type: Boolean, default: false },
    percent: { type: Number, default: 0 } // Input percent (before enforcing 40%)
  },
  hra: {
    enabled: { type: Boolean, default: false },
    percent: { type: Number, default: 0 }
  },
  da: {
    enabled: { type: Boolean, default: false },
    percent: { type: Number, default: 0 }
  },
  ta: {
    enabled: { type: Boolean, default: false },
    percent: { type: Number, default: 0 }
  },
  conveyance: {
    enabled: { type: Boolean, default: false },
    percent: { type: Number, default: 0 }
  },
  medical: {
    enabled: { type: Boolean, default: false },
    percent: { type: Number, default: 0 }
  },
  special: {
    enabled: { type: Boolean, default: false },
    percent: { type: Number, default: 0 }
  },

  // --- PF (Government Auto Formula: 12% OR ₹1800 capped) ---
  pf: {
    enabled: { type: Boolean, default: false },
    mode: { type: String, default: "auto_12_or_1800" } // NEW FIELD
  },

  // --- PT (Professional Tax) ---
  pt: {
    enabled: { type: Boolean, default: false },
    percent: { type: Number, default: 0 } // Deducted from CTC % (company chooses)
  },

  // --- TDS (Income Tax) ---
  tds: {
    enabled: { type: Boolean, default: false },
    percent: { type: Number, default: 0 }
  },

  // --- ESIC (Government Rule) ---
  esicEmployer: {
    enabled: { type: Boolean, default: false } // 3.25% of Gross if < 21000
  },
  esicEmployee: {
    enabled: { type: Boolean, default: false } // 0.75% of Gross if < 21000
  },

  // Total Allowance Percentage (input sum)
  totalAllowancePercent: { type: Number, required: true },

  // Duration
  createdMonth: { type: String, required: true },  // Example: "2025-10"
  untilMonth: { type: String, required: true },    // Example: "2026-03"

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
  createdAt: { type: Date, default: Date.now },
  status: { type: Boolean, default: true }
});

module.exports = mongoose.model("payloads", payloadSchema);
