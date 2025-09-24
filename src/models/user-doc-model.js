const mongoose = require("mongoose");

const prevCompanySchema = new mongoose.Schema({
  companyName: { type: String, trim: true },
  relieving: { type: String, trim: true },
  experience: { type: String, trim: true },
  payslips: [{ type: String, trim: true }]
});

const certSchema = new mongoose.Schema({
  certificate: { type: String, trim: true },
  marksheet: { type: String, trim: true }
});

const userDocSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, unique: true },

    // ✅ Profile Photo
    photo: { type: String, trim: true, default: "" },

    // ✅ Aadhar & PAN front/back images
    aadhar_front: { type: String, trim: true },
    aadhar_back: { type: String, trim: true },
    pan_front: { type: String, trim: true },
    pan_back: { type: String, trim: true },

    // ✅ Other single docs
    resume: { type: String, trim: true },

    prev: [prevCompanySchema],
    pg: [certSchema],
    ug: [certSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model("user_documents", userDocSchema);
