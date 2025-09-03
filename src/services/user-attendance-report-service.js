const fs = require("fs");
const path = require("path");
const attendanceModel = require("../models/attendance-model");
const userAttendanceReportModel = require("../models/user-attendance-report-model");
const { getVisibleUserIdsFor } = require("../services/visibility.service");

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
          resonforLOP = `Late login at ${loginTime.toLocaleTimeString()}`;
        }
        if (logoutTime < shiftEnd) {
          resonforLOP += (resonforLOP ? "; " : "") + `Early logout at ${logoutTime.toLocaleTimeString()}`;
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
  async appendDayReport(date, generatedBy, page = 1, limit = 10, viewerId) {
    const visibleIds = await getVisibleUserIdsFor(viewerId);

    const day = new Date(date);
    const start = new Date(day); start.setHours(0, 0, 0, 0);
    const end = new Date(day); end.setHours(23, 59, 59, 999);

    const filter = { date: { $gte: start, $lte: end } };
    if (visibleIds?.length) filter.userId = { $in: visibleIds };

    const existing = await userAttendanceReportModel.findOne(filter);
    if (existing) {
      const skip = (page - 1) * limit;
      const [data, total] = await Promise.all([
        userAttendanceReportModel.find(filter)
          .populate("userId", "empId user_name email roleId")
          .populate("generatedBy", "user_name email empId")
          .populate("changedBy", "empId user_name email") // ✅ include changedBy
          .skip(skip).limit(limit).sort({ date: 1 }),
        userAttendanceReportModel.countDocuments(filter)
      ]);
      return { data, total, page, limit, mode: "already-exists" };
    }

    const rows = (await this.dayReport(date, page, limit, viewerId)).data;

    for (const row of rows) {
      const existsForUser = await userAttendanceReportModel.findOne({
        userId: row.userId?._id,
        date: row.date,
        generatedBy: { $ne: null }
      });

      if (existsForUser) continue;

      await new userAttendanceReportModel({
        ...row,
        generatedBy
      }).save();
    }

    return { data: rows, total: rows.length, page, limit, mode: "created" };
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
}

module.exports = UserAttendanceReportService;
