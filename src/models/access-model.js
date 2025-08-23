// models/access-model.js
const mongoose = require("mongoose");

const accessSchema = new mongoose.Schema(
  {
    role: { type: String, required: true },

    main: [
      {
        menuName: { type: String, required: true },
        children: [{ submenuName: { type: String, required: true } }]
      }
    ],

    // 🔁 Parent roles for this role (role hierarchy)
    access: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "access",               // <-- self reference (ROLE -> parent ROLES)
        required: true
      }
    ],

    // 👥 Users who report directly to THIS role (per-user placement)
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user"
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("access", accessSchema);
