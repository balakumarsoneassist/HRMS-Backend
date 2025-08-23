
const creditPetrol_model = require("../models/creditPetrol.model");
const crud_service = require("./crud-service");
class creditPetrolService extends crud_service {
    constructor() {
        super(...arguments);
        this.model = creditPetrol_model;
        this.validateAdd = async (data) => {
        };
        this.validateEdit = async (data, id) => {
        };
        this.validateDelete = async (data) => {
        };
    }

async listForTabling(
  filters = {},
  sort = { updatedAt: -1 }, // <- use updatedAt
  query = {},
  visibleUserIds = null
) {
  try {
    // --- pagination ---
    const page  = Math.max(parseInt(query.page)  || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit) || 10, 1), 200);
    const skip  = (page - 1) * limit;

    // --- visibility ---
    if (!filters.userId && Array.isArray(visibleUserIds)) {
      if (visibleUserIds.length === 0) {
        return { data: [], total: 0, page, limit };
      }
      filters.userId = { $in: visibleUserIds };
    }

    // --- date range (optional): ?start=2025-08-01&end=2025-08-31 ---
    if (query.start || query.end) {
      const start = query.start ? new Date(query.start) : null;
      const end   = query.end   ? new Date(query.end)   : null;
      filters.updatedAt = {};
      if (start && !isNaN(+start)) filters.updatedAt.$gte = start;
      if (end   && !isNaN(+end))   filters.updatedAt.$lte = end;
      if (Object.keys(filters.updatedAt).length === 0) delete filters.updatedAt;
    }

    // --- safe regex filters ---
    const esc = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx  = (v) => new RegExp(esc(v), "i");

    const allow = ["from", "to", "purposeofVisit", "modeoftransport", "approved"];
    for (const key of allow) {
      const val = query[key];
      if (val === undefined || val === "") continue;
      if (key === "approved") {
        if (val === true || val === "true") filters.approved = true;
        else if (val === false || val === "false") filters.approved = false;
      } else {
        filters[key] = { $regex: rx(val) };
      }
    }

    // global search
    if (query.search) {
      const r = rx(query.search);
      filters.$or = [
        { from: r },
        { to: r },
        { purposeofVisit: r },
        { modeoftransport: r },
      ];
    }

    const [data, total] = await Promise.all([
      this.model
        .find(filters)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate({
          path: "userId",
          select: "user_name email mobile_no empId role",
          populate: { path: "role", select: "role" }
        })
        .lean(),
      this.model.countDocuments(filters),
    ]);

    return { data, total, page, limit };
  } catch (error) {
    throw error;
  }
}

}
module.exports = creditPetrolService;
