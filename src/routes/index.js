const express = require("express");
const user_service = require("../services/user-service");
const handle_error = require("../utils/handle-error");
const master_router = require("./master-router");
const path = require("path");

const userCheck = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader.split(" ")[1];
    if (!token) {
      throw new Error("Unauthorized Access");
    }
    let service = new user_service();
    let decrypted = await service.checkValidUser(token);
    req.body.createdby = decrypted.id;
    next();
  } catch (error) {
    res.status(401).send(error.message);
  }
};
const routes = express.Router();
routes.use("/api", master_router)
.use("/uploads", express.static(path.join(process.cwd(), "uploads")))
.post("/login", async (req, res) => {
  try {
    let service = new user_service();
    const input = req.body.mobileNo?.trim() || "";

    if (/^\d{10}$/.test(input)) {
      // Case 1: 10-digit Mobile Number
      return res.json(await service.login(input, req.body.password));

    } else if (/^(OAID|OA)/i.test(input)) {
      // Case 2: Employee ID (starts with OA or OAID)
      return res.json(await service.loginEmpID(input.toUpperCase(), req.body.password));

    } else {
      // Invalid format
      return res.status(400).json({
        success: false,
        message: "Invalid login identifier. Enter a 10-digit mobile number or a valid OA employee ID."
      });
    }
  } catch (error) {
    handle_error(error, res);
  }
});

module.exports = routes;
