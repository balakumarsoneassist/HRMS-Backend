const express = require("express");
const router = express.Router();
const LeavePolicy = require("../models/leave-policy-model");
const UserService = require("../services/user-service");
const userService = new UserService();

const SUPER_ADMIN_ROLE_ID = "6884cc051725e1465c06c2af"; // your seeded SA role id

async function assertSuperAdmin(req, res) {
  const auth = req.headers.authorization;
  if (!auth) { res.status(401).json({ message: "Authorization token is required" }); return false; }
  try {
    const token = auth.split(" ")[1];
    const decoded = await userService.checkValidUser(token);
    const roleId = String(decoded?.roleId || "");
    const roleName = String(decoded?.roleName || "");
    const ok = roleId === SUPER_ADMIN_ROLE_ID || roleName.toLowerCase() === "super admin";
    if (!ok) { res.status(403).json({ message: "Only Super Admin can perform this action" }); return false; }
    return true;
  } catch {
    res.status(401).json({ message: "Invalid/expired token" });
    return false;
  }
}

// GET /api/leave-policies?role=Employee
router.get("/", async (req, res) => {
  try {
    if (!(await assertSuperAdmin(req, res))) return;
    const { role } = req.query;
    const filter = role ? { role } : {};
    const items = await LeavePolicy.find(filter).sort({ role: 1, label: 1 }).lean();
    res.json(items);
  } catch (e) {
    console.error("GET /leave-policies error:", e);
    res.status(500).json({ message: "Server error" });
  }
});
// GET /api/leave-policies/roles  -> distinct role names from policies
router.get("/role", async (req, res) => {
  try {
    if (!(await assertSuperAdmin(req, res))) return;
    const roles = await LeavePolicy.distinct("role");
    res.json(roles.sort());
  } catch (e) {
    console.error("GET /leave-policies/roles error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/roles", async (req, res) => {
  try {
    // if (!(await assertSuperAdmin(req, res))) return;
    const roles = await LeavePolicy.distinct("role");
    res.json(roles.sort());
  } catch (e) {
    console.error("GET /leave-policies/roles error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/leave-policies/:id -> remove one policy
router.delete("/:id", async (req, res) => {
  try {
    if (!(await assertSuperAdmin(req, res))) return;
    const { id } = req.params;
    const out = await LeavePolicy.findByIdAndDelete(id);
    if (!out) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (e) {
    console.error("DELETE /leave-policies/:id error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/leave-policies
// Body: { role, label, amount, accrualType, active }
router.post("/", async (req, res) => {
  try {
    if (!(await assertSuperAdmin(req, res))) return;
    const { role, label, amount, accrualType, active } = req.body || {};
    if (!role || !label || amount == null || !accrualType) {
      return res.status(400).json({ message: "role, label, amount, accrualType are required" });
    }
    const doc = await LeavePolicy.create({ role, label, amount, accrualType, active: active !== false });
    res.json({ success: true, data: doc });
  } catch (e) {
    if (e?.code === 11000) return res.status(409).json({ message: "Policy already exists for this role/label" });
    console.error("POST /leave-policies error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/leave-policies/:id
// Body: { amount?, accrualType?, active?, role?, label? }
router.put("/:id", async (req, res) => {
  try {
    if (!(await assertSuperAdmin(req, res))) return;
    const { id } = req.params;
    const { amount, accrualType, active, role, label } = req.body || {};
    const update = {};
    if (role) update.role = role;
    if (label) update.label = label;
    if (amount != null) update.amount = amount;
    if (accrualType) update.accrualType = accrualType;
    if (typeof active === "boolean") update.active = active;

    const doc = await LeavePolicy.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json({ success: true, data: doc });
  } catch (e) {
    if (e?.code === 11000) return res.status(409).json({ message: "Policy with this role/label already exists" });
    console.error("PUT /leave-policies/:id error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;