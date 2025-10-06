const express = require("express");

const user_controller = require("../controllers/user-controller");
const handle_error = require("../utils/handle-error");
const attendance_controller = require("../controllers/attendance-controller");
const access_controller = require("../controllers/access-controller");
const petrol_controller = require("../controllers/creditPetrol-controller");
const leave_policy_controller = require("../controllers/leave-policy-controller");
const standardMenu_controller = require("../controllers/standardMenu-controller");
const LeavetypeController = require("../controllers/leaveType-controller");
const HolidaysController = require("../controllers/holidays-controller");
const UserAttendanceReportController = require("../controllers/user-attendance-report-controller");
const uploadUserRoutes = require("../routes/uploadUser.routes");
const UserDocController = require("../controllers/user-doc-controller")
const PayloadController = require("../controllers/payload-controller")
const masterRouter = express.Router();
masterRouter
  .use("/api/upload-users", uploadUserRoutes)
  .use("/user/upload-docs",UserDocController)
  .use("/user", user_controller)
  .use("/access", access_controller)
  .use("/attendance", attendance_controller)
  .use("/petrol", petrol_controller)
  .use("/leave-policies", leave_policy_controller)
  .use("/leave-type", LeavetypeController)
  .use("/standardmenu", standardMenu_controller)
  .use("/userattendancereport", UserAttendanceReportController)
  .use("/payloads", PayloadController)
  
  .use("/holidays", HolidaysController);
module.exports = masterRouter;
