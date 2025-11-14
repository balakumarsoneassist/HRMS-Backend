class CrudService {
  constructor() {
    this.preAdd = async (data) => {
      return data;
    };
    this.preEdit = async (data, filter) => {
      return data;
    };
  }
  async list(filter) {
    try {
      let result = await this.model.find(filter);
      return result;
    } catch (error) {
      throw error;
    }
  }

  async listForTable(query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;

    const filters = {};
    for (let key in query) {
  if (query[key] && key !== "page" && key !== "limit") {
    const path = this.model?.schema?.path(key);
    if (path?.instance === 'String') {
      filters[key] = { $regex: new RegExp(String(query[key]), 'i') };
    } else {
      filters[key] = query[key]; // exact match for non-string
    }
  }
}

    const data = await this.model
      .find(filters)
      .skip(skip)
      .limit(limit)
      .populate("userId");
    const total = await this.model.countDocuments(filters);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async listForTableleave(query, options = {}) {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 10;
  const skip = (page - 1) * limit;

  // ✅ Extract known Mongo filter keys if present
  const filters = {};
  for (let key in query) {
    if (key === "page" || key === "limit") continue;

    // If the value is an object (e.g., { $in: [...] } or { $lte: ... })
    if (typeof query[key] === "object" && !Array.isArray(query[key])) {
      filters[key] = query[key];
    }
    // If it's a string filter
    else {
      const path = this.model?.schema?.path(key);
      if (path?.instance === "String") {
        filters[key] = { $regex: new RegExp(String(query[key]), "i") };
      } else {
        filters[key] = query[key];
      }
    }
  }

  const data = await this.model
    .find(filters)
    .sort(options.sort || { _id: -1 })
    .skip(skip)
    .limit(limit)
    .populate("userId");

  const total = await this.model.countDocuments(filters);

  return { data, total, page, limit };
}


async accesslistForTable(req, visibleUserIds = []) {
  try {
    const q = req.query || {};

    // --- pagination ---
    const page  = Math.max(parseInt(q.page)  || 1, 1);
    const limit = Math.min(Math.max(parseInt(q.limit) || 10, 1), 100);
    const skip  = (page - 1) * limit;

    // --- base visibility filter (IMPORTANT) ---
    const filters = {};
    if (Array.isArray(visibleUserIds)) {
      if (visibleUserIds.length === 0) {
        return { data: [], total: 0, page, limit };
      }
      filters._id = { $in: visibleUserIds };
    }

    // --- dynamic field filters (safe regex) ---
    const esc = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx  = (v) => ({ $regex: new RegExp(esc(v), 'i') });

    const allow = ['user_name', 'email', 'mobile_no', 'empId', 'position', 'status'];
    for (const key of allow) {
      const val = q[key];
      if (val === undefined || val === '') continue;

      if (key === 'status') {
        // support 'true'/'false' or boolean
        filters.status = (val === true || val === 'true');
      } else {
        filters[key] = rx(val);
      }
    }

    // --- optional global search ---
    if (q.search) {
      const r = rx(q.search).$regex;
      filters.$or = [
        { user_name: r },
        { email: r },
        { mobile_no: r },
        { empId: r },
        { position: r }
      ];
    }

    // --- sorting ---
    const sortField = q.sort || 'user_name';
    const sortOrder = q.order === 'desc' ? -1 : 1;

    const [data, total] = await Promise.all([
      this.model
        .find(filters)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'role', select: 'role' })
        .lean(),
      this.model.countDocuments(filters),
    ]);

    return { data, total, page, limit };
  } catch (error) {
    throw error;
  }
}


  async listDynamically(filter) {
    try {
      const pathsToPopulate = Object.entries(this.model.schema.paths)
        .filter(([_, schemaType]) => {
          if (schemaType.options) {
            if (schemaType.options.ref) return true;
            if (
              schemaType.instance === "Array" &&
              schemaType.caster &&
              schemaType.caster.options &&
              schemaType.caster.options.ref
            ) {
              return true;
            }
          }
          return false;
        })
        .map(([path]) => path);

      const result = await this.model
        .find(filter)
        .populate(pathsToPopulate.join(" "));
      return result;
    } catch (error) {
      throw error;
    }
  }
  async listproduct(filter) {
    try {
      let result = await this.model.find(filter);
      return result;
    } catch (error) {
      throw error;
    }
  }
  async listpopulate(filter) {
    try {
      return await this.model.findOne(filter).populate("product");
    } catch (error) {
      throw error;
    }
  }
  async listpopulate(filter) {
    try {
      return await this.model.findOne(filter).populate("template");
    } catch (error) {
      throw error;
    }
  }
  async liststarpopulate(filter) {
    try {
      return await this.model
        .find(filter)
        .populate("product_id")
        .populate("buyer_address_id");
    } catch (error) {
      throw error;
    }
  }
  async add(data) {
    try {
      await this.validateAdd(data);
      let fData = await this.preAdd(data);
      let result = await this.model.create(fData);
      await this.callBackAdd(result);
      return { success: true, data: result, message: "Successfully Saved" };
    } catch (error) {
      console.log(error);

      throw error;
    }
  }

   async addMany(data) {
    try {
      await this.validateAdd(data);
      let fData = await this.preAdd(data);
      let result = await this.model.insertMany(fData);
      await this.callBackAdd(result);
      return { success: true, data: result, message: "Successfully Saved" };
    } catch (error) {
      console.log(error);

      throw error;
    }
  }

 async aggregationPipeline(pipeline) {
  try {
    return await this.model.aggregate(pipeline);
  } catch (error) {
    throw error;
  }
}

  a
  
  async add1(data) {
    try {
      await this.validateAdd(data);
      let fData = await this.preAdd(data);
      let result = await this.model2.create(fData);
      await this.callBackAdd(result);
      return { success: true, data: result, message: "Successfully Saved" };
    } catch (error) {
      throw error;
    }
  }
  async add2(data) {
    try {
      await this.validateAdd(data);
      let fData = await this.preAdd(data);
      let result = await this.model3.create(fData);
      await this.callBackAdd(result);
      return { success: true, data: result, message: "Successfully Saved" };
    } catch (error) {
      throw error;
    }
  }

  async addinventory(data) {
    try {
      await this.validateAdd(data);
      let fData = await this.preAdd(data);
      let result = await this.inventory_model.create(fData);
      await this.callBackAdd(result);
      return { success: true, data: result, message: "Successfully Saved" };
    } catch (error) {
      throw error;
    }
  }

  async add2(data) {
    try {
      await this.validateAdd(data);
      let fData = await this.preAdd(data);
      let result = await this.model1.create(fData);
      await this.callBackAdd(result);
      return { success: true, data: result, message: "Successfully Saved" };
    } catch (error) {
      throw error;
    }
  }

  async update(data, filter) {
    try {
      await this.validateEdit(data, filter);
      let fData = await this.preEdit(data, filter);
      let old = await this.model.findOneAndUpdate(filter, fData);
      let result = await this.retrieve(filter);
      await this.callBackEdit(result);
      return {
        success: true,
        old: old,
        data: result,
        message: "Successfully Updated",
      };
    } catch (error) {
      throw error;
    }
  }

   async updateMany(filter, data) {
    try {
      await this.validateEdit(data, filter);
      let fData = await this.preEdit(data, filter);
      let old = await this.model.updateMany(filter, fData);
      let result = await this.retrieve(filter);
      await this.callBackEdit(result);
      return {
        success: true,
        old: old,
        data: result,
        message: "Successfully Updated",
      };
    } catch (error) {
      throw error;
    }
  }
  async delete(filter) {
    try {
      let data = await this.retrieve(filter);
      await this.validateDelete(data);
      let result = await this.model.findOneAndDelete(filter);
      await this.callBackDelete(result);
      return { success: true, data: result, message: "Successfully Deleted" };
    } catch (error) {
      throw error;
    }
  }
  async updateById(data, id) {
    try {
      return await this.update(data, { _id: id });
    } catch (error) {
      throw error;
    }
  }
  async deleteById(id) {
    try {
      return await this.delete({ _id: id });
    } catch (error) {
      throw error;
    }
  }
  async retrieve(filter) {
    try {
      let result = await this.model.findOne(filter);
      let res = await this.callBackRetrieve(result);
      return res;
    } catch (error) {
      throw error;
    }
  }

  async retrieveAll(filter) {
    try {
      let result = await this.model.find(filter);
      let res = await this.callBackRetrieve(result);
      return res;
    } catch (error) {
      throw error;
    }
  }

  async retrieveAllpopulateRole(filter) {
    try {
      let result = await this.model.find(filter).populate({
        path: "userId",
        populate: {
          path: "role", // Field in User schema that references Role collection
          model: "access", // The Role model name
        },
      });
      let res = await this.callBackRetrieve(result);
      return res;
    } catch (error) {
      throw error;
    }
  }

  async retrieve1(filter) {
    try {
      let result = await this.model2.findOne(filter);
      let res = await this.callBackRetrieve(result);
      return res;
    } catch (error) {
      throw error;
    }
  }

  async retrieveprice(filter) {
    try {
      let result = await this.model.find(filter);
      let res = await this.callBackRetrieve(result);
      return res;
    } catch (error) {
      throw error;
    }
  }
  async clientretrieve(filter) {
    try {
      let result = await this.model1.findOne(filter);
      let res = await this.callBackRetrieve(result);
      return res;
    } catch (error) {
      throw error;
    }
  }
  async clientretrieve(filter) {
    try {
      let result = await this.model2.findOne(filter);
      let res = await this.callBackRetrieve(result);
      return res;
    } catch (error) {
      throw error;
    }
  }
  async retrieveById(id) {
    try {
      return await this.retrieve({ _id: id });
    } catch (error) {
      throw error;
    }
  }
  async retrievebyUserid(id) {
    try {
      return await this.retrieveAll({ userId: id });
    } catch (error) {
      throw error;
    }
  }

async listForTableWithRole(filters = {}, sort = { date: -1 }, query = {}, accessId = null) {
  try {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;

    // Merge dynamic query filters
    for (let key in query) {
      if (query[key] && !["page", "limit"].includes(key)) {
        filters[key] = { $regex: query[key], $options: "i" };
      }
    }

    // Fetch data with nested populate and dynamic access filter
    let data = await this.model
      .find(filters)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate({
        path: "userId",
        populate: {
          path: "role",
          model: "access",
          match: accessId ? { access: { $in: [accessId] } } : {}, // ✅ Filter here
        },
      });

    // Remove records where role filter failed (null values)
    data = data.filter(item => item.userId && item.userId.role);

    const total = data.length;

    return {
      data,
      total,
      page,
      limit,
    };
  } catch (error) {
    throw error;
  }
}



  async callBackEdit(data) {}
  async callBackAdd(data) {}
  async callBackDelete(data) {}
  async callBackRetrieve(data) {
    return data;
  }
}
module.exports = CrudService;
