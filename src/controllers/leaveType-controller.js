
const express = require("express");
const leavetype_service = require("../services/leaveType-service");
const routesUtil = require("../utils/routes");
const LeavetypeController = express.Router();
let routes = new routesUtil(leavetype_service);
LeavetypeController.get('/', routes.list)
    .get('/:id', routes.retrievebyUserid)
    .post('/', routes.add)
    .put('/:id', routes.update)
    .delete('/:id', routes.delete);
module.exports = LeavetypeController;
