const express = require("express");
const multer = require("multer");
const { createOrUpdateUploads, getUploadsByUser } = require("../controllers/uploadUser.controller");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/users/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ storage });

router.post(
  "/:id",
  upload.fields([
    { name: "photo", maxCount: 1 },
    { name: "marksheet10", maxCount: 1 },
    { name: "marksheet12", maxCount: 1 },
    { name: "transferCertificate", maxCount: 1 },
  ]),
  createOrUpdateUploads
);

router.get("/:id", getUploadsByUser);

module.exports = router;
