const handle_error = require("./handle-error");
class RoutesUtil {
  constructor(service) {
    this.listForTable = async (req, res) => {
      try {
        let service = new this.service();
        res.json(await service.listForTable(req.query));
      } catch (error) {
        handle_error(error, res);
      }
    };
    this.list = async (req, res) => {
      try {
        let service = new this.service();
        res.json(await service.list(req.query));
      } catch (error) {
        handle_error(error, res);
      }
    };
    this.listDynamically = async (req, res) => {
      try {
        let service = new this.service();
        res.json(await service.listDynamically(req.query));
      } catch (error) {
        handle_error(error, res);
      }
    };
    this.find = async (req, res) => {
      try {
        let service = new this.service();
        res.json(await service.listproduct(req.query));
      } catch (error) {
        handle_error(error, res);
      }
    };

    this.listreview = async (req, res) => {
      try {
        let service = new this.service();
        let result = await service.list(req.query);
        if (result.length != 0) {
          var results = {
            result: result,
            status: "success",
          };
        } else {
          var results = {
            result: result,
            status: "failed",
          };
        }
        res.json(results);
      } catch (error) {
        handle_error(error, res);
      }
    };
    this.retrieve = async (req, res) => {
      try {
        let service = new this.service();
        res.json(await service.retrieveById(req.params.id));
      } catch (error) {
        handle_error(error, res);
      }
    };
      this.retrievebyUserid = async (req, res) => {
      try {
        let service = new this.service();
        res.json(await service.retrievebyUserid(req.params.id));
      } catch (error) {
        handle_error(error, res);
      }
    };
    this.add = async (req, res) => {
      try {
        let service = new this.service();

        res.json(await service.add(req.body));
      } catch (error) {
        handle_error(error, res);
      }
    };
    this.add1 = async (req, res) => {
      try {
        let service = new this.service();
        res.json(await service.add(req.body));
      } catch (error) {
        handle_error(error, res);
      }
    };
    this.update = async (req, res) => {
      try {
        let service = new this.service();
        res.json(await service.updateById(req.body, req.params.id));
      } catch (error) {
        handle_error(error, res);
      }
    };
    this.delete = async (req, res) => {
      try {
        let service = new this.service();
        res.json(await service.deleteById(req.params.id));
      } catch (error) {
        handle_error(error, res);
      }
    };
    this.service = service;
  }
}
module.exports = RoutesUtil;
