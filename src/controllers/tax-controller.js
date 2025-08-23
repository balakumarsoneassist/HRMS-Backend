
const express = require("express");
const tax_service = require("../services/tax-service");
const routesUtil = require("../utils/routes");
const TaxController = express.Router();
let routes = new routesUtil(tax_service);
TaxController.get('/', routes.list)
    .get('/:id', routes.retrieve)
    .post('/', routes.add)
    .put('/:id', routes.update)
    .delete('/:id', routes.delete);
module.exports = TaxController;
