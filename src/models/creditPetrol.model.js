const mongoose = require("mongoose");

// Credit Petrol Schema
const creditPetrolSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true
    },
        amount: { type: Number, default: 0 },
        from: { type: String, default: '' },
        to: { type: String, default: '' },
        purposeofVisit:{type: String, default: ''},
        kms: { type: Number, default: 0 },
        modeoftransport: {type: String, default: '', enum: ["Public Transport", "Private Transport","Own Transport"]},
        updatedAt: { type: Date, default: Date.now },
        approved: {type : Boolean , default : null },
        approveBy: {type: String, default: ''},
        remarks: {type: String, default: ''},

  },
  { timestamps: true }
);

const CreditPetrol = mongoose.model("creditpetrol", creditPetrolSchema);

module.exports = CreditPetrol;
