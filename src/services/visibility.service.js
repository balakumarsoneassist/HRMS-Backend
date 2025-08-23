// services/visibility.js
const Access = require('../models/access-model');
const User = require('../models/user-model');

function isRootRole(roleDoc) {
  return Array.isArray(roleDoc?.access)
      && roleDoc.access.length === 1
      && String(roleDoc.access[0]) === String(roleDoc._id);
}

async function getVisibleUserIdsFor(actingUserId) {
  const me = await User.findById(actingUserId)
    .populate({ path: 'role', model: 'access', select: 'access' })
    .lean();
  if (!me || !me.role) return [];

  // Root (Super Admin) sees everyone
  if (isRootRole(me.role)) {
    const all = await User.find({}, '_id').lean();
    return all.map(u => String(u._id));
  }

  const startRoleId = String(me.role._id);

  // Load all roles once; build graph
  const roles = await Access.find({}, '_id access members').lean();
  const childrenByParent = new Map();   // parentRoleId -> child role docs
  for (const r of roles) {
    for (const p of (r.access || []).map(String)) {
      if (!childrenByParent.has(p)) childrenByParent.set(p, []);
      childrenByParent.get(p).push(r);
    }
  }

  // BFS to collect descendants
  const descRoleIds = new Set();
  const q = [startRoleId];
  const seen = new Set(q);
  while (q.length) {
    const pid = q.shift();
    for (const child of (childrenByParent.get(pid) || [])) {
      const cid = String(child._id);
      if (!seen.has(cid)) { seen.add(cid); q.push(cid); }
      descRoleIds.add(cid);
    }
  }

  // Collect members: my role + descendants
  const visible = new Set();
  const myRoleDoc = roles.find(r => String(r._id) === startRoleId);
  (myRoleDoc?.members || []).forEach(uid => visible.add(String(uid)));
  for (const rid of descRoleIds) {
    const rdoc = roles.find(r => String(r._id) === rid);
    (rdoc?.members || []).forEach(uid => visible.add(String(uid)));
  }

  // ALSO include the "owners" (users) of my role + descendant roles
  const ownerRoleIds = [startRoleId, ...Array.from(descRoleIds)];
  const owners = await User.find({ role: { $in: ownerRoleIds } }, '_id').lean();
  owners.forEach(u => visible.add(String(u._id)));

  // include me
  visible.add(String(me._id));

  return Array.from(visible);
}

module.exports = { getVisibleUserIdsFor, isRootRole };
