// services/standardMenu-service.js
const StandardMenu = require("../models/standardMenu-model");

class StandardMenuService {
  async upsertOne(filter, data) {
    return StandardMenu.updateOne(filter, { $set: data }, { upsert: true });
  }

  async getByRole(role) {
    return StandardMenu.findOne({ role });
  }

  async getByRoleId(roleId) {
    return StandardMenu.findOne({ roleId });
  }

  async list() {
    return StandardMenu.find().sort({ role: 1 });
  }
}

module.exports = StandardMenuService;
