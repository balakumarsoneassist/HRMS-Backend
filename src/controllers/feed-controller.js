const express = require("express");
const routesUtil = require("../utils/routes");
const FeedService = require("../services/feed-service");
const upload = require("../middleware/upload");

const FeedController = express.Router();
const feed_service = new FeedService();
const routes = new routesUtil(feed_service);

/**
 * List - infinite scroll
 * /feed?skip=0&limit=10
 */
FeedController.get("/", async (req, res) => {
  try {

    const result = await feed_service.listPaged(req.query);
    res.json({ status: true, ...result });
  } catch (e) {
    res.status(400).json({ status: false, message: e.message });
  }
});

/**
 * Add post with optional photo
 * multipart/form-data:
 * - caption
 * - userId, user_name, position, userRole
 * - image (file)
 */
FeedController.post("/", upload.single("image"), async (req, res) => {
  try {
    console.log("hdsfgds");
    
    const body = req.body || {};

    // if file exists -> make a public url
    if (req.file) {
      // If you serve uploads statically: app.use('/uploads', express.static('uploads'))
      body.imageUrl = `/uploads/feed/${req.file.filename}`;
      
    }

    await feed_service.validateAdd(body);
    const created = await feed_service.model.create(body);

    res.json({ status: true, data: created });
  } catch (e) {
    res.status(400).json({ status: false, message: e.message });
  }
});

// keep your CRUD style for rest
FeedController.get("/:id", routes.retrieve)
  .put("/:id", routes.update)
  .delete("/:id", routes.delete);

module.exports = FeedController;
