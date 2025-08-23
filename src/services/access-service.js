// services/access-service.js
const access_model = require("../models/access-model");
const user_Model = require("../models/user-model");
const crud_service = require("./crud-service");

class AccessService extends crud_service {
  constructor() {
    super(...arguments);
    this.model = access_model;
  }
    roleretrieve = async (req) => {
    const data = await this.list(req.query);
    return (data || [])
      .filter((item) => item.role !== "Super Admin")
      .map((item) => ({ _id: item._id, role: item.role }));
  };
  
  // ----- helpers -----
  #isRootRole(roleDoc) {
    return Array.isArray(roleDoc?.access)
      && roleDoc.access.length === 1
      && String(roleDoc.access[0]) === String(roleDoc._id);
  }

  async #visibleUserIdsFor(viewerId) {
    if (!viewerId) return null; // no filtering

    const me = await user_Model
      .findById(viewerId)
      .populate({ path: "role", model: "access", select: "role access" })
      .lean();
    if (!me || !me.role) return [];

    // Root (Super Admin) sees all
    if (this.#isRootRole(me.role)) {
      const all = await user_Model.find({}, "_id").lean();
      return all.map(u => String(u._id));
    }

    // Start with members directly under my role
    const myRole = await access_model.findById(me.role._id).select("members").lean();
    const visible = new Set((myRole?.members || []).map(id => String(id)));

    // Include members of descendant roles
    const q = [String(me.role._id)];
    const seen = new Set(q);
    while (q.length) {
      const pid = q.shift();
      const children = await access_model.find({ access: pid }, "_id members").lean();
      for (const c of children) {
        const cid = String(c._id);
        if (!seen.has(cid)) { seen.add(cid); q.push(cid); }
        (c.members || []).forEach(uid => visible.add(String(uid)));
      }
    }
    return Array.from(visible);
  }

  // Build PrimeNG-style nodes on the server
  getHierarchyNodes = async (viewerId = null) => {
    const roles = await access_model.find({}, "_id role access members").lean();
    const roleById = new Map(roles.map(r => [String(r._id), r]));
    const rootRoleIds = new Set(
      roles.filter(r => this.#isRootRole(r)).map(r => String(r._id))
    );

    // membership map: userId -> [parentRoleIds]
    const parentRolesByMember = new Map();
    for (const r of roles) {
      for (const uid of (r.members || [])) {
        const key = String(uid);
        const arr = parentRolesByMember.get(key) || [];
        arr.push(String(r._id));
        parentRolesByMember.set(key, arr);
      }
    }

    const visibleIds = await this.#visibleUserIdsFor(viewerId);

    // Fetch users (optionally scoped)
    const users = await user_Model
      .find(visibleIds ? { _id: { $in: visibleIds } } : {})
      .select("_id user_name role")
      .populate({ path: "role", model: "access", select: "role access" })
      .lean();

    // Group by roleId
    const usersByRoleId = new Map();
    for (const u of users) {
      if (!u.role) continue;
      const rid = String(u.role._id);
      const arr = usersByRoleId.get(rid) || [];
      arr.push(u);
      usersByRoleId.set(rid, arr);
    }

    // Build node per user
    const nodeByUserId = new Map();
    for (const u of users) {
      if (!u.role) continue;
      nodeByUserId.set(String(u._id), {
        label: `${u.role.role} (${u.user_name})`,
        data: {
          userId: String(u._id),
          roleId: String(u.role._id),
          name: u.user_name,
          rolename: u.role.role,
          // effective access for client-side checks if needed
          access: Array.from(new Set([
            ...(u.role.access || []).map(String),
            // include parent roles from membership (Option B)
            ...(parentRolesByMember.get(String(u._id)) || [])
          ]))
        },
        expanded: true,
        children: [],
        draggable: true,
        droppable: true
      });
    }

    // choose parent for a user
    const chooseParentNode = (u) => {
      const uid = String(u._id);
      const uRoleId = String(u.role._id);

      // Employees: first prefer explicit membership parents
      const memberParents = parentRolesByMember.get(uid) || [];
      const candidateRoleIds = memberParents.length
        ? memberParents
        : (u.role.access || []).map(String).filter(rid => rid !== uRoleId);

      if (!candidateRoleIds.length) return null;

      // Map roleId -> users who own that role
      const candidates = [];
      for (const rid of candidateRoleIds) {
        const owners = usersByRoleId.get(rid) || [];
        for (const p of owners) if (String(p._id) !== uid) candidates.push(p);
      }
      if (!candidates.length) return null;

      // Prefer non-root parents, then root; stable by name then id
      const nonRoot = candidates.filter(c => !rootRoleIds.has(String(c.role._id)));
      const roots = candidates.filter(c => rootRoleIds.has(String(c.role._id)));
      const sortUsers = (arr) => arr.sort(
        (a,b) => a.user_name.localeCompare(b.user_name) || String(a._id).localeCompare(String(b._id))
      );
      sortUsers(nonRoot); sortUsers(roots);
      const chosen = nonRoot[0] || roots[0] || null;
      return chosen ? nodeByUserId.get(String(chosen._id)) : null;
    };

    const roots = [];
    const assigned = new Set();

    // Attach non-root users
    for (const u of users) {
      if (!u.role) continue;
      const isRoot = rootRoleIds.has(String(u.role._id));
      if (isRoot) continue;

      const parentNode = chooseParentNode(u);
      const childNode = nodeByUserId.get(String(u._id));
      if (parentNode && childNode) {
        parentNode.children.push(childNode);
        assigned.add(String(u._id));
      }
    }

    // Push root users
    for (const u of users) {
      if (u.role && rootRoleIds.has(String(u.role._id))) {
        const node = nodeByUserId.get(String(u._id));
        if (node) roots.push(node);
      }
    }

    // Orphan fallback: attach to any root that appears in their access
    for (const u of users) {
      const id = String(u._id);
      if (!u.role || assigned.has(id) || rootRoleIds.has(String(u.role._id))) continue;
      const node = nodeByUserId.get(id);
      const acc = new Set((u.role.access || []).map(String));
      const rootOwner = users.find(x => x.role && rootRoleIds.has(String(x.role._id)) && acc.has(String(x.role._id)));
      if (rootOwner) {
        nodeByUserId.get(String(rootOwner._id)).children.push(node);
      } else {
        roots.push(node); // last resort
      }
    }

    // Both orgData & treeData share the same structure in your UI
    return { orgData: roots, treeData: JSON.parse(JSON.stringify(roots)) };
  };
}

module.exports = AccessService;
