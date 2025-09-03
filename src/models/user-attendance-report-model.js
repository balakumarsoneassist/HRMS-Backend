const mongoose = require("mongoose");

const userAttendanceReportSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    date: { type: Date, required: true },

    attendanceType: {
      type: String,
      enum: [
        "Present",
        "Absent",
        "LOP",
        "Sick Leave",
        "Casual Leave",
        "Maternity Leave",
        "Comp OFF",
        "Holiday",
        "Planned Leave"
      ],
      default: "Present"
    },

    reasonForApplying: { type: String, default: "" },
    resonforLOP: { type: String, default: "" },
    approved: { type: Boolean, default: null },
    isHoliday: { type: Boolean, default: false },
    remarks: { type: String, trim: true },

    geoTaglogin: {
      login: { type: Boolean, default: false },
      latitude: { type: Number, default: 0 },
      longitude: { type: Number, default: 0 },
      date: { type: Date },
      address: { type: String, trim: true, default: null }
    },

    geoTaglogout: {
      logout: { type: Boolean, default: false },
      latitude: { type: Number, default: 0 },
      longitude: { type: Number, default: 0 },
      date: { type: Date },
      address: { type: String, trim: true, default: null }
    },

    // Manager override fields
    changedItem: { type: String, default: null },
    changedRemarks: { type: String, default: null },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },

    // Who generated this report snapshot
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null }
  },
  { timestamps: true }
);

userAttendanceReportSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("user_attendance_report", userAttendanceReportSchema);
