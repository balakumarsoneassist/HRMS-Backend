
const express = require("express");
const log_service = require("../services/log-service");
const routesUtil = require("../utils/routes");
const logController = express.Router();
let routes = new routesUtil(log_service);

logController.get('/', routes.list)
             .get('/:id', routes.retrieve)
             .post('/', routes.add)
             .put('/:id', routes.update)
             .delete('/:id', routes.delete)

    
module.exports = logController;




