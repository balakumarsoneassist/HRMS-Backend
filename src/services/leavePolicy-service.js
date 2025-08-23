const LeavePolicy = require("../models/leave-policy-model");

class LeavePolicyService {
  async listActive(appliesToRole /* string | undefined */) {
    const filter = { active: true };
    if (appliesToRole) {
      filter.$or = [{ appliesTo: { $size: 0 } }, { role: appliesToRole }];
    }
    return LeavePolicy.find(filter).lean();
  }
}
module.exports = LeavePolicyService;
