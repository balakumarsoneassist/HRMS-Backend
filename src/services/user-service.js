const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const user_model = require("../models/user-model");
const deleteduser_model = require("../models/deleted-user-model");
const DeletedUserModel = require("../models/deleted-user-model");
const access_model = require("../models/access-model");
const access_service = require("../services/access-service");
const crud_service = require("./crud-service");
const leaveType_service = require("./leaveType-service");
const { getVisibleUserIdsFor } = require("./visibility.service");
const mongoose = require("mongoose");
const LeavePolicyService = require("./leavePolicy-service");
const LeaveTypeService = require("./leaveType-service");
const ensureStandardMenus = require("../seed/ensure-standard-menus");

class UserService extends crud_service {
  constructor() {
    super(...arguments);
    this.model = user_model;
    this.access_model = access_model;
    this.privateKey = "Bala"; // 🔒 Move to .env in production

    this.validateAdd = async (data) => {};
    this.validateEdit = async (data, id) => {};
    this.validateDelete = async (data) => {};

    this.init = async () => {
      try {
        const ObjectId = (v) => new mongoose.Types.ObjectId(v);

        // === Role IDs ===
        const superAdminRoleId = ObjectId("6884cc051725e1465c06c2af");
        const adminRoleId = ObjectId("6884cc051725e1465c06c2b0");
        const employeeRoleId = ObjectId("6884cc051725e1465c06c2b1");
        const internRoleId = ObjectId("6896e80b9c8f8101f0439813");

        // === Roles Data ===
        const roles = [
          {
            _id: superAdminRoleId,
            role: "Super Admin",
            main: [
              {
                menuName: "Dashboard",
                children: [{ submenuName: "Dashboard" }],
              },
              {
                menuName: "Assign Templates",
                children: [{ submenuName: "Letter of Appointment" }],
              },
              {
                menuName: "Access",
                children: [
                  { submenuName: "Access" },
                  { submenuName: "Access Define" },
                ],
              },
              {
                menuName: "User Management",
                children: [
                  { submenuName: "Add User" },
                  { submenuName: "View Users" },
                  { submenuName: "ViewEdit Users" },
                ],
              },
              {
                menuName: "Reports",
                children: [
                  { submenuName: "Daily Report" },
                  { submenuName: "Monthly Report" },
                ],
              },
              {
                menuName: "Employee's Approval",
                children: [
                  { submenuName: "Employee Leave Approval" },
                  { submenuName: "Employee Petrol Approval" },
                ],
              },
              {
                menuName: "Leave Policy",
                children: [{ submenuName: "Yearly Leave Policy" }],
              },
              {
                menuName: "Holiday Planning",
                children: [{ submenuName: "Holiday Planning" }],
              },
            ],
            access: [superAdminRoleId],
            members: [],
            updatedAt: new Date(),
          },
          {
            _id: adminRoleId,
            role: "Admin",
            main: [
              {
                menuName: "Dashboard",
                children: [{ submenuName: "Dashboard" }],
              },
              {
                menuName: "Certificate",
                children: [
                  { submenuName: "Letters of Appointment" },
                  { submenuName: "Payslip" }
                ],
              },
              {
                menuName: "User Management",
                children: [
                  { submenuName: "Add User" },
                  { submenuName: "View Users" },
                ],
              },
              {
                menuName: "Reports",
                children: [
                  { submenuName: "Daily Report" },
                  { submenuName: "Monthly Report" },
                ],
              },
              {
                menuName: "Employee's Approval",
                children: [
                  { submenuName: "Employee Leave Approval" },
                  { submenuName: "Employee Petrol Approval" },
                ],
              },
              {
                menuName: "Attendance",
                children: [
                  { submenuName: "Leave Request" },
                  { submenuName: "Attendance" },
                ],
              },
              {
                menuName: "Reimbursment",
                children: [{ submenuName: "Petrol Reimbursment" }],
              },
            ],
            access: [superAdminRoleId],
            members: [],
            updatedAt: new Date(),
          },
          {
            _id: employeeRoleId,
            role: "Employee",
            main: [
              {
                menuName: "Dashboard",
                children: [{ submenuName: "Dashboard" }],
              },
              {
                menuName: "Attendance",
                children: [
                  { submenuName: "Leave Request" },
                  { submenuName: "Attendance" },
                ],
              },
              {
                menuName: "Certificate",
                children: [{ submenuName: "Letters of Appointment" }, { submenuName: "Payslip" }],
              },
              {
                menuName: "Reimbursment",
                children: [{ submenuName: "Petrol Reimbursment" }],
              },
            ],
            access: [superAdminRoleId],
            members: [],
            updatedAt: new Date(),
          },
          {
            _id: internRoleId,
            role: "Intern",
            main: [
              {
                menuName: "Dashboard",
                children: [{ submenuName: "Dashboard" }],
              },
              {
                menuName: "Certificate",
                children: [{ submenuName: "Letters of Appointment" }, { submenuName: "Payslip" }],
              },
              {
                menuName: "Attendance",
                children: [
                  { submenuName: "Leave Request" },
                  { submenuName: "Attendance" },
                ],
              },
              {
                menuName: "Reimbursment",
                children: [{ submenuName: "Petrol Reimbursment" }],
              },
            ],
            access: [superAdminRoleId],
            members: [],
            updatedAt: new Date(),
          },
        ];

        // === Upsert Roles ===
        for (const r of roles) {
          await this.access_model.updateOne(
            { _id: r._id },
            { $set: r },
            { upsert: true }
          );
        }
        await ensureStandardMenus();
        // === Ensure Super Admin User ===
        const superAdminUserId = ObjectId("6884d238fbb2351b8786d26f");
        const createdById = ObjectId("678b163cbffdb207e1d7c848");

        const userDoc = {
          _id: superAdminUserId,
          user_name: "SUPER ADMIN",
          mobile_no: "9876543211",
          password:
            "$2b$10$X4S9yDavmUcG9GvAVjDLn.HhKIM7OBTcRW/jowKPctIRGAqaKqH52", // pre-hashed
          email: "bala@gmail.com",
          role: superAdminRoleId,
          position: "Founder & Director",
          status: true,
          logcal: 93,
          createdby: createdById,
          creditpetrol: [
            {
              amount: 220,
              updatedAt: new Date("2025-07-28T18:30:00.000Z"),
              _id: new mongoose.Types.ObjectId("688a0fbadf0bc6ad76a12697"),
            },
          ],
          balance: {
            amount: 0,
            updatedAt: new Date("2025-07-26T13:03:52.665Z"),
          },
          doj: new Date("2025-07-30T12:16:21.134Z"),
          updatedAt: new Date(),
        };

        await this.model.updateOne(
          { _id: superAdminUserId },
          {
            $set: userDoc,
            $setOnInsert: {
              createdAt: new Date("2025-07-26T13:03:52.671Z"),
              __v: 0,
            },
          },
          { upsert: true }
        );

        console.log(
          "✅ Default roles (Super Admin, Admin, Employee, Intern) and Super Admin user ensured."
        );
      } catch (err) {
        console.error("Init error:", err);
        throw err;
      }
    };

    this.login = async (mobileNo, password) => {
      try {
        let user = await this.model
          .findOne({ mobile_no: mobileNo })
          .populate("role");
        if (!user) throw new Error("Account not found");

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) throw new Error("Password not matched");

        if (!user.status) throw new Error("User is inactive");

        const logcal = user.logcal || 0;
        user = await this.model
          .findOneAndUpdate(
            { mobile_no: mobileNo },
            { logcal: logcal + 1 },
            { new: true }
          )
          .populate("role");

        const token = this.encrypt({
          id: user._id,
          roleId: user.role._id,
          roleName: user.role.role,
          access: user.role.main,
          user_name: user.user_name,
          position: user.position,
        });

        return {
          success: true,
          message: "Logged in successfully",
          token,
          logcal: user.logcal,
          role: user.role.role,
          access: user.role.main,
          username: user.user_name,
        };
      } catch (error) {
        throw error;
      }
    };

    this.loginEmpID = async (empID, password) => {
      try {
        let user = await this.model.findOne({ empId: empID }).populate("role");

        if (!user) throw new Error("Account not found");

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) throw new Error("Password not matched");

        if (!user.status) throw new Error("User is inactive");

        const logcal = user.logcal || 0;
        user = await this.model
          .findOneAndUpdate(
            { empId: empID },
            { logcal: logcal + 1 },
            { new: true }
          )
          .populate("role");

        const token = this.encrypt({
          id: user._id,
          roleId: user.role._id,
          roleName: user.role.role,
          access: user.role.main,
          user_name: user.user_name,
          position: user.position,
        });

        return {
          success: true,
          message: "Logged in successfully",
          token,
          logcal: user.logcal,
          role: user.role.role,
          access: user.role.main,
          username: user.user_name,
        };
      } catch (error) {
        throw error;
      }
    };

    this.encrypt = (payload) => {
      return jwt.sign(payload, this.privateKey, { expiresIn: "1d" });
    };

    this.decrypt = (token) => {
      return jwt.verify(token, this.privateKey);
    };

    this.checkValidUser = async (token) => {
      try {
        const data = this.decrypt(token);

        // const user = await this.model.findById(data.id).populate("role");

        // if (!user) throw new Error("Invalid user");
        // if (user.status === false) throw new Error("User Deactivated. Contact admin");

        return data;
      } catch (err) {
        throw err;
      }
    };

    this.findAccess = async (authorization) => {
      if (!authorization) return [];
      const token = authorization.split(" ")[1];
      const decrypted = await this.checkValidUser(token); // your existing JWT verify
      const actingUserId = String(
        decrypted?.id || decrypted?._id || decrypted?.userId || ""
      );
      if (!actingUserId) return [];
      return await getVisibleUserIdsFor(actingUserId);
    };

 

    // Returns how many months remain in the year from the given date's month (inclusive)
function remainingMonthsInYear(date) {
  const m = date.getMonth(); // 0–11
  return 12 - m;
}

// Normalize labels safely
function normalizeLabel(label = "") {
  return String(label).trim();
}

// Allowed leave types
const ALLOWED_LEAVES = [
  "Sick Leave",
  "Casual Leave",
  "Planned Leave",
  "Maternity Leave",
  "Paternity Leave",
  "Compoff Leave"
];

// Get or create a year bucket
function getYearBucket(leaveRecord, year) {
  return (leaveRecord.remaining || []).find(b => b.year === year);
}

function ensureYearBucket(leaveRecord, year, { accrualType, perMonth = 0, fixedAmount = 0, doj } = {}) {
  let bucket = getYearBucket(leaveRecord, year);
  if (bucket) return bucket;

  const months = Array(12).fill(0);
  if (accrualType === "monthly") {
    months.fill(perMonth);
  }
  else if (accrualType === "fixed" && doj && year === new Date(doj).getFullYear()) {
    months[new Date(doj).getMonth()] = fixedAmount;
  }

  bucket = { year, months };
  leaveRecord.remaining = leaveRecord.remaining || [];
  leaveRecord.remaining.push(bucket);
  return bucket;
}


    /**
     * Create per-user leave balances from policies, pro-rated by DOJ.
     * @param {string|ObjectId} userId
     * @param {string} userRoleName  e.g. "Employee" | "Intern"
     * @param {Date|string} doj      user's date of joining (required for pro-rating)
     */

this.leaveModelCreate = async (userId, userRoleName, doj) => {
  console.log("Seeding leaves for:", userId, userRoleName, doj);

  const policySvc = new LeavePolicyService();
  const leaveSvc = new LeaveTypeService();

  // 1) fetch active policies
  let policies = await policySvc.listActive(userRoleName);

  // fallback defaults
  if (!policies || policies.length === 0) {
    const defaults = [
      { label: "Sick Leave", amount: 1, accrualType: "monthly", active: true },
      { label: "Casual Leave", amount: 1, accrualType: "monthly", active: true },
      { label: "Planned Leave", amount: 7, accrualType: "annual", active: true },
      { label: "Maternity Leave", amount: 15, accrualType: "fixed", active: true },
      { label: "Paternity Leave", amount: 5, accrualType: "annual", active: true },
      { label: "Compoff Leave", amount: 3, accrualType: "fixed", active: true },
    ];

    try {
      if (typeof policySvc.addMany === "function") {
        await policySvc.addMany(defaults);
      } else await Promise.all(defaults.map(p => policySvc.add(p)));
    } catch (_) { /* ignore duplicates */ }

    policies = await policySvc.listActive(userRoleName);
  }

  const from = doj ? new Date(doj) : new Date();
  const joinYear = from.getFullYear();
  const remMonths = remainingMonthsInYear(from);
  const currentYear = new Date().getFullYear();

  for (const p of policies) {
    if (!p.active) continue;

    const label = normalizeLabel(p.label);
    if (!ALLOWED_LEAVES.includes(label)) continue;

    const accrualType = String(p.accrualType || "").toLowerCase().trim();
    const amt = Number(p.amount ?? p.value ?? 0);

    let leaveDoc = await leaveSvc.retrieve({ userId, label });

    if (!leaveDoc) {
      let initial = 0;
      const months = Array(12).fill(0);

      if (accrualType === "monthly") {
        initial = amt;
        months.fill(amt);
      } else if (accrualType === "annual") {
        initial = Math.floor((amt * remMonths) / 12);
        const perMonth = remMonths > 0 ? Math.floor(initial / remMonths) : 0;
        for (let i = 12 - remMonths; i < 12; i++) months[i] = perMonth;
        months[11] += initial - (perMonth * remMonths);
      } else if (accrualType === "fixed") {
        initial = amt;
        months[from.getMonth()] = amt;
      }

      initial = Math.max(0, Math.floor(initial));

      leaveDoc = await leaveSvc.add({
        userId,
        label,
        value: initial,
        accrualType,
        doj: from,
        remaining: [{
          year: joinYear,
          months,
          annualValue: accrualType === "annual" ? amt : undefined
        }]
      });
    }
    console.log(leaveDoc);
    leaveDoc =  leaveDoc.data
    if (!getYearBucket(leaveDoc, currentYear)) {
      console.log("🔁 Initializing new leave bucket for year:", currentYear);

      const perMonth = accrualType === "monthly" ? amt : 0;
      ensureYearBucket(leaveDoc, currentYear, { accrualType, perMonth, fixedAmount: amt, doj: leaveDoc.doj });

      if (accrualType === "annual") {
        const bucket = getYearBucket(leaveDoc, currentYear);
        bucket.annualValue = amt;
      }

      await leaveSvc.add({
  ...leaveDoc, // spread existing fields
  remaining: leaveDoc.remaining, // updated buckets
});
    }
  }

  return await leaveSvc.retrieve({ userId });
};



    this.leaveAvailable = async (id, type) => {
      let service = new leaveType_service();
      let result = await service.retrieve({ userId: id, label: type });
      return result;
    };

    this.leaveSub = async (userId, type, minus) => {
      let service = new leaveType_service();
      let result = await service.update(
        { value: minus },
        { userId: userId, label: type }
      );
      return result;
    };

    this.leaveAdd = async (userId, type, add) => {
      let service = new leaveType_service();
      let result = await service.update(
        { value: add },
        { userId: userId, label: type }
      );
      return result;
    };

    this.validatePasswordStrength = (pwd) => {
      const tooShort = typeof pwd !== "string" || pwd.length < 8;
      const upper = /[A-Z]/.test(pwd);
      const lower = /[a-z]/.test(pwd);
      const number = /\d/.test(pwd);
      const special = /[^A-Za-z0-9]/.test(pwd);
      if (tooShort || !upper || !lower || !number || !special) {
        const reason = [];
        if (tooShort) reason.push("at least 8 characters");
        if (!upper) reason.push("one uppercase");
        if (!lower) reason.push("one lowercase");
        if (!number) reason.push("one digit");
        if (!special) reason.push("one special character");
        const msg = `Password must contain ${reason.join(", ")}.`;
        const err = new Error(msg);
        err.code = "WEAK_PASSWORD";
        throw err;
      }
    };

    // Compare provided password with stored hash (throws if user not found)
    this.verifyUserPassword = async (userId, plain) => {
      const user = await this.model.findById(userId).select("+password");
      if (!user) {
        const err = new Error("User not found");
        err.code = "USER_NOT_FOUND";
        throw err;
      }
      const ok = await bcrypt.compare(plain, user.password);
      return { ok, user };
    };

    // Change own password (requires current password)
    // this.changeOwnPassword = async (userId, currentPassword, newPassword) => {
    //   this.validatePasswordStrength(newPassword);
    //   const { ok, user } = await this.verifyUserPassword(userId, currentPassword);
    //   if (!ok) {
    //     const err = new Error("Current password is incorrect");
    //     err.code = "BAD_PASSWORD";
    //     throw err;
    //   }
    //   // Avoid reusing the same password
    //   const sameAsOld = await bcrypt.compare(newPassword, user.password);
    //   if (sameAsOld) {
    //     const err = new Error("New password must be different from the current password");
    //     err.code = "PASSWORD_REUSE";
    //     throw err;
    //   }
    //   const hash = await bcrypt.hash(newPassword, 10);
    //   await this.model.updateOne({ _id: userId }, { $set: { password: hash } });
    //   return true;
    // };
    // Change own password (requires current password)
    this.changeOwnPassword = async (userId, currentPassword, newPassword) => {
      this.validatePasswordStrength(newPassword);
      const { ok, user } = await this.verifyUserPassword(
        userId,
        currentPassword
      );
      if (!ok) {
        const err = new Error("Current password is incorrect");
        err.code = "BAD_PASSWORD";
        throw err;
      }
      // Avoid reusing the same password
      const sameAsOld = await bcrypt.compare(newPassword, user.password);
      if (sameAsOld) {
        const err = new Error(
          "New password must be different from the current password"
        );
        err.code = "PASSWORD_REUSE";
        throw err;
      }
      const hash = await bcrypt.hash(newPassword, 10);
      await this.model.updateOne({ _id: userId }, { $set: { password: hash } });
      return true;
    };
    // Admin reset (no current password required)
    this.setPasswordDirect = async (userId, newPassword) => {
      this.validatePasswordStrength(newPassword);
      const user = await this.model.findById(userId).select("+password");
      if (!user) {
        const err = new Error("User not found");
        err.code = "USER_NOT_FOUND";
        throw err;
      }
      const sameAsOld = await bcrypt.compare(newPassword, user.password);
      if (sameAsOld) {
        const err = new Error(
          "New password must be different from the old password"
        );
        err.code = "PASSWORD_REUSE";
        throw err;
      }
      const hash = await bcrypt.hash(newPassword, 10);
      await this.model.updateOne({ _id: userId }, { $set: { password: hash } });
      return true;
    };
  }

// ✅ Move user to deleted_user collection (soft delete)

async softDeleteUser(userId, deletedBy, reason) {
  const user = await this.model.findById(userId);
  if (!user) throw new Error("User not found");

  // Create a deleted record
  const deletedUser = new DeletedUserModel({
    user_name: user.user_name,
    mobile_no: user.mobile_no,
    empId: user.empId,
    email: user.email,
    role: user.role,
    position: user.position,
    designation: user.designation,
    department: user.department,
    deletedBy: deletedBy || null,
    deletedReason: reason || "Deleted by admin",
    originalCreatedAt: user.createdAt,
    originalUpdatedAt: user.updatedAt,
    backupData: user.toObject(),
  });

  try {
    // ✅ Save deleted record
    const savedDeletedUser = await deletedUser.save();

    // 🧾 Verification step
    const verify = await DeletedUserModel.findById(savedDeletedUser._id);
    if (!verify) throw new Error("Verification failed — deleted user not found after save!");

    console.log("✅ Deleted user saved & verified:", verify._id);

    // 🔥 Remove from main users collection
    await this.model.findByIdAndDelete(userId);
    console.log("🗑️ Original user deleted from main collection:", userId);

    return {
      success: true,
      message: "User moved to deleted_user collection successfully",
      deletedUserId: verify._id
    };
  } catch (err) {
    console.error("❌ Error saving deleted user:", err);
    throw new Error("Failed to save user in deleted_user collection");
  }
}


// ✅ Restore deleted user from deleted_user collection
async restoreUser(deletedUserId) {
  const deletedUser = await deleteduser_model.findById(deletedUserId);
  if (!deletedUser) throw new Error("Deleted user not found");

  // Prevent duplicates — check if email or empId already re-exists
  const existing = await this.model.findOne({
    $or: [{ email: deletedUser.email }, { empId: deletedUser.empId }],
  });
  if (existing) throw new Error("A user with this email or empId already exists");

  // Recreate in main collection
  const restoredUser = new this.model({
    user_name: deletedUser.user_name,
    mobile_no: deletedUser.mobile_no,
    empId: deletedUser.empId,
    email: deletedUser.email,
    role: deletedUser.role,
    position: deletedUser.position,
    designation: deletedUser.designation,
    department: deletedUser.department,
    createdBy: deletedUser.deletedBy || null,
    doj: deletedUser.originalCreatedAt || new Date(),
    dob: deletedUser.backupData?.dob || new Date(),
    status: true,
    password: "$2b$10$X4S9yDavmUcG9GvAVjDLn.HhKIM7OBTcRW/jowKPctIRGAqaKqH52",
    createdby: "6884d238fbb2351b8786d26f"

  });

  await restoredUser.save();

  // Remove from deleted_user collection
  await deleteduser_model.findByIdAndDelete(deletedUserId);

  return { success: true, message: "User restored successfully", data: restoredUser };
}

}

module.exports = UserService;
