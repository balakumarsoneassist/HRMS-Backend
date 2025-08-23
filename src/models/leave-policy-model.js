const mongoose = require("mongoose");

const LeavePolicySchema = new mongoose.Schema(
  {
    role: { type: String, required: true, trim: true }, // e.g., "Employee", "Intern", "Admin"
    label: {
      type: String,
      required: true,
      trim: true,
      enum: [
        "Sick Leave",
        "Casual Leave",
        "Planned Leave",
        "Maternity Leave",
        "Paternity Leave",
        "Compoff Leave"
      ],
    },
    amount: { type: Number, required: true, min: 0 },        // 1, 7, 15, 0
    accrualType: { type: String, required: true, enum: ["monthly", "annual", "fixed"] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

LeavePolicySchema.index({ role: 1, label: 1 }, { unique: true }); // one policy per label per role

module.exports = mongoose.model("leave_policy", LeavePolicySchema);
