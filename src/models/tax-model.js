
const mongoose = require("mongoose");
const taxSchema = new mongoose.Schema({
    tax_name: { type: String, required: true, unique: true, uppercase: true, trim: true },
    tax_percentage: { type: Number, required: true },
    description: { type: String },
    status: { type: Boolean, default: true },
}, {
    timestamps: true
});
const taxModel = mongoose.model('tax', taxSchema);
module.exports = taxModel;
