const express = require("express");
const UserAttendanceReportService = require("../services/user-attendance-report-service");
const user_service = require("../services/user-service");

const UserAttendanceReportController = express.Router();
const reportService = new UserAttendanceReportService();

async function requireAuth(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ message: "Authorization required" });
    return null;
  }
  const token = authHeader.split(" ")[1];
  const userservice = new user_service();
  return await userservice.checkValidUser(token);
}

/** ---------- DAILY LIVE ---------- */
UserAttendanceReportController.get("/day/:date", async (req, res) => {
  try {
    const decrypted = await requireAuth(req, res);
    if (!decrypted) return;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await reportService.dayReport(
      req.params.date,
      page,
      limit,
      decrypted.id       // 👈 pass acting userId for visibility
    );

    res.json({ success: true, mode: "live", ...result });
  } catch (err) {
    console.error("GET /day error", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/** ---------- DAILY APPEND SNAPSHOT ---------- */
UserAttendanceReportController.post("/generate/day/:date", async (req, res) => {
  try {
    const decrypted = await requireAuth(req, res);
    if (!decrypted) return;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // 🧩 Parse date safely
    const targetDate = new Date(req.params.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ❌ Validate: must not be today or a future date
    if (isNaN(targetDate)) {
      return res.status(400).json({ success: false, message: "Invalid date format" });
    }
    // if (targetDate >= today) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Cannot generate report for present or future dates"
    //   });
    // }

    // ✅ Proceed for past dates only
    const result = await reportService.appendDayReport(
      req.params.date,
      decrypted.id,   // generatedBy
      page,
      limit,
      decrypted.id    // viewer scope
    );

    res.json({ success: true, mode: result.mode, ...result });
  } catch (err) {
    console.error("❌ POST /generate/day error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


/** ---------- MONTHLY REPORT FROM SNAPSHOTS ---------- */
UserAttendanceReportController.get("/persisted/month/:year/:month", async (req, res) => {
  try {
    const decrypted = await requireAuth(req, res);
    if (!decrypted) return;

    const { year, month } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await reportService.getPersistedMonthlyReport(
      year,
      month,
      page,
      limit,
      decrypted.id       // 👈 scope by visibility
    );

    res.json({ success: true, mode: "persisted", ...result });
  } catch (err) {
    console.error("GET /persisted/month error", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/** ---------- MANAGER OVERRIDE TO PRESENT ---------- */
UserAttendanceReportController.put("/override/present/:reportId", async (req, res) => {
  try {
    const decrypted = await requireAuth(req, res);
    if (!decrypted) return;

    const { reportId } = req.params;
    const { remarks } = req.body;

    const result = await reportService.markAsPresent(
      reportId,
      decrypted.id,   // 👈 manager who did the override
      remarks
    );

    res.json({ success: true, message: "Attendance updated to Present", data: result });
  } catch (err) {
    console.error("PUT /override/present error", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/** ---------- MONTHLY PIVOT REPORT (PERSISTED ONLY) ---------- */
UserAttendanceReportController.get("/pivot/month/:year/:month", async (req, res) => {
  try {
    console.log("1");
    
    const decrypted = await requireAuth(req, res);
    if (!decrypted) return;

    const { year, month } = req.params;

    const result = await reportService.getPersistedMonthlyPivot(
      year,
      month,
      decrypted.id
    );

    res.json({ success: true, mode: "pivot", ...result });
  } catch (err) {
    console.error("GET /pivot/month error", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


/** ---------- MONTHLY PIVOT REPORT (PERSISTED ONLY) ---------- */
UserAttendanceReportController.get("/pivot/month/:year/:month", async (req, res) => {
  try {
    console.log("2");

    const decrypted = await requireAuth(req, res);
    if (!decrypted) return;

    const { year, month } = req.params;

    const result = await reportService.getPersistedMonthlyPivot(
      year,
      month,
      decrypted.id
    );

    res.json({ success: true, mode: "pivot", ...result });
  } catch (err) {
    console.error("GET /pivot/month error", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});



module.exports = UserAttendanceReportController;
