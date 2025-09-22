const fs = require("fs");
const path = require("path");
const UploadUser = require("../models/uploadUser-model");

/**
 * 🆕 Create or Update user uploads
 * Handles file uploads & JSON payload for prev employment + UG/PG docs
 */
exports.createOrUpdateUploads = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!userId) return res.status(400).json({ success: false, message: "User ID is required" });

    // Build payload
    const payload = {
      user: userId,
      photo: req.files?.photo?.[0]?.path || undefined,
      marksheet10: req.files?.marksheet10?.[0]?.path || undefined,
      marksheet12: req.files?.marksheet12?.[0]?.path || undefined,
      transferCertificate: req.files?.transferCertificate?.[0]?.path || undefined,
      previousEmployment: req.body.prev ? JSON.parse(req.body.prev) : [],
      pgCertificates: req.body.pg ? JSON.parse(req.body.pg) : [],
      ugCertificates: req.body.ug ? JSON.parse(req.body.ug) : [],
    };

    // If record exists, remove old files if replaced
    let existing = await UploadUser.findOne({ user: userId });
    if (existing) {
      const fileFields = ["photo", "marksheet10", "marksheet12", "transferCertificate"];
      fileFields.forEach((field) => {
        if (payload[field] && existing[field] && existing[field] !== payload[field]) {
          try {
            fs.unlinkSync(path.resolve(existing[field]));
          } catch (err) {
            console.warn(`⚠️ Could not delete old file ${existing[field]}:`, err.message);
          }
        }
      });
    }

    // Upsert
    const updated = await UploadUser.findOneAndUpdate(
      { user: userId },
      { $set: payload },
      { new: true, upsert: true }
    );

    return res.json({ success: true, message: "Uploads saved successfully", data: updated });
  } catch (error) {
    console.error("❌ Upload Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 📄 Get uploads by user
 */
exports.getUploadsByUser = async (req, res) => {
  try {
    const data = await UploadUser.findOne({ user: req.params.id });
    if (!data) return res.status(404).json({ success: false, message: "No uploads found" });
    res.json({ success: true, data });
  } catch (error) {
    console.error("❌ Fetch Upload Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 🗑️ Delete uploads (optional)
 * This can be used to wipe uploads for a user
 */
exports.deleteUploadsByUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const existing = await UploadUser.findOne({ user: userId });
    if (!existing) return res.status(404).json({ success: false, message: "No uploads to delete" });

    // Delete physical files
    const deleteFile = (f) => {
      if (f && fs.existsSync(path.resolve(f))) {
        fs.unlinkSync(path.resolve(f));
      }
    };

    deleteFile(existing.photo);
    deleteFile(existing.marksheet10);
    deleteFile(existing.marksheet12);
    deleteFile(existing.transferCertificate);

    (existing.previousEmployment || []).forEach((p) => {
      deleteFile(p.relieving);
      deleteFile(p.experience);
      (p.payslips || []).forEach(deleteFile);
    });

    (existing.pgCertificates || []).forEach((pg) => {
      deleteFile(pg.certificate);
      deleteFile(pg.marksheet);
    });

    (existing.ugCertificates || []).forEach((ug) => {
      deleteFile(ug.certificate);
      deleteFile(ug.marksheet);
    });

    await UploadUser.deleteOne({ user: userId });

    res.json({ success: true, message: "Uploads deleted successfully" });
  } catch (error) {
    console.error("❌ Delete Upload Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
