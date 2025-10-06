const payload_model = require("../models/payload-model");
const crud_service = require("./crud-service");

class PayloadService extends crud_service {
    constructor() {
        super(...arguments);
        this.model = payload_model;

        this.validateAdd = async (data) => {
            // ✅ Validation before adding
            if (!data.user_id) throw new Error("user_id is required");
            if (!data.createdMonth) throw new Error("createdMonth is required");
            if (!data.untilMonth) throw new Error("untilMonth is required");
            if (!data.totalPercent || data.totalPercent !== 100) {
                throw new Error("Total percentage must be exactly 100%");
            }
        };

        this.validateEdit = async (data, id) => {
            // ✅ Validation before updating
            if (data.totalPercent && data.totalPercent !== 100) {
                throw new Error("Total percentage must be exactly 100% to update");
            }
        };

        this.validateDelete = async (data) => {
            // You can add logic to prevent deletion of active payloads if needed
        };
    }
}

module.exports = PayloadService;
