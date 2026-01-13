const express = require('express');
const UserModel = require('../models/user-model');
const AttendanceModel = require('../models/attendance-model');
const user_service = require("../services/user-service");

const DashboardController = express.Router();

async function requireAuth(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).json({ message: "Authorization token is required" });
        return null;
    }
    const token = authHeader.split(" ")[1];
    const userservice = new user_service();
    try {
        const decrypted = await userservice.checkValidUser(token);
        return decrypted;
    } catch (e) {
        res.status(401).json({ message: "Invalid or expired token" });
        return null;
    }
}

DashboardController.get('/stats', async (req, res) => {
    try {
        const decrypted = await requireAuth(req, res);
        if (!decrypted) return;

        // Total Employees (count all docs)
        const totalEmployees = await UserModel.countDocuments({});

        // Active Employees (status = true)
        const activeEmployees = await UserModel.countDocuments({ status: true });

        // Inactive Employees (status = false)
        const inactiveEmployees = await UserModel.countDocuments({ status: false });

        // Present Today
        // Count attendance records for today where type is 'Present'
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        // We filter by attendance date in today's range
        // And attendanceType is 'Present'.
        // Note: attendanceType enum includes "Present", "Absent", "LOP", "Sick Leave" etc.
        const presentToday = await AttendanceModel.countDocuments({
            date: { $gte: todayStart, $lte: todayEnd },
            attendanceType: 'Present'
        });

        // Absent Today logic:
        // Ideally this is (Active Employees - Present Today).
        // Assuming every active employee is expected to be present unless they are on leave.
        // However, if they haven't logged in yet, they are technically "absent" so far.
        const absentToday = Math.max(0, activeEmployees - presentToday);

        res.json({
            totalEmployees,
            activeEmployees,
            inactiveEmployees,
            presentToday,
            absentToday
        });

    } catch (error) {
        console.error("GET /dashboard/stats error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = DashboardController;
