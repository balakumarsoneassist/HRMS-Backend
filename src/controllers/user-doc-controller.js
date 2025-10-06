const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const mongoose = require("mongoose");
const UserDocService = require("../services/user-doc-service");
const UserService = require("../services/user-service");
const routesUtil = require("../utils/routes");

const userDocService = new UserDocService();
const userService = new UserService();
const UserDocController = express.Router();

console.log("✅ UserDocController loaded");

const routes = new routesUtil(userDocService);

// --- Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const docId = req.params.id || req.body.user_id || "common";
    const uploadDir = path.join(__dirname, "../public/uploads/users", docId);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${file.fieldname}${ext}`);
  }
});

const upload = multer({ storage });

// --- Utility to delete existing file
const deleteFileIfExists = (filePath) => {
  try {
    if (!filePath) return;
    const absPath = path.join(__dirname, "../public", filePath);
    if (fs.existsSync(absPath)) {
      fs.unlinkSync(absPath);
      console.log("🗑️ Deleted old file:", absPath);
    }
  } catch (err) {
    console.error("⚠️ File delete failed:", err);
  }
};

// ====================== PUT ROUTES ======================

// 🪪 Update Aadhar (front & back)
UserDocController.put("/aadhar/:id", upload.fields([
  { name: "aadhar_front", maxCount: 1 },
  { name: "aadhar_back", maxCount: 1 }
]), async (req, res) => {
  const docId = req.params.id;

  try {
    if (!mongoose.Types.ObjectId.isValid(docId))
      return res.status(404).json({ success: false, message: "Invalid document id" });

    const existingDoc = await userDocService.model.findById(docId);
    if (!existingDoc)
      return res.status(404).json({ success: false, message: "Document not found" });

    const aadharFrontFile = req.files?.aadhar_front?.[0];
    const aadharBackFile = req.files?.aadhar_back?.[0];

    if (!aadharFrontFile && !aadharBackFile)
      return res.status(400).json({ success: false, message: "At least one Aadhar file required" });

    if (aadharFrontFile) {
      deleteFileIfExists(existingDoc.aadhar_front);
      existingDoc.aadhar_front = `/uploads/users/${docId}/${aadharFrontFile.filename}`;
    }

    if (aadharBackFile) {
      deleteFileIfExists(existingDoc.aadhar_back);
      existingDoc.aadhar_back = `/uploads/users/${docId}/${aadharBackFile.filename}`;
    }

    const savedDoc = await existingDoc.save();
    return res.json({ success: true, message: "Aadhar updated successfully", data: savedDoc });
  } catch (err) {
    console.error("❌ PUT /aadhar/:id error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// 🪪 Update PAN (front & back)
UserDocController.put("/pan/:id", upload.fields([
  { name: "pan_front", maxCount: 1 },
  { name: "pan_back", maxCount: 1 }
]), async (req, res) => {
  const docId = req.params.id;

  try {
    if (!mongoose.Types.ObjectId.isValid(docId))
      return res.status(404).json({ success: false, message: "Invalid document id" });

    const existingDoc = await userDocService.model.findById(docId);
    if (!existingDoc)
      return res.status(404).json({ success: false, message: "Document not found" });

    const panFrontFile = req.files?.pan_front?.[0];
    const panBackFile = req.files?.pan_back?.[0];

    if (!panFrontFile && !panBackFile)
      return res.status(400).json({ success: false, message: "At least one PAN file required" });

    if (panFrontFile) {
      deleteFileIfExists(existingDoc.pan_front);
      existingDoc.pan_front = `/uploads/users/${docId}/${panFrontFile.filename}`;
    }

    if (panBackFile) {
      deleteFileIfExists(existingDoc.pan_back);
      existingDoc.pan_back = `/uploads/users/${docId}/${panBackFile.filename}`;
    }

    const savedDoc = await existingDoc.save();
    return res.json({ success: true, message: "PAN updated successfully", data: savedDoc });
  } catch (err) {
    console.error("❌ PUT /pan/:id error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});


// ✅ Update Certificates (UG or PG)
UserDocController.put(
  "/certificates/:id",
  upload.array("certificates"),
  async (req, res) => {
    const { type } = req.body; // e.g., "UG", "Pg", "ug"
    const docId = req.params.id;

    try {
      // Validate ObjectId
      if (!mongoose.Types.ObjectId.isValid(docId)) {
        return res
          .status(404)
          .json({ success: false, message: "Invalid document id" });
      }

      const existingDoc = await userDocService.model.findById(docId);
      if (!existingDoc) {
        return res
          .status(404)
          .json({ success: false, message: "Document not found" });
      }

      // Normalize type input (make lowercase)
      const normalizedType = (type || "").toLowerCase();

      if (!["ug", "pg"].includes(normalizedType)) {
        return res.status(400).json({
          success: false,
          message: "Type must be UG or PG",
        });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Certificate files are required",
        });
      }

      // 🧹 Delete old certificate files of same type
      const oldCerts = existingDoc[normalizedType] || [];
      oldCerts.forEach((fileObj) => {
        if (fileObj.certificate) {
          const absPath = path.join(
            __dirname,
            "../public",
            fileObj.certificate
          );
          if (fs.existsSync(absPath)) {
            fs.unlinkSync(absPath);
            console.log("🗑️ Deleted old certificate:", absPath);
          }
        }
      });

      // 🆕 Prepare new certificates array
      const newCerts = req.files.map((file) => ({
        certificate: `/uploads/users/${docId}/${file.filename}`,
      }));

      // 🔄 Update document
      existingDoc[normalizedType] = newCerts;
      const savedDoc = await existingDoc.save();

      return res.json({
        success: true,
        message: `${normalizedType.toUpperCase()} certificates updated`,
        data: savedDoc,
      });
    } catch (err) {
      console.error("❌ PUT /certificates/:id error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }
);

// --- Default CRUD routes
UserDocController.get("/", routes.list)
  .get("/:id", routes.retrieve)
  .delete("/:id", routes.delete);

// --- Upload route (unchanged)
UserDocController.post("/upload", upload.any(), async (req, res) => {
  try {
    const processedPayload = await userDocService.handleMulterUploads(req);
    const existingDoc = await userDocService.model.findOne({ user_id: processedPayload.user_id });

    let savedDoc;
    if (existingDoc) {
      savedDoc = await userDocService.model.findOneAndUpdate(
        { user_id: processedPayload.user_id },
        { $set: processedPayload },
        { new: true }
      );
    } else {
      savedDoc = await userDocService.add(processedPayload);
    }

    return res.json({ success: true, data: savedDoc });
  } catch (err) {
    console.error("❌ Upload error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = UserDocController;
