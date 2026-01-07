const express = require("express");
const atd_service = require("../services/attendance-service");
const atd_org_service = require("../services/attendance-orginal-service");

const user_service = require("../services/user-service");
const { getVisibleUserIdsFor } = require("../services/visibility.service");
const routesUtil = require("../utils/routes");
const holiday_service = require("../services/holiday-service");
const LeaveTypeService = require("../services/leaveType-service");

const AttendanceController = express.Router();
let routes = new routesUtil(atd_service);

// helper: normalize label safely
function normalizeLabel(label) {
  return (label || "").trim();
}

async function requireAuth(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ message: "Authorization token is required" });
    return null;
  }
  const token = authHeader.split(" ")[1];
  const userservice = new user_service();
  const decrypted = await userservice.checkValidUser(token);
  return decrypted;
}
const EmailService = require("../services/email-service");

const formatDateIN = (d) => {
  const dt = new Date(d);
  return dt.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "2-digit" });
};

AttendanceController.get("/", routes.listForTable)

  .get("/one/:id", routes.retrieve)

  // ✅ LOGIN
  .post("/present/login", async (req, res) => {
    try {
      const decrypted = await requireAuth(req, res);
      if (!decrypted) return;

      const service = new atd_service();
      const orgservice = new atd_org_service();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const check = await service.retrieve({
        userId: decrypted.id,
        date: { $gte: todayStart, $lte: todayEnd },
      });

      // 🔎 holiday check
      const hsvc = new holiday_service();
      const holidayInfo = await hsvc.isHolidayOn(new Date());

      if (!check) {
        const body = {
          userId: decrypted.id,
          date: new Date(),
          attendanceType: "Present",
          isHoliday: holidayInfo.isHoliday, // ✅ save holiday flag
          geoTaglogin: {
            login: true,
            latitude: req.body.lat,
            longitude: req.body.lon,
            date: new Date(),
          },
        };
        const result = await service.add(body);
        const results = await orgservice.add(body);
        return res.json(result);
      }
      return res.json(check);
    } catch (err) {
      console.error("present/login error:", err);
      res.status(500).json({ message: "Server error" });
    }
  })

  // ✅ LOGOUT
  .post("/present/logout", async (req, res) => {
    try {
      const decrypted = await requireAuth(req, res);
      if (!decrypted) return;

      const service = new atd_service();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const check = await service.retrieve({
        userId: decrypted.id,
        date: { $gte: todayStart, $lte: todayEnd },
        attendanceType: "Present",
      });

      if (check) {
        // 🔎 holiday check
        const hsvc = new holiday_service();
        const holidayInfo = await hsvc.isHolidayOn(new Date());

        check.geoTaglogout = {
          logout: true,
          latitude: req.body.lat,
          longitude: req.body.lon,
          date: new Date(),
        };
        check.isHoliday = holidayInfo.isHoliday; // ✅ update holiday flag

        const result = await service.update(check, { _id: check._id });
        const orgservice = new atd_org_service();
        const results = await orgservice.update(check, { _id: check._id });
        return res.json(result);
      }
      return res.json(check);
    } catch (err) {
      console.error("present/logout error:", err);
      res.status(500).json({ message: "Server error" });
    }
  })

  .get("/present/check", async (req, res) => {
    try {
      const decrypted = await requireAuth(req, res);
      if (!decrypted) return;

      const service = new atd_service();

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // Existing attendance check
      const check = await service.retrieve({
        userId: decrypted.id,
        date: { $gte: todayStart, $lte: todayEnd },
        attendanceType: "Present",
      });

      // 🔎 NEW: ask holiday service if today is a holiday
      const hsvc = new holiday_service();
      const holidayInfo = await hsvc.isHolidayOn(new Date());

      // keep your old "message" boolean, PLUS holiday flags
      return res.json({
        message: !!check, // same as before
        isHoliday: holidayInfo.isHoliday, // NEW
        holidays: holidayInfo.holidays, // NEW [{id,name,color,isGovernment}]
      });
    } catch (err) {
      console.error("present/check error:", err);
      res.status(500).json({ message: "Server error" });
    }
  })

  .post("/leaverequest", async (req, res) => {
    try {
      // AUTH
      const decrypted = await requireAuth(req, res);
      if (!decrypted) return;

      // Parse dates
      const [fd, fm, fy] = req.body.fromDate.split("/");
      const fromDate = new Date(`${fy}-${fm}-${fd}T00:00:00Z`);

      const toDate = req.body.toDate
        ? (() => {
            const [td, tm, ty] = req.body.toDate.split("/");
            return new Date(`${ty}-${tm}-${td}T00:00:00Z`);
          })()
        : fromDate;

      const attendanceType = normalizeLabel(req.body.attendanceType);
      const requestedDays = Math.ceil((toDate - fromDate) / 86400000) + 1;

      const requestYear = fromDate.getUTCFullYear();
      const requestMonth = fromDate.getMonth();

      // Fetch leave record using service
      const leaveSvc = new LeaveTypeService();
      const leaveRecord = await leaveSvc.retrieve({
        userId: decrypted.id,
        label: attendanceType,
      });

      if (!leaveRecord) {
        return res.json({
          success: false,
          message: "Leave record not found for this type",
        });
      }

      const accrualType = (leaveRecord.accrualType || "").toLowerCase().trim();
      const joiningMonth = leaveRecord.doj
        ? new Date(leaveRecord.doj).getMonth()
        : requestMonth;

      // Find bucket for the year
      let yearBucket = (leaveRecord.remaining || []).find(
        (b) => b.year === requestYear
      );

      if (!yearBucket) {
        return res.json({
          success: false,
          message: `No leave bucket found for year ${requestYear}`,
        });
      }

      // BALANCE CHECK
      if (accrualType === "monthly") {
        const bal = yearBucket.months[requestMonth] ?? 0;
        if (requestedDays > bal) {
          return res.json({
            success: false,
            message: "Insufficient monthly leave balance",
          });
        }
      } else if (accrualType === "fixed") {
        const fixedBal = yearBucket.months[joiningMonth] ?? 0;
        if (requestedDays > fixedBal) {
          return res.json({
            success: false,
            message: "Insufficient fixed leave balance",
          });
        }
      } else if (accrualType === "annual") {
        const avail = yearBucket.annualValue ?? leaveRecord.value ?? 0;
        if (requestedDays > avail) {
          return res.json({
            success: false,
            message: "Insufficient annual leave balance",
          });
        }
      }

      // ADD ATTENDANCE ENTRIES
      const atdService = new atd_service();
      const orgAtdService = new atd_org_service();
      const leaveEntries = [];

      let d = new Date(fromDate);
      while (d <= toDate) {
        const ds = new Date(d);
        const start = new Date(ds.setUTCHours(0, 0, 0, 0));
        const end = new Date(ds.setUTCHours(23, 59, 59, 999));

        const exists = await atdService.retrieve({
          userId: decrypted.id,
          date: { $gte: start, $lte: end },
        });

        if (!exists) {
          const payload = {
            userId: decrypted.id,
            date: new Date(d),
            attendanceType,
            reasonForApplying: req.body.reasonForApplying,
          };

          const rec = await atdService.add(payload);
          await orgAtdService.add(payload);
          leaveEntries.push(rec);
        }
        d.setDate(d.getDate() + 1);
      }

      if (leaveEntries.length === 0) {
        return res.json({
          success: false,
          message: "Leave already applied earlier",
        });
      }

      // DEDUCT BALANCE
      if (accrualType === "monthly") {
        yearBucket.months[requestMonth] -= requestedDays;
        leaveRecord.value -= requestedDays;
      } else if (accrualType === "fixed") {
        yearBucket.months[joiningMonth] -= requestedDays;
        leaveRecord.value -= requestedDays;
      } else if (accrualType === "annual") {
        yearBucket.annualValue -= requestedDays;
        leaveRecord.value -= requestedDays;
      }

      // REPLACE UPDATED BUCKET
      leaveRecord.remaining = leaveRecord.remaining.map((b) =>
        b.year === requestYear ? yearBucket : b
      );
      console.log(leaveRecord._id, leaveRecord.remaining[0].months[10]);

      // SAVE CHANGES using service update
      let rss = await leaveSvc.update(leaveRecord, leaveRecord._id);
      console.log(rss);

      // SUCCESS
      return res.json({
        success: true,
        message: "Leave applied successfully",
        data: leaveEntries,
        updatedBalance: {
          year: requestYear,
          remaining: yearBucket.months,
          annualValue: yearBucket.annualValue,
          totalValue: leaveRecord.value,
        },
      });
    } catch (err) {
      console.error("leaverequest error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  })

  .get("/all", async (_req, res) => {
    try {
      const service = new atd_service();
      const records = await service.listForTable({
        attendanceType: {
          $in: [
            "Sick Leave",
            "Casual Leave",
            "Planned Leave",
            "Maternity Leave",
          ],
        },
        approved: null,
      });
      res.json(records);
    } catch (e) {
      console.error("GET /all error:", e);
      res.status(500).json({ message: "Server error" });
    }
  })

  .get("/all/:id", async (req, res) => {
    try {
      const service = new atd_service();

      const currentYear = new Date().getFullYear();
      const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59); // Dec 31, 23:59:59

      const query = {
        userId: req.params.id,
        attendanceType: {
          $in: [
            "Sick Leave",
            "Casual Leave",
            "Planned Leave",
            "Maternity Leave",
          ],
        },
        date: { $lte: endOfYear },
        ...req.query, // in case you send pagination (page, limit)
      };

      const records = await service.listForTableleave(query, {
        sort: { date: -1 },
      });
      res.json(records);
    } catch (e) {
      console.error("GET /all/:id error:", e);
      res.status(500).json({ message: "Server error" });
    }
  })

  // .put("/approval/:id", async (req, res) => {
  //   try {
  //     const decrypted = await requireAuth(req, res);
  //     if (!decrypted) return;

  //     const userservice = new user_service();
  //     const approver = await userservice.retrieve({ _id: decrypted.id });

  //     const atdService = new atd_service();
  //     const orgService = new atd_org_service();

  //     // get attendance entry
  //     const details = await atdService.retrieve({ _id: req.params.id });
  //     if (!details) {
  //       return res.status(404).json({ message: "Attendance record not found" });
  //     }

  //     const isApprove = req.body.approved === true;

  //     // COMMON update body
  //     const body = {
  //       approved: isApprove,
  //       remarks: `By ${approver.user_name}`,
  //     };

  //     // ----------------------------------------
  //     //  IF REJECTED → RETURN LEAVE BACK
  //     // ----------------------------------------
  //     if (!isApprove) {
  //       const leaveType = normalizeLabel(details.attendanceType);
  //       const leaveSvc = new LeaveTypeService();

  //       // find leave record for user + type
  //       const leaveRecord = await leaveSvc.retrieve({
  //         userId: details.userId,
  //         label: leaveType,
  //       });

  //       if (leaveRecord) {
  //         const requestDate = new Date(details.date);
  //         const requestYear = requestDate.getFullYear();
  //         const requestMonth = requestDate.getMonth();

  //         // locate bucket
  //         let yearBucket = (leaveRecord.remaining || []).find(
  //           (b) => b.year === requestYear
  //         );
  //         if (!yearBucket) {
  //           return res.json({
  //             success: false,
  //             message: `Year bucket not found for ${requestYear}`,
  //           });
  //         }

  //         const accrualType = (leaveRecord.accrualType || "")
  //           .toLowerCase()
  //           .trim();

  //         // 1 DAY must be returned
  //         const returnDays = 1;

  //         // Restore based on accrualType
  //         if (accrualType === "monthly") {
  //           yearBucket.months[requestMonth] += returnDays;
  //           leaveRecord.value += returnDays;
  //         } else if (accrualType === "fixed") {
  //           const dojMonth = leaveRecord.doj
  //             ? new Date(leaveRecord.doj).getMonth()
  //             : requestMonth;
  //           yearBucket.months[dojMonth] += returnDays;
  //           leaveRecord.value += returnDays;
  //         } else if (accrualType === "annual") {
  //           yearBucket.annualValue += returnDays;
  //           leaveRecord.value += returnDays;
  //         }

  //         // update buckets
  //         leaveRecord.remaining = leaveRecord.remaining.map((b) =>
  //           b.year === requestYear ? yearBucket : b
  //         );

  //         // save updated leave record
  //         await leaveSvc.update(leaveRecord, leaveRecord._id);
  //       }
  //     }

  //     // ----------------------------------------
  //     // UPDATE ATTENDANCE RECORD
  //     // ----------------------------------------
  //     await atdService.update(body, { _id: req.params.id });
  //     await orgService.update(body, { _id: req.params.id });

  //     return res.json({
  //       success: true,
  //       status: isApprove ? "approved" : "rejected",
  //       restored: !isApprove ? 1 : 0,
  //       data: details,
  //     });
  //   } catch (e) {
  //     console.error("PUT /approval/:id error:", e);
  //     res.status(500).json({ message: "Server error" });
  //   }
  // })
.put("/approval/:id", async (req, res) => {
  try {
    const decrypted = await requireAuth(req, res);
    if (!decrypted) return;

    const userservice = new user_service();
    const approver = await userservice.retrieve({ _id: decrypted.id });

    const atdService = new atd_service();
    const orgService = new atd_org_service();

    // get attendance entry
    const details = await atdService.retrieve({ _id: req.params.id });
    if (!details) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    const isApprove = req.body.approved === true;

    // COMMON update body
    const body = {
      approved: isApprove,
      remarks: `By ${approver.user_name}`,
    };

    // ----------------------------------------
    //  IF REJECTED → RETURN LEAVE BACK
    // ----------------------------------------
    if (!isApprove) {
      const leaveType = normalizeLabel(details.attendanceType);
      const leaveSvc = new LeaveTypeService();

      const leaveRecordResp = await leaveSvc.retrieve({
        userId: details.userId,
        label: leaveType,
      });

      const leaveRecord = leaveRecordResp?.data || leaveRecordResp;

      if (leaveRecord) {
        const requestDate = new Date(details.date);
        const requestYear = requestDate.getFullYear();
        const requestMonth = requestDate.getMonth();

        let yearBucket = (leaveRecord.remaining || []).find((b) => b.year === requestYear);
        if (!yearBucket) {
          return res.json({
            success: false,
            message: `Year bucket not found for ${requestYear}`,
          });
        }

        const accrualType = String(leaveRecord.accrualType || "").toLowerCase().trim();
        const returnDays = 1;

        if (accrualType === "monthly") {
          yearBucket.months[requestMonth] += returnDays;
          leaveRecord.value += returnDays;
        } else if (accrualType === "fixed") {
          const dojMonth = leaveRecord.doj
            ? new Date(leaveRecord.doj).getMonth()
            : requestMonth;
          yearBucket.months[dojMonth] += returnDays;
          leaveRecord.value += returnDays;
        } else if (accrualType === "annual") {
          yearBucket.annualValue = Number(yearBucket.annualValue || 0) + returnDays;
          leaveRecord.value += returnDays;
        }

        leaveRecord.remaining = leaveRecord.remaining.map((b) =>
          b.year === requestYear ? yearBucket : b
        );

        // ✅ your service expects update(payload, id)
        await leaveSvc.update(
          {
            remaining: leaveRecord.remaining,
            value: leaveRecord.value,
            updatedAt: new Date(),
          },
          leaveRecord._id
        );
      }
    }

    // ----------------------------------------
    // UPDATE ATTENDANCE RECORD
    // ----------------------------------------
    await atdService.update(body, { _id: req.params.id });
    await orgService.update(body, { _id: req.params.id });

    // ----------------------------------------
    // SEND EMAIL (TEMPLATE SELECT)
    // ----------------------------------------
    try {
      // get employee user record to get email
      const employee = await userservice.retrieve({ _id: details.userId });

      if (employee?.email) {
        const emailSvc = new EmailService();

        const vars = {
          companyName: process.env.MAIL_FROM_NAME || "HR Portal",
          name: employee.user_name || "Employee",
          leaveType: normalizeLabel(details.attendanceType),
          date: formatDateIN(details.date),
          approvedBy: approver.user_name || "Manager",
          remarks: body.remarks,
          rejectionReason: req.body.rejectionReason || req.body.reason || "Not mentioned",
        };

        if (isApprove) {
          await emailSvc.sendTemplateEmail("LEAVE_APPROVED", employee.email, vars);
        } else {
          await emailSvc.sendTemplateEmail("LEAVE_REJECTED", employee.email, vars);
        }
      }
    } catch (mailErr) {
      console.error("❌ Email send failed:", mailErr.message);
      // Don't break approval flow if email fails
    }

    return res.json({
      success: true,
      status: isApprove ? "approved" : "rejected",
      restored: !isApprove ? 1 : 0,
      data: details,
    });
  } catch (e) {
    console.error("PUT /approval/:id error:", e);
    res.status(500).json({ message: "Server error" });
  }
})

  .get("/allmyattendance", async (req, res) => {
    try {
      const decrypted = await requireAuth(req, res);
      if (!decrypted) return;

      const service = new atd_service();
      const records = await service.listForTable(
        {
          attendanceType: { $in: ["Present", "Absent", "LOP"] },
          userId: decrypted.id,
          approved: null,
        },
        { sort: { date: -1 } }
      );
      res.json(records);
    } catch (e) {
      console.error("GET /allmyattendance error:", e);
      res.status(500).json({ message: "Server error" });
    }
  })

  // ===== Lists that must respect visibility (Option-B) =====

  .get("/pendinglist", async (req, res) => {
    try {
      const decrypted = await requireAuth(req, res);
      if (!decrypted) return;

      // who can I see?
      const visibleUserIds = await getVisibleUserIdsFor(String(decrypted.id));

      const baseFilter = {
        attendanceType: {
          $in: [
            "Sick Leave",
            "Casual Leave",
            "Planned Leave",
            "Maternity Leave",
          ],
        },
        approved: null,
        userId: { $in: visibleUserIds }, // 👈 scope by visibility
      };

      const sort = { date: -1 };
      const service = new atd_service();
      const records = await service.listForTableWithRole(
        baseFilter,
        sort,
        req.query,
        null
      ); // roleId no longer used
      res.json(records);
    } catch (error) {
      console.error("GET /pendinglist error:", error);
      res.status(500).json({ message: "Server Error" });
    }
  })

  .get("/dailyReports", async (req, res) => {
    try {
      const decrypted = await requireAuth(req, res);
      if (!decrypted) return;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const visibleUserIds = await getVisibleUserIdsFor(String(decrypted.id));

      const baseFilter = {
        attendanceType: { $in: ["Present", "Absent", "LOP"] },
        date: { $gte: todayStart, $lte: todayEnd },
        userId: { $in: visibleUserIds }, // 👈 scope by visibility
      };

      const sort = { date: -1 };
      const service = new atd_service();
      const records = await service.listForTableWithRole(
        baseFilter,
        sort,
        req.query,
        null
      );
      res.json(records);
    } catch (error) {
      console.error("GET /dailyReports error:", error);
      res.status(500).json({ message: "Server Error" });
    }
  })

  .get("/monthlyReports", async (req, res) => {
    try {
      const decrypted = await requireAuth(req, res);
      if (!decrypted) return;

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const endOfMonth = new Date();
      endOfMonth.setMonth(endOfMonth.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);

      const visibleUserIds = await getVisibleUserIdsFor(String(decrypted.id));

      const baseFilter = {
        attendanceType: { $in: ["Present", "Absent", "LOP"] },
        date: { $gte: startOfMonth, $lte: endOfMonth },
        userId: { $in: visibleUserIds }, // 👈 scope by visibility
      };

      const sort = { date: -1 };
      const service = new atd_service();
      const records = await service.listForTableWithRole(
        baseFilter,
        sort,
        req.query,
        null
      );
      res.json(records);
    } catch (error) {
      console.error("GET /monthlyReports error:", error);
      res.status(500).json({ message: "Server Error" });
    }
  })

  .put("one/:id", routes.update)
  .delete("/:id", routes.delete);

module.exports = AttendanceController;
