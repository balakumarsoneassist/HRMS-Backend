const cron = require("node-cron");
const user_service = require("../services/user-service");
const attendance_service = require("../services/attendance-service");
const nodemailer = require("nodemailer");
require("dotenv").config();

// 📩 Email sender function
const sendAbsentNotification = async (user) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"HR Portal" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Absent Notification - Auto Attendance",
      text: `
Dear ${user.user_name},

You have been auto-marked as Absent today (${new Date().toLocaleDateString()})
because attendance was not registered before 11:00 AM.

If this is incorrect, please contact your reporting manager.

Regards,
Attendance System
      `,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error(`❌ Failed to send email to ${user.email}:`, error.message);
  }
};

// ✅ Optimized Auto Attendance Function
const markAbsentAttendance = async () => {
  try {
    const now = new Date();

    // Run only after 11 AM
    if (now.getHours() < 8) {
      console.log("⏳ Waiting until 11 AM...");
      return;
    }
    const today = new Date();

    // Start of day (00:00:00 UTC)
    const startOfDay = new Date(today);
    startOfDay.setUTCHours(0, 0, 0, 0);

    // End of day (23:59:59 UTC)
    const endOfDay = new Date(today);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const userservice = new user_service();
    const attendanceservice = new attendance_service();

    const users = await userservice.retrieveAll({
      status: true,
    });

    for (let user of users) {
      // ✅ Check using exact startOfDay date
      const alreadyMarked = await attendanceservice.retrieve({
        userId: user._id,
        date: { $gte: startOfDay, $lte: endOfDay },
        attendanceType: "Present",
        approved: null,
      });
      console.log(startOfDay, alreadyMarked);
    }

    console.log("✅ Auto attendance job completed successfully.");
  } catch (err) {
    console.error("❌ Error in auto attendance job:", err.message);
  }
};

// ⏰ Schedule cron job daily at 11:01 AM
cron.schedule("1 11 * * *", markAbsentAttendance);

module.exports = markAbsentAttendance;
      // const pendingLeave = await attendanceservice.retrieve({
      //   userId: user._id,
      //   date: startOfDay,
      //   approved: null,
      // });

      // const rejectedLeave = await attendanceservice.retrieve({
      //   userId: user._id,
      //   date: startOfDay,
      //   approved: false,
      // });

      // // Case 1: Absent and not marked yet
      // if (!alreadyMarked) {
      //   await attendanceservice.add(
      //     {
      //       userId: user._id,
      //         date: startOfDay,
      //         attendanceType: "Absent",
      //         remarks: "Auto-marked Absent (not logged in by 11 AM)",

      //     },
      //     { upsert: true }
      //   );
      //   await sendAbsentNotification(user);
      //   console.log(`📩 Absent Email sent for ${user.user_name}`);
      // }

      // // Case 2: Leave request exists but not approved
      // else if (pendingLeave || rejectedLeave) {
      //   await attendanceservice.update(
      //     {
      //         attendanceType: "LOP",
      //         remarks: "Not Approved leave",
      //       },
      //     { userId: user._id, date: startOfDay },

      //   );
      //   await sendAbsentNotification(user);
      //   console.log(`📩 LOP Email sent for ${user.user_name}`);
      // }
//     }

//     console.log("✅ Auto attendance job completed successfully.");
//   } catch (err) {
//     console.error("❌ Error in auto attendance job:", err.message);
//   }
// };

// // ⏰ Schedule cron job daily at 11:01 AM
// cron.schedule("* * * * *", markAbsentAttendance);

// module.exports = markAbsentAttendance;
