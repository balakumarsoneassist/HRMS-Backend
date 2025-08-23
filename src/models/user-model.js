const mongoose = require("mongoose");

// Counter Schema
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.model("counter", counterSchema);

// User Schema
const userSchema = new mongoose.Schema(
  {
    user_name: { type: String, required: true, uppercase: true, trim: true },
    mobile_no: { type: String, unique: true, trim: true },
    empId: { type: String, unique: true }, // Auto-generated employee ID
    password: { type: String, required: true },
    email: { type: String, unique: true, trim: true },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "access",
      default: null,
      required: true,
    },
    position: { type: String, trim: true },
    designation:{type: String, trim: true},
    department:{type: String, trim: true},
    status: { type: Boolean, default: true },
    logcal: { type: Number, default: 0 },
    createdby: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
      required: true,
    },
    doj: { type: Date, default: Date.now },
    kmsCharge:{ type: Number , default :10},
    creditpetrol: [
      {
        amount: { type: Number, default: 0 },
        from: { type: String, default: '' },
        to: { type: String, default: '' },
        purposeofVisit:{type: String, default: ''},
        kms: { type: Number, default: 0 },
        modeoftransport: {type: String, default: ''},
        updatedAt: { type: Date, default: Date.now },
        approved: {type : Boolean , default : false }
      }
    ],
    balance: {
      amount: { type: Number, default: 0 },
      updatedAt: { type: Date, default: Date.now },
    },
  },
  { timestamps: true }
);

// Pre-save hook to generate empId
userSchema.pre("save", async function (next) {
  if (!this.isNew) return next();

  try {
    // Find counter for empId and increment
    const counter = await Counter.findByIdAndUpdate(
      { _id: "empId" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
// 11010
    // Format empId like EMP0001, EMP0002, etc.
  this.empId = `OAID${(counter.seq + 11010 ).toString().padStart(5, "0")}`;

    next();
  } catch (err) {
    next(err);
  }
});

const userModel = mongoose.model("user", userSchema);
module.exports = userModel;
