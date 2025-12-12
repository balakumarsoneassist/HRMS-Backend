const payload_model = require("../models/payload-model");
const crud_service = require("./crud-service");

class PayloadService extends crud_service {
    constructor() {
        super(...arguments);
        this.model = payload_model;

        /* ---------------------- VALIDATION BEFORE ADD ---------------------- */
        this.validateAdd = async (data) => {

            if (!data.user_id) throw new Error("user_id is required");
            if (!data.createdMonth) throw new Error("createdMonth is required");
            if (!data.untilMonth) throw new Error("untilMonth is required");

            // ---------------- ALLOWANCE VALIDATION ----------------
            const allowanceKeys = [
                "basic", "hra", "da", "ta",
                "conveyance", "medical", "special"
            ];

            let totalPercent = 0;

            for (const key of allowanceKeys) {
                const item = data[key];

                if (!item || !item.enabled) continue;

                const pct = Number(item.percent || 0);
                if (pct < 0) throw new Error(`${key} percent cannot be negative`);
                if (pct > 100) throw new Error(`${key} percent cannot exceed 100%`);

                totalPercent += pct;
            }

            if (totalPercent <= 0)
                throw new Error("At least one allowance percentage must be enabled");

            if (totalPercent > 100)
                throw new Error("Total allowance percentage cannot exceed 100%");

            // backend stores this as: totalAllowancePercent
            data.totalAllowancePercent = totalPercent;

            // ---------------- PF/ESIC VALIDATION ----------------
            if (data.pf && data.pf.enabled) {
                if (!data.pf.mode) {
                    data.pf.mode = "auto_12_or_1800";  // default
                }
            }

            if (data.esicEmployer && data.esicEmployer.enabled) {
                // no percent, but we ensure boolean validity
                data.esicEmployer.enabled = !!data.esicEmployer.enabled;
            }

            if (data.esicEmployee && data.esicEmployee.enabled) {
                data.esicEmployee.enabled = !!data.esicEmployee.enabled;
            }

            // ---------------- PT/TDS VALIDATION ----------------
            if (data.pt && data.pt.enabled) {
                const p = Number(data.pt.percent);
                if (p < 0 || p > 100) throw new Error("PT percent must be between 0–100");
            }

            if (data.tds && data.tds.enabled) {
                const p = Number(data.tds.percent);
                if (p < 0 || p > 100) throw new Error("TDS percent must be between 0–100");
            }
        };


        /* ---------------------- VALIDATION BEFORE EDIT ---------------------- */
        this.validateEdit = async (data, id) => {

            // Same rules as Add
            const allowanceKeys = [
                "basic", "hra", "da", "ta",
                "conveyance", "medical", "special"
            ];

            let totalPercent = 0;

            for (const key of allowanceKeys) {
                const item = data[key];

                if (!item || !item.enabled) continue;

                const pct = Number(item.percent || 0);
                if (pct < 0) throw new Error(`${key} percent cannot be negative`);
                if (pct > 100) throw new Error(`${key} percent cannot exceed 100%`);

                totalPercent += pct;
            }

            if (totalPercent <= 0)
                throw new Error("At least one allowance percentage must be enabled");

            if (totalPercent > 100)
                throw new Error("Total allowance percentage cannot exceed 100%");

            data.totalAllowancePercent = totalPercent;
        };


        /* ---------------------- VALIDATION BEFORE DELETE ---------------------- */
        this.validateDelete = async (data) => {
            // You may block deletion if salary already processed
        };
    }
}

module.exports = PayloadService;
