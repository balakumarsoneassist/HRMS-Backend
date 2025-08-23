const cron = require("node-cron");
const user_service = require("../services/user-service");
const attendance_service = require("../services/attendance-service");
const nodemailer = require("nodemailer");
require("dotenv").config();
const mongoose = require("mongoose");
const attendanceModel = require("../models/attendance-model"); // Import your schema

// ✅ Auto Mark Absent for No Logout
const markAbsentForNoLogout = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    // Find all users who logged in but never logged out
    const records = await attendanceModel.find({
      date: { $gte: today, $lte: endOfDay },
      "geoTaglogin.login": true,
      "geoTaglogout.logout": false,
      attendanceType: "Present",
    });

    if (records.length === 0) {
      console.log("✅ No users found with missing logout today.");
      return;
    }

    // Update each record to Absent
    for (let record of records) {
      record.attendanceType = "Absent";
      record.remarks = "Auto-marked Absent (No logout)";
      await record.save();
      console.log(`⚠️ Marked Absent (No logout) for userId: ${record.userId}`);
    }

    console.log("✅ Auto-marked Absent for no logout completed.");
  } catch (error) {
    console.error("❌ Error in markAbsentForNoLogout:", error.message);
  }
};

// Schedule the task daily at 11:59 PM
cron.schedule("59 23 * * *", markAbsentForNoLogout);

module.exports = markAbsentForNoLogout;

