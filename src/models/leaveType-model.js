const mongoose = require("mongoose");

const leaveTypeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
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
      ], // ✅ Allowed types
    },
    value: {
      type: Number,
      required: true,
      trim: true,
    },
    validity: {
      type: Date,
        
    }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("LeaveType", leaveTypeSchema);
