const express = require("express");
const mongoose = require("mongoose");
const AccessController = express.Router();

const AccessService = require("../services/access-service");
const RoutesUtil = require("../utils/routes");
const AccessModel = require("../models/access-model");

// 🔐 SA guard deps
const UserService = require("../services/user-service");
const userService = new UserService();
const SUPER_ADMIN_ROLE_ID = "6884cc051725e1465c06c2af"; // your seeded SA role id

const routes = new RoutesUtil(AccessService);

// NOTE: Your AccessModel schema should be:
// access:  [{ type: mongoose.Schema.Types.ObjectId, ref: "access", required: true }],
// members: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }]

// --- helper: Super Admin gate ---
async function assertSuperAdmin(req, res) {
  const auth = req.headers.authorization;
  if (!auth) {
    res.status(401).json({ message: "Authorization token is required" });
    return false;
  }
  try {
    const token = auth.split(" ")[1];
    const decoded = await userService.checkValidUser(token);
    const roleId = String(decoded?.roleId || "");
    const roleName = String(decoded?.roleName || "");
    console.log(roleId);
    
    const ok =
      roleId === SUPER_ADMIN_ROLE_ID ||
      roleName.toLowerCase() === "super admin";
    if (!ok) {
      res.status(403).json({ message: "Only Super Admin can perform this action" });
      return false;
    }
    return true;
  } catch {
    res.status(401).json({ message: "Invalid/expired token" });
    return false;
  }
}

AccessController
  // Roles for dropdown etc. (excludes Super Admin per your service)
  .get("/", async (req, res) => {
    try {
      const service = new AccessService();
      const result = await service.roleretrieve(req);
      res.json(result);
    } catch (e) {
      console.error("GET /access error:", e);
      res.status(500).json({ message: "Server error" });
    }
  })

  // FE payload: users with effective access (uses service logic)
  .get("/access", async (req, res) => {
    try {
      const { format = "list", viewerId } = req.query;
      const service = new AccessService();

      if (format === "tree") {
        const tree = await service.getHierarchy(viewerId || null);
        return res.json(tree);
      } else {
        const list = await service.retriveAlluserwithRoles(viewerId || null);
        return res.json(list);
      }
    } catch (e) {
      console.error("GET /access/access error:", e);
      res.status(500).json({ message: "Server error" });
    }
  })

  .get("/hierarchy", async (req, res) => {
    try {
      const viewerId = req.query.viewerId || null;
      const service = new AccessService();
      const data = await service.getHierarchyNodes(viewerId);
      res.json(data);
    } catch (e) {
      console.error("GET /access/hierarchy error:", e);
      res.status(500).json({ message: "Server error" });
    }
  })

  // Move a ROLE under a new parent ROLE (e.g., Admin under Lead) – keeps Super Admin
  .post("/updateRoleAccess", async (req, res) => {
    try {
      const { roleId, newParentRoleId } = req.body || {};
      if (!roleId || !newParentRoleId) {
        return res.status(400).json({ message: "Missing roleId or newParentRoleId" });
      }
      if (!mongoose.isValidObjectId(roleId) || !mongoose.isValidObjectId(newParentRoleId)) {
        return res.status(400).json({ message: "Invalid roleId or newParentRoleId" });
      }

      const superAdminRole = await AccessModel.findOne({ role: "Super Admin" }).select("_id");
      if (!superAdminRole) return res.status(404).json({ message: "Super Admin role not found" });

      const role = await AccessModel.findById(roleId);
      if (!role) return res.status(404).json({ message: "Role not found" });

      // Always include SA + new parent
      const saId = String(superAdminRole._id);
      const parentId = String(newParentRoleId);
      role.access = Array.from(new Set([saId, parentId]));

      await role.save();
      return res.json({ success: true, message: "Role access updated", data: role });
    } catch (err) {
      console.error("❌ Error updating role access:", err);
      res.status(500).json({ message: "Server error" });
    }
  })

  // Assign an EMPLOYEE to a parent ROLE (writes to access.members)
  .post("/assignMember", async (req, res) => {
    try {
      const { userId, parentRoleId } = req.body || {};
      if (!userId || !parentRoleId) {
        return res.status(400).json({ message: "Missing userId or parentRoleId" });
      }
      if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(parentRoleId)) {
        return res.status(400).json({ message: "Invalid userId or parentRoleId" });
      }

      const parent = await AccessModel.findById(parentRoleId).select("_id");
      if (!parent) return res.status(404).json({ message: "Parent role not found" });

      await AccessModel.updateMany(
        { members: userId, _id: { $ne: parentRoleId } },
        { $pull: { members: userId } }
      );

      const updatedParent = await AccessModel.findByIdAndUpdate(
        parentRoleId,
        { $addToSet: { members: userId } },
        { new: true }
      );

      return res.json({
        success: true,
        message: "Member assignment updated",
        data: updatedParent,
      });
    } catch (err) {
      console.error("assignMember error:", err);
      res.status(500).json({ message: "Server error" });
    }
  })

  // ===== Super Admin only: GET/POST main for a role =====

  // GET /access/main?roleId=<id>  OR  /access/main?role=Admin
  .get("/main", async (req, res) => {
    try {
      if (!(await assertSuperAdmin(req, res))) return;

      const { roleId, role } = req.query;
      if (!roleId && !role) {
        return res.status(400).json({ message: "Provide roleId or role (name)" });
      }

      const filter = roleId ? { _id: roleId } : { role: String(role) };
      const doc = await AccessModel.findOne(filter).select("role main updatedAt");
      if (!doc) return res.status(404).json({ message: "Role not found" });

      return res.json(doc);
    } catch (e) {
      console.error("GET /access/main error:", e);
      res.status(500).json({ message: "Server error" });
    }
  })

  // POST /access/main  { roleId?:string, role?:string, main:[{menuName,children:[{submenuName}]}] }
  .post("/main", async (req, res) => {
    try {
      if (!(await assertSuperAdmin(req, res))) return;

      const { roleId, role, main } = req.body || {};
      if (!Array.isArray(main) || main.length === 0) {
        return res.status(400).json({ message: "`main` must be a non-empty array" });
      }
      if (!roleId && !role) {
        return res.status(400).json({ message: "Provide roleId or role (name)" });
      }

      // sanitize: only menuName + children[].submenuName
      const cleanMain = main.map(m => ({
        menuName: String(m?.menuName || "").trim(),
        children: Array.isArray(m?.children)
          ? m.children.map(c => ({ submenuName: String(c?.submenuName || "").trim() }))
          : []
      }));

      const filter = roleId ? { _id: roleId } : { role: String(role) };

      const updated = await AccessModel.findOneAndUpdate(
        filter,
        { $set: { main: cleanMain, updatedAt: new Date() } },
        { new: true }
      ).select("role main updatedAt");

      if (!updated) return res.status(404).json({ message: "Role not found" });

      return res.json({ success: true, message: "Main updated", data: updated });
    } catch (e) {
      console.error("POST /access/main error:", e);
      res.status(500).json({ message: "Server error" });
    }
  })

  // Generic CRUD passthroughs
  .post("/", routes.add)
  .put("/:id", routes.update)
  .delete("/:id", routes.delete);

module.exports = AccessController;
