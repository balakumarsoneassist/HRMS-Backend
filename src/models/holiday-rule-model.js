// models/holiday-rule-model.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const RecurrenceSchema = new Schema({
  kind: {
    type: String,
    enum: ["nth-weekday-monthly", "weekly", "annual-fixed"],
  },
  nths:     [{ type: Number }],   // e.g. [3,4]
  weekdays: [{ type: Number }],   // 0..6 (Sun..Sat)
  months:   [{ type: Number }],   // 0..11
  startDate: { type: String },    // 'MM-DD' (for annual-fixed)
  endDate:   { type: String },
}, { _id: false });

const HolidayRuleSchema = new Schema({
  name:         { type: String, required: true, trim: true },
  color:        { type: String, default: "#10b981" },
  isEnabled:    { type: Boolean, default: true },
  isGovernment: { type: Boolean, default: false },

  // Either 'date' OR 'recurrence'
  date:       { type: String },       // 'YYYY-MM-DD'
  recurrence: { type: RecurrenceSchema, default: null },
}, { timestamps: true });

module.exports = mongoose.model("holiday_rule", HolidayRuleSchema);
