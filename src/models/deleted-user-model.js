const mongoose = require("mongoose");

const deletedUserSchema = new mongoose.Schema(
  {
    user_name: { type: String, required: true, uppercase: true, trim: true },
    mobile_no: { type: String, trim: true },
    empId: { type: String, trim: true },
    email: { type: String, trim: true },
    role: { type: mongoose.Schema.Types.ObjectId, ref: "access", default: null },
    position: { type: String, trim: true },
    designation: { type: String, trim: true },
    department: { type: String, trim: true },
    deletedReason: { type: String, default: "Deleted by admin" },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    deletedAt: { type: Date, default: Date.now },
    originalCreatedAt: { type: Date },
    originalUpdatedAt: { type: Date },
    backupData: { type: Object },
  },
  { timestamps: true }
);

const DeletedUserModel = mongoose.model("deleted_user", deletedUserSchema);
module.exports = DeletedUserModel;
