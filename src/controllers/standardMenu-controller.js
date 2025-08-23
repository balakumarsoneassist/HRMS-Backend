// controllers/standardMenu-controller.js
const express = require("express");
const StandardMenuService = require("../services/standardMenu-service");

const router = express.Router();
const svc = new StandardMenuService();

// GET /standardmenu?role=Admin  OR  /standardmenu?roleId=6884...
router.get("/", async (req, res) => {
  try {
    const { role, roleId } = req.query;
    if (!role && !roleId) {
      return res.status(400).json({ message: "Provide role or roleId" });
    }

    const doc = roleId ? await svc.getByRoleId(roleId) : await svc.getByRole(role);
    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET /standardmenu/all  -> list every role's standard menu
router.get("/all", async (_req, res) => {
  try {
    const list = await svc.list();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// POST /standardmenu  -> upsert by roleId (admin-only in real apps)
router.post("/", async (req, res) => {
  try {
    const { roleId, role, main } = req.body;
    if (!roleId || !role) return res.status(400).json({ message: "roleId and role are required" });

    await svc.upsertOne({ roleId }, { roleId, role, main: Array.isArray(main) ? main : [] });
    const saved = await svc.getByRoleId(roleId);
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// PUT /standardmenu/:roleId -> update menu for a roleId
router.put("/:roleId", async (req, res) => {
  try {
    const { roleId } = req.params;
    const { role, main } = req.body;
    await svc.upsertOne({ roleId }, { roleId, role, main: Array.isArray(main) ? main : [] });
    const updated = await svc.getByRoleId(roleId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// DELETE /standardmenu/:roleId
router.delete("/:roleId", async (req, res) => {
  try {
    const StandardMenu = require("../models/standardMenu-model");
    const { roleId } = req.params;
    await StandardMenu.deleteOne({ roleId });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
