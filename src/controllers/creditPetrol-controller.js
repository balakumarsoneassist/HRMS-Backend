const express = require("express");
const creditPetrolService = require("../services/creditPetrol-service");
const user_service = require("../services/user-service");
const { getVisibleUserIdsFor } = require("../services/visibility.service"); // 👈 IMPORTANT
const routesUtil = require("../utils/routes");
const mongoose = require("mongoose");
const HolidayService = require("../services/holiday-service");

const creditPetrolController = express.Router();
let routes = new routesUtil(creditPetrolService);

// --- helpers ---
async function requireAuth(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ message: "Authorization token is required" });
    return null;
  }
  const token = authHeader.split(" ")[1];
  const usersvc = new user_service();
  const decrypted = await usersvc.checkValidUser(token);
  return decrypted; // { id/_id, roleId, ... }
}

async function getVisibleSetFor(userId) {
  const ids = await getVisibleUserIdsFor(String(userId));
  return new Set(ids.map(String));
}

// ============ ROUTES ============

// Unprotected generic list (keep if you really need it public)
creditPetrolController.get("/", routes.list);

// BULK UPLOAD (guard + visibility)
creditPetrolController.post("/bulk-upload", async (req, res) => {
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const { userId, records } = req.body;
    if (!userId || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: "Invalid request data" });
    }

    // Only allow uploading for users within visibility
    const visible = await getVisibleSetFor(auth.id);
    if (!visible.has(String(userId)) && String(userId) !== String(auth.id)) {
      return res.status(403).json({ message: "Not allowed for this userId" });
    }

    const service = new creditPetrolService();
    const holidaySvc = new HolidayService();

    // Build the docs, checking holiday for each record's date
    const recordsToInsert = await Promise.all(
      records.map(async (r) => {
        // choose a date to evaluate: prefer r.date, else r.updatedAt, else now
        const when = r.date ? new Date(r.date)
                  : r.updatedAt ? new Date(r.updatedAt)
                  : new Date();

        let purposeofVisit = r.purposeofVisit || "";
        if (!isNaN(+when)) {
          try {
            const info = await holidaySvc.isHolidayOn(when);
            if (info?.isHoliday) {
              // append "holiday" if not already present (case-insensitive)
              if (!/holiday/i.test(purposeofVisit)) {
                purposeofVisit = purposeofVisit
                  ? `${purposeofVisit} | holiday`
                  : "holiday";
                // If you want the names too, uncomment next line:
                // const names = info.holidays?.map(h => h.name).filter(Boolean).join(", ");
                // if (names) purposeofVisit += ` (${names})`;
              }
            }
          } catch (_) {
            // ignore holiday check errors; proceed with original text
          }
        }

        return {
          ...r,
          userId,
          purposeofVisit,
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
        };
      })
    );

    // insert
    const inserted = await service.addMany(recordsToInsert);
    const data = inserted?.data || [];
    return res.status(201).json({
      message: "Bulk upload successful",
      insertedCount: data.length,
      data,
    });
  } catch (error) {
    console.error("Bulk Upload Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


// MY PETROL CREDITS (guard + visibility)
creditPetrolController.get("/mypetrolcredits", async (req, res) => {
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const userId = String(req.query.userId || auth.id);
    const visible = await getVisibleSetFor(auth.id);
    if (!visible.has(userId) && userId !== String(auth.id)) {
      return res.status(403).json({ message: "Not allowed for this userId" });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const service = new creditPetrolService();
    const data = await service.retrieveAll({
      userId,
      updatedAt: { $gte: startOfMonth, $lte: endOfMonth },
    });

    res.status(200).json({ message: "Data fetched successfully", data });
  } catch (error) {
    console.error("Error fetching petrol credits:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// LIST FOR APPROVAL (guard + visibility)
creditPetrolController.get("/listforpetrolApproval", async (req, res) => {
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const visibleIds = await getVisibleUserIdsFor(String(auth.id));

    const service = new creditPetrolService();
   const records = await service.listForTabling(
  {
    // approved: null,
  },
  { updatedAt: -1 },
  req.query,
  visibleIds                        // ← service will set filters.userId = { $in: visibleIds }
);
    res.json(records);
  } catch (error) {
    console.error("listforpetrolApproval error:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// BULK APPROVAL LIST (guard + visibility + grouped)
creditPetrolController.get("/all/listforpetrolBulkApproval", async (req, res) => {
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const visibleIds = await getVisibleUserIdsFor(String(auth.id));

    const service = new creditPetrolService();
    // const records = await service.listForTabling(
    //   {
    //     userId: { $in: visibleIds },
    //     approved: null, // pending
    //   },
    //   { date: -1 },
    //   req.query,
    //   null
    // );
    const records = await service.listForTabling(
  {
    //  approved: null,
  },
  { updatedAt: -1 },
  req.query,
  visibleIds                        // ← service will set filters.userId = { $in: visibleIds }
);

    // group by userId
    const grouped = {};
    for (const record of records.data) {
      const uid = record.userId._id;
      if (!grouped[uid]) {
        grouped[uid] = {
          userId: record.userId._id,
          user_name: record.userId.user_name,
          email: record.userId.email,
          mobile_no: record.userId.mobile_no,
          empId: record.userId.empId,
          claims: [],
        };
      }
      grouped[uid].claims.push({
        _id: record._id,
        amount: record.amount,
        from: record.from,
        to: record.to,
        purposeofVisit: record.purposeofVisit,
        kms: record.kms,
        modeoftransport: record.modeoftransport,
        updatedAt: record.updatedAt,
        approved: record.approved,
        approveBy: record.approveBy,
        remarks: record.remarks,
      });
    }

    const finalResult = Object.values(grouped);
    res.json({ data: finalResult, total: finalResult.length, page: records.page, limit: records.limit });
  } catch (error) {
    console.error("Error in listforpetrolBulkApproval:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// TOTAL APPROVED (guard + visibility)
creditPetrolController.get("/totalApproved/:id", async (req, res) => {
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const targetUserId = String(req.params.id);
    const visible = await getVisibleSetFor(auth.id);
    if (!visible.has(targetUserId) && targetUserId !== String(auth.id)) {
      return res.status(403).json({ message: "Not allowed for this userId" });
    }

    const service = new creditPetrolService();
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999);

    const userObjectId = new mongoose.Types.ObjectId(targetUserId);

    const result = await service.aggregationPipeline([
      { $match: { userId: userObjectId, approved: true, updatedAt: { $gte: startOfMonth, $lte: endOfMonth } } },
      { $group: { _id: "$userId", totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    if (!result || result.length === 0) {
      return res.json({ userId: targetUserId, totalAmount: 0, count: 0, message: "No approved claims this month." });
    }

    res.json({ userId: targetUserId, totalAmount: result[0].totalAmount, count: result[0].count });
  } catch (error) {
    console.error("Error fetching total approved petrol claims:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// ONE / ADD / UPDATE / BULK APPROVE / DELETE
creditPetrolController
  .get("/one/:id", routes.retrieve)

  .post("/", routes.add)

  .put("/approve/:id", routes.update)

  .post("/bulkApprove", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;

      const { userId, approveBy, remarks } = req.body;
      if (!userId) return res.status(400).json({ message: "UserId is required" });

      const visible = await getVisibleSetFor(auth.id);
      if (!visible.has(String(userId)) && String(userId) !== String(auth.id)) {
        return res.status(403).json({ message: "Not allowed to approve for this userId" });
      }

      const service = new creditPetrolService();
      const result = await service.updateMany(
        { userId, approved: null },
        { $set: { approved: true, approveBy: approveBy || auth._id || auth.id, remarks: remarks || "Approved in bulk" } }
      );

      if (result.success) {
        return res.json({ message: `✅ ${result.modifiedCount} claims approved successfully.`, count: result.modifiedCount });
      }
      return res.status(404).json({ message: "No pending claims found for this user." });
    } catch (error) {
      console.error("Error in bulkApprove:", error);
      return res.status(500).json({ message: "Server Error", error });
    }
  })

  .delete("/:id", routes.delete);

module.exports = creditPetrolController;
