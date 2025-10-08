const express = require("express");
const DeletedUserService = require("../services/deleted-user-service");
const routesUtil = require("../utils/routes");

const DeletedUserController = express.Router();
let routes = new routesUtil(DeletedUserService);

DeletedUserController.get("/", routes.list)
  .get("/:id", routes.retrieve);

module.exports = DeletedUserController;
