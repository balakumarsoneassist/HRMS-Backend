const fs = require("fs");
const path = require("path");
const attendanceModel = require("../models/attendance-model");
const userAttendanceReportModel = require("../models/user-attendance-report-model");
const { getVisibleUserIdsFor } = require("../services/visibility.service");
const HolidayService = require('../services/holiday-service'); // ✅ import HolidayService

class UserAttendanceReportService {
  constructor() {
    const configPath = path.join(__dirname, "../config/shifttimings.json");
    const raw = fs.readFileSync(configPath);
    this.shiftConfig = JSON.parse(raw);
  }

  getShift(date) {
    const day = new Date(date).getDay();
    return (day === 6 && this.shiftConfig.weekendShift)
      ? this.shiftConfig.weekendShift
      : this.shiftConfig.defaultShift;
  }

  buildReportRow(r) {
    let calculatedType = r.attendanceType;
    let reason = null;
    let resonforLOP = "";

    const leaveTypes = ["Sick Leave", "Casual Leave", "Maternity Leave", "Planned Leave", "Comp OFF"];
    if (leaveTypes.includes(r.attendanceType)) {
      reason = r.reasonForApplying || "-";
    }

    if (r.attendanceType === "Present" && r.geoTaglogin?.date && r.geoTaglogout?.date) {
      const loginTime = new Date(r.geoTaglogin.date);
      const logoutTime = new Date(r.geoTaglogout.date);
      const shift = this.getShift(r.date);

      const shiftStart = new Date(r.date);
      shiftStart.setHours(shift.startHour, shift.startMinute, 0, 0);

      const shiftEnd = new Date(r.date);
      shiftEnd.setHours(shift.endHour, shift.endMinute, 0, 0);

      if (loginTime <= shiftStart && logoutTime >= shiftEnd) {
        calculatedType = "Present";
      } else {
        calculatedType = "LOP";
        if (loginTime > shiftStart) {
  const lateMs = loginTime - shiftStart;
  const lateMinutes = Math.floor(lateMs / (1000 * 60));
  const lateHours = Math.floor(lateMinutes / 60);
  const lateMins = lateMinutes % 60;
  const lateText =
    lateHours > 0
      ? `${lateHours} hr ${lateMins} min`
      : `${lateMins} min`;

  resonforLOP = `Late login by ${lateText} at ${loginTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

if (logoutTime < shiftEnd) {
  const earlyMs = shiftEnd - logoutTime;
  const earlyMinutes = Math.floor(earlyMs / (1000 * 60));
  const earlyHours = Math.floor(earlyMinutes / 60);
  const earlyMins = earlyMinutes % 60;
  const earlyText =
    earlyHours > 0
      ? `${earlyHours} hr ${earlyMins} min`
      : `${earlyMins} min`;

  resonforLOP +=
    (resonforLOP ? "; " : "") +
    `Early logout by ${earlyText} at ${logoutTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

      }
    } else if (r.attendanceType === "Present") {
      calculatedType = "LOP";
      resonforLOP = "Missing login or logout record";
    }

    return {
      userId: r.userId
        ? {
            _id: r.userId._id,
            user_name: r.userId.user_name,
            email: r.userId.email,
            empId: r.userId.empId,
            roleId: r.userId.roleId
          }
        : null,
      date: r.date,
      attendanceType: calculatedType,
      approved: r.approved,
      isHoliday: r.isHoliday,
      remarks: r.remarks,
      reasonForApplying: reason,
      resonforLOP,
      geoTaglogin: r.geoTaglogin,
      geoTaglogout: r.geoTaglogout,
      changedBy: r.changedBy
        ? {
            _id: r.changedBy._id,
            user_name: r.changedBy.user_name,
            email: r.changedBy.email,
            empId: r.changedBy.empId
          }
        : null
    };
  }

  /** ------------------ DAILY LIVE ------------------ */
  /** ------------------ DAILY LIVE ------------------ */
async dayReport(date, page = 1, limit = 10, viewerId) {
  const visibleIds = await getVisibleUserIdsFor(viewerId);

  const day = new Date(date);
  const start = new Date(day); start.setHours(0, 0, 0, 0);
  const end = new Date(day); end.setHours(23, 59, 59, 999);

  const filter = { date: { $gte: start, $lte: end } };
  if (visibleIds?.length) filter.userId = { $in: visibleIds };

  const skip = (page - 1) * limit;
  const [records, total] = await Promise.all([
    attendanceModel.find(filter)
      .populate("userId", "empId user_name email roleId") // ✅ only userId here
      .skip(skip).limit(limit).sort({ date: 1 }),
    attendanceModel.countDocuments(filter)
  ]);

  return { data: records.map(r => this.buildReportRow(r)), total, page, limit };
}


  /** ------------------ DAILY APPEND SNAPSHOT ------------------ */
  // async appendDayReport(date, generatedBy, page = 1, limit = 10, viewerId) {
  //   const visibleIds = await getVisibleUserIdsFor(viewerId);

  //   const day = new Date(date);
  //   const start = new Date(day); start.setHours(0, 0, 0, 0);
  //   const end = new Date(day); end.setHours(23, 59, 59, 999);

  //   const filter = { date: { $gte: start, $lte: end } };
  //   if (visibleIds?.length) filter.userId = { $in: visibleIds };
  //   const existing = await userAttendanceReportModel.findOne(filter);
  //   if (existing) {
  //     const skip = (page - 1) * limit;
  //     const [data, total] = await Promise.all([
  //       userAttendanceReportModel.find(filter)
  //         .populate("userId", "empId user_name email roleId")
  //         .populate("generatedBy", "user_name email empId")
  //         .populate("changedBy", "empId user_name email") // ✅ include changedBy
  //         .skip(skip).limit(limit).sort({ date: 1 }),
  //       userAttendanceReportModel.countDocuments(filter)
  //     ]);
  //     return { data, total, page, limit, mode: "already-exists" };
  //   }

  //   const rows = (await this.dayReport(date, page, limit, viewerId)).data;

  //   for (const row of rows) {
  //     const existsForUser = await userAttendanceReportModel.findOne({
  //       userId: row.userId?._id,
  //       date: row.date,
  //       generatedBy: { $ne: null }
  //     });

  //     if (existsForUser) continue;

  //     await new userAttendanceReportModel({
  //       ...row,
  //       generatedBy
  //     }).save();
  //   }

  //   return { data: rows, total: rows.length, page, limit, mode: "created" };
  // }


  async appendDayReport(date, generatedBy, page = 1, limit = 10, viewerId) {
  const visibleIds = await getVisibleUserIdsFor(viewerId);

  const day = new Date(date);
  const start = new Date(day); start.setHours(0, 0, 0, 0);
  const end = new Date(day); end.setHours(23, 59, 59, 999);

  const dateFilter = { date: { $gte: start, $lte: end } };
  if (visibleIds?.length) dateFilter.userId = { $in: visibleIds };

  // 🧾 Step 1: Get all existing users who already have a report for that date
  const existingUserIds = await userAttendanceReportModel.distinct("userId", dateFilter);

  // 🧮 Step 2: Generate full report for the day (all visible users)
  const allRows = (await this.dayReport(date, page, limit, viewerId)).data;

  // 🆕 Step 3: Filter rows for users who don’t have existing reports
  const newRows = allRows.filter(row => 
    !existingUserIds.some(id => id.toString() === row.userId?._id?.toString())
  );

  // 🧩 Step 4: Append only missing users
  for (const row of newRows) {
    await new userAttendanceReportModel({
      ...row,
      generatedBy
    }).save();
  }

  // 🗂️ Step 5: Always return the latest paginated list for that day
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    userAttendanceReportModel.find(dateFilter)
      .populate("userId", "empId user_name email roleId")
      .populate("generatedBy", "user_name email empId")
      .populate("changedBy", "empId user_name email")
      .skip(skip).limit(limit).sort({ date: 1 }),
    userAttendanceReportModel.countDocuments(dateFilter)
  ]);

  // 🏁 Return with mode based on new insertions
  return {
    data,
    total,
    page,
    limit,
    mode: newRows.length > 0 ? "appended" : "already-up-to-date",
    appendedCount: newRows.length
  };
}

  /** ------------------ PERSISTED MONTHLY ------------------ */
  async getPersistedMonthlyReport(year, month, page = 1, limit = 10, viewerId) {
    const visibleIds = await getVisibleUserIdsFor(viewerId);

    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const filter = { date: { $gte: start, $lte: end } };
    if (visibleIds?.length) filter.userId = { $in: visibleIds };

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      userAttendanceReportModel.find(filter)
        .populate("userId", "empId user_name email roleId")
        .populate("generatedBy", "user_name email empId")
        .populate("changedBy", "empId user_name email") // ✅ include changedBy
        .skip(skip).limit(limit).sort({ date: 1 }),
      userAttendanceReportModel.countDocuments(filter)
    ]);

    return { data, total, page, limit };
  }

  /** ------------------ MANAGER OVERRIDE ------------------ */
  async markAsPresent(reportId, changedBy, remarks = "") {
    const report = await userAttendanceReportModel.findById(reportId);
    if (!report) throw new Error("Attendance report not found");

    report.changedItem = `attendanceType:${report.attendanceType}`;
    report.changedRemarks = remarks || "Manager override to Present";
    report.changedBy = changedBy;
    report.attendanceType = "Present";
    report.resonforLOP = "";
    report.approved = true;

    await report.save();

    return await report.populate([
      { path: "userId", select: "empId user_name email roleId" },
      { path: "changedBy", select: "empId user_name email" }
    ]);
  }



/** ------------------ MONTHLY PIVOT WITH TOTAL PRESENT/DAYS ------------------ */
async getPersistedMonthlyPivot(year, month, viewerId) {
  const visibleIds = await getVisibleUserIdsFor(viewerId);

  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  const filter = { date: { $gte: start, $lte: end } };
  if (visibleIds?.length) filter.userId = { $in: visibleIds };

  const tz = "Asia/Kolkata";
  const fmtIST = (d) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(d));

  // ✅ populate both user_name and empId
  const records = await userAttendanceReportModel
    .find(filter)
    .populate("userId", "user_name empId")
    .sort({ date: 1 });

  // Collect all dates for the month
  const allDatesSet = new Set();
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    allDatesSet.add(fmtIST(d));
  }
  for (const rec of records) {
    allDatesSet.add(fmtIST(rec.date));
  }
  const dates = Array.from(allDatesSet).sort();

  // --- Build Pivot ---
  const pivot = {};
  for (const rec of records) {
    const uname = rec.userId?.user_name || "Unknown";
    const empId = rec.userId?.empId || "Unknown";
    const d = fmtIST(rec.date);

    if (!pivot[empId]) {
      pivot[empId] = {
        empId,
        user_name: uname,
        _totals: { present: 0, totalDays: dates.length },
      };
      dates.forEach((dt) => (pivot[empId][dt] = null));
    }

    if (rec.isHoliday) {
      pivot[empId][d] = "holiday";
    } else if (rec.attendanceType?.toLowerCase() === "present") {
      pivot[empId][d] = "present";
      pivot[empId]._totals.present++;
    } else if (rec.attendanceType) {
      pivot[empId][d] = rec.attendanceType.toLowerCase();
    }
  }

  // Format totals like "present/totalDays"
  for (const eid in pivot) {
    const { present, totalDays } = pivot[eid]._totals;
    pivot[eid]._totals = `${present}/${totalDays}`;
  }

  // ✅ Return empId and name explicitly
  return { dates, users: pivot };
}



async getPersistedMonthlyPivotHoliday(year, month, viewerId) {
  const visibleIds = await getVisibleUserIdsFor(viewerId);

  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  const filter = { date: { $gte: start, $lte: end } };
  if (visibleIds?.length) filter.userId = { $in: visibleIds };

  const tz = 'Asia/Kolkata';
  const fmtIST = (d) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(d));

  // ✅ Fetch attendance records
  const records = await userAttendanceReportModel.find(filter)
    .populate('userId', 'user_name')
    .sort({ date: 1 });

  // ✅ Fetch holidays from holiday-service (using its list() method)
  const holidayService = new HolidayService();
  const holidaysResponse = await holidayService.list(); // matches .get('/rules', routes.list)
  const holidays = holidaysResponse?.data || holidaysResponse || [];

  // ✅ Collect all dates of the month
  const allDatesSet = new Set();
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    allDatesSet.add(fmtIST(d));
  }

  // Add attendance & holiday dates
  for (const rec of records) allDatesSet.add(fmtIST(rec.date));
  for (const h of holidays) {
    const hDate = h.date ? fmtIST(h.date) : null;
    if (hDate) allDatesSet.add(hDate);
  }

  const dates = Array.from(allDatesSet).sort();

  // ✅ Build pivot data
  const pivot = {};

  // Fill attendance data
  for (const rec of records) {
    const uname = rec.userId?.user_name || 'Unknown';
    const d = fmtIST(rec.date);

    if (!pivot[uname]) {
      pivot[uname] = { _totals: { present: 0, totalDays: dates.length } };
      dates.forEach(dt => (pivot[uname][dt] = null));
    }

    if (rec.isHoliday) {
      pivot[uname][d] = 'holiday';
    } else if (rec.attendanceType?.toLowerCase() === 'present') {
      pivot[uname][d] = 'present';
      pivot[uname]._totals.present++;
    } else if (rec.attendanceType) {
      pivot[uname][d] = rec.attendanceType.toLowerCase();
    }
  }

  // ✅ Fill holiday-only days (even if no attendance record exists)
  for (const h of holidays) {
    const hDate = h.date ? fmtIST(h.date) : null;
    if (!hDate) continue;

    for (const uname in pivot) {
      if (!pivot[uname][hDate]) {
        pivot[uname][hDate] = 'holiday';
      }
    }
  }

  // ✅ Format totals as "present/totalDays"
  for (const uname in pivot) {
    const { present, totalDays } = pivot[uname]._totals;
    pivot[uname]._totals = `${present}/${totalDays}`;
  }

  return { dates, users: pivot, holidays };
}



}
module.exports = UserAttendanceReportService;
