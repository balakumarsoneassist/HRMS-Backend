const express = require("express");
const payload_service = require("../services/payload-service");
const routesUtil = require("../utils/routes");

const PayloadController = express.Router();
let routes = new routesUtil(payload_service);

PayloadController.get('/', routes.list)
    .get('/:id', routes.retrieve)
    .post('/', routes.add)
    .put('/:id', routes.update)
    .delete('/:id', routes.delete);

module.exports = PayloadController;
