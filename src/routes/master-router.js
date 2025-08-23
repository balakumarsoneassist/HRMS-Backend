const express = require("express");

const user_controller = require("../controllers/user-controller");
const handle_error = require("../utils/handle-error");
const attendance_controller = require("../controllers/attendance-controller");
const access_controller = require("../controllers/access-controller");
const petrol_controller = require("../controllers/creditPetrol-controller");
const leave_policy_controller = require("../controllers/leave-policy-controller");
const standardMenu_controller = require("../controllers/standardMenu-controller");
const LeavetypeController = require("../controllers/leaveType-controller");
const HolidaysController = require('../controllers/holidays-controller');

const masterRouter = express.Router();
masterRouter
  .use("/user", user_controller)
  .use("/access", access_controller)
  .use("/attendance",attendance_controller)
  .use("/petrol",petrol_controller)
.use("/leave-policies",leave_policy_controller )
.use("/leave-type",LeavetypeController)
.use("/standardmenu",standardMenu_controller )
.use('/holidays', HolidaysController);
module.exports = masterRouter;
