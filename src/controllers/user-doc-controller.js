const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const UserDocService = require("../services/user-doc-service");
const UserService = require("../services/user-service");
const routesUtil = require("../utils/routes");

const userDocService = new UserDocService();
const userService = new UserService();
const UserDocController = express.Router();
const routes = new routesUtil(userDocService);

// --- Multer storage with per-user folder
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const userId = req.body.user_id;
      if (!userId) return cb(new Error("user_id is required"), null);

      // 🔍 Fetch user details
      const user = await userService.retrieve({ _id: userId });
      if (!user) return cb(new Error("User not found"), null);

      // 🔑 Generate safe folder name
      const safeName = (user.user_name || `user_${userId}`)
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9_-]/g, "");

      const uploadDir = path.join(__dirname, "../public/uploads/users", safeName);

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      cb(null, uploadDir);
    } catch (err) {
      cb(err, null);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${file.fieldname}${ext}`);
  }
});

const upload = multer({ storage });

// --- Default CRUD
UserDocController.get("/", routes.list)
  .get("/:id", routes.retrieve)
  .put("/:id", routes.update)
  .delete("/:id", routes.delete);

// --- Upload Route (with UPSERT)
UserDocController.post("/upload", upload.any(), async (req, res) => {
  try {
    const processedPayload = await userDocService.handleMulterUploads(req);

    // ✅ Check if record already exists for user_id
    const existingDoc = await userDocService.model.findOne({ user_id: processedPayload.user_id });

    let savedDoc;
    if (existingDoc) {
      // 🔄 Update existing document
      savedDoc = await userDocService.model.findOneAndUpdate(
        { user_id: processedPayload.user_id },
        { $set: processedPayload },
        { new: true }
      );
    } else {
      // ➕ Create new document
      savedDoc = await userDocService.add(processedPayload);
    }

    return res.json({ success: true, data: savedDoc });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = UserDocController;
