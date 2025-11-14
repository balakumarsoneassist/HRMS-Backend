const express = require("express");
const atd_service = require("../services/attendance-service");
const atd_org_service = require("../services/attendance-orginal-service");

const user_service = require("../services/user-service");
const { getVisibleUserIdsFor } = require("../services/visibility.service");
const routesUtil = require("../utils/routes");
const holiday_service = require("../services/holiday-service");

const AttendanceController = express.Router();
let routes = new routesUtil(atd_service);

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
      // ✅ auth
      const decrypted = await requireAuth(req, res);
      if (!decrypted) return;

      // ✅ date parsing
      const [fd, fm, fy] = req.body.fromDate.split("/");
      req.body.fromDate = new Date(`${fy}-${fm}-${fd}T00:00:00Z`);
      const to = req.body.toDate
        ? (() => {
            const [td, tm, ty] = req.body.toDate.split("/");
            return new Date(`${ty}-${tm}-${td}T00:00:00Z`);
          })()
        : req.body.fromDate;

      // ✅ leave availability
      const userservice = new user_service();
      const leavesAvailable = await userservice.leaveAvailable(
        decrypted.id,
        req.body.attendanceType
      );

      const requestedDays = Math.ceil((to - req.body.fromDate) / 86400000) + 1;
      if (leavesAvailable) {
        if (requestedDays > leavesAvailable.value) {
          return res.json({
            success: false,
            message: "Insufficient leave balance",
          });
        }
      } else if (!isNaN(leavesAvailable)) {
        return res.json({
          success: false,
          message: "This type of leave is not available for you",
        });
      }

      const service = new atd_service();
      const leaveEntries = [];

      // one record per day
      const d = new Date(req.body.fromDate);
      while (d <= to) {
        const dayStart = new Date(d);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(d);
        dayEnd.setHours(23, 59, 59, 999);

        const exists = await service.retrieve({
          userId: decrypted.id,
          date: { $gte: dayStart, $lte: dayEnd },
        });
        if (!exists) {
          const body = {
            userId: decrypted.id,
            date: new Date(d),
            attendanceType: req.body.attendanceType,
            reasonForApplying: req.body.reasonForApplying,
          };
          const result = await service.add(body);
          const orgservice = new atd_org_service();
          const results = await orgservice.add(body);
          leaveEntries.push(result);
        }
        d.setDate(d.getDate() + 1);
      }

      await userservice.leaveSub(
        decrypted.id,
        req.body.attendanceType,
        leavesAvailable.value - requestedDays
      );

      if (leaveEntries.length) {
        return res.json({
          success: true,
          message: "Leave(s) applied successfully",
          data: leaveEntries,
        });
      }
      return res.json({
        success: false,
        message: "Leave already marked for given dates",
      });
    } catch (error) {
      console.error("leaverequest error:", error);
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
        $in: ["Sick Leave", "Casual Leave", "Planned Leave", "Maternity Leave"],
      },
      date: { $lte: endOfYear },
      ...req.query, // in case you send pagination (page, limit)
    };

    const records = await service.listForTableleave(query, { sort: { date: -1 } });
    res.json(records);
  } catch (e) {
    console.error("GET /all/:id error:", e);
    res.status(500).json({ message: "Server error" });
  }
})


  .put("/approval/:id", async (req, res) => {
    try {
      const decrypted = await requireAuth(req, res);
      if (!decrypted) return;

      const userservice = new user_service();
      const user = await userservice.retrieve({ _id: decrypted.id });

      const body = {
        approved: req.body.approved,
        remarks: `By ${user.user_name}`,
      };

      const service = new atd_service();
      const details = await service.retrieve({ _id: req.params.id })
      console.log(details);
      if(!req.body.approved){
        const leavecal = await userservice.leaveAdd(
        details.userId,
        details.attendanceType,
        1
      );
      }
       const result = await service.update(body, { _id: req.params.id });
      const orgservice = new atd_org_service();
      const results = await orgservice.update(body, { _id: req.params.id });
      res.json(details);
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
