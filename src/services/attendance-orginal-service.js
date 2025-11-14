
const attendance_orginal_model = require("../models/attendance-model-orginal");
const crud_service = require("./crud-service");
class AttendanceOrginalService extends crud_service {
    constructor() {
        super(...arguments);
        this.model = attendance_orginal_model;
        this.validateAdd = async (data) => {
        };
        this.validateEdit = async (data, id) => {
        };
        this.validateDelete = async (data) => {
        };
    }
}
module.exports = AttendanceOrginalService;
