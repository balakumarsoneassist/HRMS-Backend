
const handle_error = require("./handle-error");
class Routes {
    constructor(service) {
        this.list = async (req, res) => {
            try {
                let service = new this.service();
                res.json(await service.list(req.query));
            }
            catch (error) {
                handle_error(error, res);
            }
        };
        this.retrieve = async (req, res) => {
            try {
                let service = new this.service();
                res.json(await service.retrieveById(req.params.id));
            }
            catch (error) {
                handle_error(error, res);
            }
        };
        this.add = async (req, res) => {
            try {
                let service = new this.service();
                res.json(await service.add(req.body));
            }
            catch (error) {
                handle_error(error, res);
            }
        };
        this.update = async (req, res) => {
            try {
                let service = new this.service();
                res.json(await service.updateById(req.body, req.params.id));
            }
            catch (error) {
                handle_error(error, res);
            }
        };
        this.delete = async (req, res) => {
            try {
                let service = new this.service();
                res.json(await service.deleteById(req.params.id));
            }
            catch (error) {
                handle_error(error, res);
            }
        };
        this.service = service;
    }
}
module.exports = Routes;
