
const crud_service = require("./crud-service");
const buyerlog_model = require("../models/buyerlog-model");
 class logService extends crud_service {
     constructor() {
         super(...arguments);
         this.model = buyerlog_model;
         this.validateAdd = async (data) => {
         };
         this.validateEdit = async (data, id) => {
         };
         this.validateDelete = async (data) => {
         };
     }
}

module.exports = logService;


