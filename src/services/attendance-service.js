
const attendance_model = require("../models/attendance-model");
const crud_service = require("./crud-service");
class AttendanceService extends crud_service {
    constructor() {
        super(...arguments);
        this.model = attendance_model;
        this.validateAdd = async (data) => {
        };
        this.validateEdit = async (data, id) => {
        };
        this.validateDelete = async (data) => {
        };
    }
}
module.exports = AttendanceService;
