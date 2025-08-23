
const leavetypeModal_model = require("../models/leaveType-model");
const crud_service = require("./crud-service");
class LeaveTypeService extends crud_service {
    constructor() {
        super(...arguments);
        this.model = leavetypeModal_model;
        this.validateAdd = async (data) => {
        };
        this.validateEdit = async (data, id) => {
        };
        this.validateDelete = async (data) => {
        };
    }
}
module.exports = LeaveTypeService;
