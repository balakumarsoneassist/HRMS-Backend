const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    reasonForApplying:{
      type: String,
      default: ""
    },


    attendanceType: {
      type: String,
      enum: ["Present", "Absent", "LOP", "Sick Leave", "Casual Leave","Maternity Leave","Comp OFF","Holiday","Planned Leave"],
      default: "Present"
    },

     approved: {
      type: Boolean,
      default: null // null = not reviewed yet, true = approved, false = rejected
    },

    geoTaglogin: {
      login: { type: Boolean ,default: false },
      latitude: { type: Number,  default:0 },
      longitude: { type: Number,  default:0 },
      date:{ type : Date },
      address: { type: String, trim: true , default: null},
    },

    geoTaglogout: {
      logout: { type: Boolean, default: false},
      latitude: { type: Number,  default:0 },
      longitude: { type: Number,  default:0 },
      date:{ type : Date },
      address: { type: String, trim: true , default: null},
    },

    remarks: { type: String, trim: true }
  },
  {
    timestamps: true
  }
);

// Unique index to ensure one entry per user per day
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

const attendanceModel = mongoose.model("attendance", attendanceSchema);
module.exports = attendanceModel;
