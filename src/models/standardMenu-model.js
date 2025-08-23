// models/standardMenu-model.js
const mongoose = require("mongoose");

const SubMenuSchema = new mongoose.Schema(
  { submenuName: { type: String, required: true, trim: true } },
  { _id: false }
);

const MenuSchema = new mongoose.Schema(
  {
    menuName: { type: String, required: true, trim: true },
    children: { type: [SubMenuSchema], default: [] },
  },
  { _id: false }
);

const StandardMenuSchema = new mongoose.Schema(
  {
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      unique: true,    // <-- this already creates a unique index
      index: true
    },
    role: {
      type: String,
      required: true,
      enum: ["Super Admin", "Admin", "Employee", "Intern"]
    },
    main: { type: [MenuSchema], default: [] },
  },
  { timestamps: true, collection: "standard_menus" }
);

// Keep this simple non-unique index if you want quick lookups by role:
StandardMenuSchema.index({ role: 1 });

// ❌ REMOVE this (it duplicates the unique index on roleId)
// StandardMenuSchema.index({ roleId: 1 }, { unique: true });

module.exports =
  mongoose.models["standard_menu"] ||
  mongoose.model("standard_menu", StandardMenuSchema);
