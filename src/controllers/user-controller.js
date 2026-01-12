// controllers/user-controller.js
const express = require("express");
const user_service = require("../services/user-service");
const routesUtil = require("../utils/routes");
const UserController = express.Router();
let routes = new routesUtil(user_service);
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const AccessModel = require("../models/access-model");
const SUPER_ADMIN_ROLE_ID = "6884cc051725e1465c06c2af";
UserController.get("/", async (req, res) => {
  try {
    const service = new user_service();
    const visibleUserIds = await service.findAccess(req.headers.authorization);
    const data = await service.accesslistForTable(req, visibleUserIds);
    res.json(data);
  } catch (e) {
    console.error("GET /users error:", e);
    res.status(500).json({ message: "Server error" });
  }
})
  .get("/:id", routes.retrieve)
  .post("/", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res
          .status(401)
          .json({ message: "Authorization token is required" });
      }

      const token = authHeader.split(" ")[1];
      const service = new user_service();
      const decrypted = await service.checkValidUser(token);

      const creatorUserId = String(
        decrypted?._id || decrypted?.id || decrypted?.userId || ""
      );
      const creatorRoleId = String(decrypted?.roleId || "");

      if (!creatorUserId || !creatorRoleId) {
        return res
          .status(401)
          .json({ message: "Invalid token (missing user/role id)" });
      }

      // 🔑 FIX: Convert incoming role name to ObjectId
      if (
        req.body.role &&
        typeof req.body.role === "string" &&
        !req.body.role.match(/^[0-9a-fA-F]{24}$/)
      ) {
        // if it's a role name, find its AccessModel
        const accessDoc = await AccessModel.findOne({ role: req.body.role });
        if (!accessDoc) {
          return res
            .status(400)
            .json({
              message: `Role '${req.body.role}' not found in access collection.`,
            });
        }
        req.body.role = accessDoc._id;
      }

      // ✅ Check for duplicates
      const [existingMobile, existingEmail] = await Promise.all([
        service.retrieve({ mobile_no: req.body.mobile_no }),
        service.retrieve({ email: req.body.email }),
      ]);

      if (existingMobile)
        return res.status(400).json({ success: false, message: "Mobile number already exists" });
      if (existingEmail)
        return res.status(400).json({ success: false, message: "Email already exists" });

      const result = await service.add(req.body);
      const newUserId = result?.data?._id;

      // Post-create actions
      await service.leaveModelCreate(
        newUserId,
        req.body.policyName,
        req.body.doj
      );

      // Attach new user under creator's role
      const parentRole = await AccessModel.findById(creatorRoleId).select(
        "_id role access"
      );
      const isRoot =
        Array.isArray(parentRole?.access) &&
        parentRole.access.length === 1 &&
        String(parentRole.access[0]) === String(parentRole._id);

      if (isRoot) {
        if (req.body.assignToRoleId) {
          await AccessModel.findByIdAndUpdate(req.body.assignToRoleId, {
            $addToSet: { members: newUserId },
          });
        }
      } else {
        await AccessModel.findByIdAndUpdate(creatorRoleId, {
          $addToSet: { members: newUserId },
        });
      }

      return res.json(result);
    } catch (e) {
      console.error("POST /users error:", e);
      res.status(400).json({ success: false, message: e.message || "Server error" });
    }
  })

  .post("/superad", async (req, res) => {
    try {
      // --- Auth required ---
      const authHeader = req.headers.authorization;
      if (!authHeader)
        return res
          .status(401)
          .json({ message: "Authorization token is required" });
      const token = authHeader.split(" ")[1];

      const service = new user_service();
      const decrypted = await service.checkValidUser(token);

      const creatorUserId = String(
        decrypted?._id || decrypted?.id || decrypted?.userId || ""
      );
      const creatorRoleId = String(decrypted?.roleId || "");
      const creatorRoleName = String(decrypted?.roleName || "");

      if (!creatorUserId || !creatorRoleId) {
        return res
          .status(401)
          .json({ message: "Invalid token (missing user/role id)" });
      }

      // --- Enforce Super Admin only ---
      const isSuperAdmin =
        creatorRoleId === SUPER_ADMIN_ROLE_ID ||
        (creatorRoleName && creatorRoleName.toLowerCase() === "super admin");

      if (!isSuperAdmin) {
        return res
          .status(403)
          .json({ message: "Only Super Admin can use this API." });
      }

      // --- Validate incoming role & payload ---
      const incomingRole = (req.body.role || "").trim(); // "Admin" | "Employee" | "Intern"
      if (!["Admin", "Employee", "Intern"].includes(incomingRole)) {
        return res
          .status(400)
          .json({ message: "role must be 'Admin', 'Employee' or 'Intern'." });
      }
      if (incomingRole === "Admin" && !req.body.designation) {
        return res
          .status(400)
          .json({ message: "designation is required when role is 'Admin'." });
      }

      // --- Uniqueness checks ---
      const [existingMobile, existingEmail] = await Promise.all([
        service.retrieve({ mobile_no: req.body.mobile_no }),
        service.retrieve({ email: req.body.email }),
      ]);
      if (existingMobile)
        return res.status(400).json({ success: false, message: "Mobile number already exists" });
      if (existingEmail)
        return res.status(400).json({ success: false, message: "Email already exists" });

      // --- Load templates/roles by name ---
      const [adminTemplate, employeeRole, internRole] = await Promise.all([
        AccessModel.findOne({ role: "Admin" }),
        AccessModel.findOne({ role: "Employee" }),
        AccessModel.findOne({ role: "Intern" }),
      ]);

      let finalRoleId;
      let positionToSet;

      if (incomingRole === "Admin") {
        if (!adminTemplate) {
          return res
            .status(400)
            .json({ message: "Admin template role not found in access." });
        }
        const designation = String(req.body.designation).trim();

        // Duplicate Admin as new Access = designation (Super Admin retains top)
        const newAccess = await AccessModel.create({
          role: designation,
          main: adminTemplate.main,
          access: [new mongoose.Types.ObjectId(SUPER_ADMIN_ROLE_ID)],
          members: [],
          updatedAt: new Date(),
        });

        finalRoleId = newAccess._id;
        positionToSet = designation;
      } else if (incomingRole === "Employee") {
        if (!employeeRole) {
          return res
            .status(400)
            .json({ message: "Employee role not found in access." });
        }
        finalRoleId = employeeRole._id;
        positionToSet = "Employee";
      } else {
        // Intern
        if (!internRole) {
          return res
            .status(400)
            .json({ message: "Intern role not found in access." });
        }
        finalRoleId = internRole._id;
        positionToSet = "Intern";
      }

      // --- Create user with final role + position ---
      const payload = {
        ...req.body,
        role: finalRoleId,
        position: positionToSet,
      };

      const created = await service.add(payload);
      const newUserId = created?.data?._id;

      // --- Seed default leaves ---
      // await service.leaveModelCreate(newUserId);
      await service.leaveModelCreate(
        newUserId,
        req.body.policyName,
        req.body.doj
      );

      // --- Add user to role members ---
      // await AccessModel.findByIdAndUpdate(finalRoleId, { $addToSet: { members: newUserId } });

      // --- Return final user state ---
      const finalUser = await service.retrieve({ _id: newUserId });
      return res.json({
        success: true,
        data: finalUser,
        message: "User created.",
      });
    } catch (e) {
      console.error("POST /superad error:", e);
      res.status(400).json({ success: false, message: e.message || "Server error" });
    }
  })
  .put("/:id", routes.update)

  //   .post("/change-password", async (req, res) => {
  //   try {
  //     const auth = await requireAuth(req, res);
  //     if (!auth) return;

  //     const userId = String(auth.id || auth._id);
  //     const { currentPassword, newPassword } = req.body || {};

  //     if (!currentPassword || !newPassword) {
  //       return res.status(400).json({ message: "currentPassword and newPassword are required" });
  //     }

  //     const svc = new user_service();
  //     const result = await svc.changeOwnPassword(userId, currentPassword, newPassword);
  //     return res.json({ success: true, message: "Password changed successfully" });
  //   } catch (e) {
  //     console.error("POST /users/change-password error:", e);
  //     const msg = e?.message || "Server error";
  //     const code = msg === "Current password is incorrect" ? 400 : 500;
  //     res.status(code).json({ success: false, message: msg });
  //   }
  // })

  // =============== RESET PASSWORD (ADMIN / SUPER ADMIN) ===============
  .post("/reset-password/:id", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) return;

      const actorRoleId = String(auth.roleId || "");
      const actorRoleName = String(auth.roleName || "");

      // Restrict who can reset others' passwords. Here: Super Admin only.
      const isSuperAdmin =
        actorRoleId === SUPER_ADMIN_ROLE_ID ||
        actorRoleName.toLowerCase() === "super admin";

      if (!isSuperAdmin) {
        return res
          .status(403)
          .json({ message: "Only Super Admin can reset passwords." });
      }

      const targetUserId = String(req.params.id);
      const { newPassword } = req.body || {};
      if (!newPassword) {
        return res.status(400).json({ message: "newPassword is required" });
      }

      const svc = new user_service();
      await svc.setPasswordDirect(targetUserId, newPassword);
      return res.json({
        success: true,
        message: "Password reset successfully",
      });
    } catch (e) {
      console.error("POST /users/reset-password/:id error:", e);
      res
        .status(500)
        .json({ success: false, message: e?.message || "Server error" });
    }
  })

  // =============== CHANGE PASSWORD (self) ===============
  .post("/change-password", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader)
        return res
          .status(401)
          .json({ message: "Authorization token is required" });
      const token = authHeader.split(" ")[1];

      const service = new user_service();
      const decrypted = await service.checkValidUser(token);
      const userId = String(
        decrypted?._id || decrypted?.id || decrypted?.userId || ""
      );

      const { currentPassword, newPassword } = req.body || {};

      if (!currentPassword || !newPassword) {
        return res
          .status(400)
          .json({ message: "currentPassword and newPassword are required" });
      }

      const svc = new user_service();
      await svc.changeOwnPassword(userId, currentPassword, newPassword);

      return res.json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (e) {
      console.error("POST /api/user/change-password error:", e);
      const msg = e?.message || "Server error";
      const code = msg === "Current password is incorrect" ? 400 : 500;
      res.status(code).json({ success: false, message: msg });
    }
  })

  // ✅ Soft Delete user
  .delete("/:id", async (req, res) => {
    try {
      const service = new user_service();
      const result = await service.softDeleteUser(
        req.params.id,
        req.body.deletedBy,
        req.body.reason
      );
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  })

  // ✅ Restore user
  .post("/restore/:id", async (req, res) => {
    try {
      const service = new user_service();
      const result = await service.restoreUser(req.params.id);
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
module.exports = UserController;
