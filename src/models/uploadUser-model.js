const mongoose = require("mongoose");

const uploadUserSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user", // links to your existing user model
      required: true,
    },
    photo: { type: String },
    marksheet10: { type: String },
    marksheet12: { type: String },
    transferCertificate: { type: String },

    previousEmployment: [
      {
        companyName: { type: String },
        relieving: { type: String },
        experience: { type: String },
        payslips: [{ type: String }],
      },
    ],

    pgCertificates: [
      {
        certificate: { type: String },
        marksheet: { type: String },
      },
    ],

    ugCertificates: [
      {
        certificate: { type: String },
        marksheet: { type: String },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("uploadUser", uploadUserSchema);
