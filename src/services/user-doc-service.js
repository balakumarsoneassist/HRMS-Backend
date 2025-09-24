const crud_service = require("./crud-service");
const userDocModel = require("../models/user-doc-model");
const path = require("path");

class UserDocService extends crud_service {
  constructor() {
    super(...arguments);
    this.model = userDocModel;

    this.validateAdd = async (data) => {};
    this.validateEdit = async (data, id) => {};
    this.validateDelete = async (data) => {};
  }

  /**
   * Processes req.files and req.body from multer
   * and maps them into structured payload
   */
  async handleMulterUploads(req) {
    const payload = {
      user_id: req.body.user_id,
      prev: [],
      pg: [],
      ug: []
    };

    // Helper: convert file object → relative path
    const normalizePath = (file) =>
      file.path.replace(/.*public/, "").replace(/\\/g, "/");

    // ---- Parse all uploaded files
    for (const file of req.files) {
      const relativePath = normalizePath(file);

      // --- PG: e.g. pg[0][certificate] or pg[0][marksheet]
      if (file.fieldname.startsWith("pg[")) {
        const match = file.fieldname.match(/pg\[(\d+)\]\[(\w+)\]/);
        if (match) {
          const index = parseInt(match[1], 10);
          const key = match[2];
          if (!payload.pg[index]) payload.pg[index] = {};
          payload.pg[index][key] = relativePath;
        }
      }

      // --- UG: e.g. ug[0][certificate] or ug[0][marksheet]
      else if (file.fieldname.startsWith("ug[")) {
        const match = file.fieldname.match(/ug\[(\d+)\]\[(\w+)\]/);
        if (match) {
          const index = parseInt(match[1], 10);
          const key = match[2];
          if (!payload.ug[index]) payload.ug[index] = {};
          payload.ug[index][key] = relativePath;
        }
      }

      // --- Previous Companies: prev[0][relieving], prev[0][payslips]
      else if (file.fieldname.startsWith("prev[")) {
        const match = file.fieldname.match(/prev\[(\d+)\]\[(\w+)\]/);
        if (match) {
          const index = parseInt(match[1], 10);
          const key = match[2];
          if (!payload.prev[index]) payload.prev[index] = { payslips: [] };

          if (key === "payslips") {
            payload.prev[index].payslips.push(relativePath);
          } else {
            payload.prev[index][key] = relativePath;
          }
        }
      }

      // --- Single files: photo, aadhar_front, pan_front, etc.
      else {
        payload[file.fieldname] = relativePath;
      }
    }

    // ---- Map company names from req.body (text fields)
    const bodyKeys = Object.keys(req.body);
    const prevIndexes = [
      ...new Set(
        bodyKeys
          .map((k) => k.match(/^prev\[(\d+)\]\[companyName\]$/)?.[1])
          .filter((i) => i !== undefined)
      ),
    ];
    prevIndexes.forEach((i) => {
      if (!payload.prev[i]) payload.prev[i] = { payslips: [] };
      payload.prev[i].companyName = req.body[`prev[${i}][companyName]`];
    });

    return payload;
  }
}

module.exports = UserDocService;
