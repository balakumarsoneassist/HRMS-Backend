
const tax_model = require("../models/deleted-user-model");
const crud_service = require("./crud-service");
class DeletedUserService extends crud_service {
    constructor() {
        super(...arguments);
        this.model = tax_model;
        this.validateAdd = async (data) => {
        };
        this.validateEdit = async (data, id) => {
        };
        this.validateDelete = async (data) => {
        };
    }
}
module.exports = DeletedUserService;
