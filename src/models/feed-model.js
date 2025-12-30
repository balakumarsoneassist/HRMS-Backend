const mongoose = require("mongoose");

const feedSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },

    user_name: { type: String, required: true, trim: true },
    position: { type: String, default: "", trim: true },
    userRole: { type: String, default: "", trim: true },

    caption: { type: String, trim: true, default: "" },

    // store image url (recommended) or file path
    imageUrl: { type: String, default: "" },

    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },

    status: { type: Boolean, default: true }, // soft hide
  },
  { timestamps: true }
);

// Helps sorting/pagination performance
feedSchema.index({ createdAt: -1 });

module.exports = mongoose.model("feed", feedSchema);
