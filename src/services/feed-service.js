const feed_model = require("../models/feed-model");
const crud_service = require("./crud-service");

class FeedService extends crud_service {
  constructor() {
    super(...arguments);
    this.model = feed_model;

    this.validateAdd = async (data) => {
      if (!data.userId) throw new Error("userId is required");
      if (!data.user_name) throw new Error("user_name is required");

      // Allow image-only post or caption-only post, but at least one
      const hasCaption = (data.caption || "").trim().length > 0;
      const hasImage = (data.imageUrl || "").trim().length > 0;
      if (!hasCaption && !hasImage) throw new Error("caption or image is required");
    };

    this.validateEdit = async (data, id) => {
      // basic validation
      if (!id) throw new Error("id is required");
    };

    this.validateDelete = async (data) => {};
  }

  /**
   * Infinite scroll list:
   * GET /feed?skip=0&limit=10
   * returns newest posts first
   */
  listPaged = async (query) => {
    const skip = Math.max(parseInt(query.skip || "0", 10), 0);
    const limit = Math.min(Math.max(parseInt(query.limit || "10", 10), 1), 50);

    const filter = { status: true };

    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ createdAt: -1 }) // descending timewise
        .skip(skip)
        .limit(limit)
        .lean(),
      this.model.countDocuments(filter),
    ]);

    return {
      items,
      meta: {
        skip,
        limit,
        total,
        hasMore: skip + items.length < total,
        nextSkip: skip + items.length,
      },
    };
  };
}

module.exports = FeedService;
