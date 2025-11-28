const mongoose = require("mongoose");

const yearBucketSchema = new mongoose.Schema({
  year: { type: Number, required: true },
  months: {
    type: [Number],
    default: Array(12).fill(0),
    validate: {
      validator: (arr) => arr.length === 12,
      message: "months must be an array of 12 numbers"
    }
  },
  // optional: store the annual remaining value for that year for convenience
  annualValue: { type: Number, default: 0 }
}, { _id: false });

const leaveTypeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    label: {
      type: String,
      required: true,
      trim: true,
      enum: [ "Sick Leave","Casual Leave","Planned Leave","Maternity Leave","Paternity Leave","Compoff Leave" ],
    },
    value: { type: Number, required: true },
    validity: { type: Date },

    accrualType: { type: String, required: true, enum: ["monthly","annual","fixed"], lowercase: true, trim: true },

    // now an array of year buckets (one per calendar year)
    remaining: {
      type: [yearBucketSchema],
      default: []
    },

    doj: { type: Date, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("LeaveType", leaveTypeSchema);
