const express = require('express');
const HolidayService = require('../services/holiday-service');
const RoutesUtil = require('../utils/routes');
const handle_error = require('../utils/handle-error'); // you already have this

const HolidaysController = express.Router();
const routes = new RoutesUtil(HolidayService);

/**
 * Base CRUD for holiday rules
 * GET    /api/holidays/rules
 * GET    /api/holidays/rules/:id
 * POST   /api/holidays/rules
 * PUT    /api/holidays/rules/:id
 * DELETE /api/holidays/rules/:id
 */
HolidaysController
  .get('/rules', routes.list)
  .get('/rules/:id', routes.retrieve)
  .post('/rules', routes.add)
  .put('/rules/:id', routes.update)
  .delete('/rules/:id', routes.delete);

// Single-day holiday check
// GET /api/holidays/is-holiday?date=YYYY-MM-DD
HolidaysController.get('/is-holiday', async (req, res) => {
  try {
    const { date } = req.query; // expected: 'YYYY-MM-DD'

    if (!date || typeof date !== 'string') {
      return res.status(400).json({ message: "Query param 'date' is required as 'YYYY-MM-DD'." });
    }

    // normalize to midnight local (adjust to your TZ needs if required)
    const dt = new Date(`${date}T00:00:00`);
    if (isNaN(dt.getTime())) {
      return res.status(400).json({ message: "Invalid date format. Use 'YYYY-MM-DD'." });
    }

    const svc = new HolidayService();
    const result = await svc.isHolidayOn(dt);

    // include the date echoed back for convenience
    return res.json({
      date,
      ...result, // { isHoliday: boolean, holidays: [{ id, name, color, isGovernment }] }
    });
  } catch (err) {
    handle_error(err, res);
  }
});


  HolidaysController.patch('/rules/:id/enabled', async (req, res) => {
  try {
    const { id } = req.params;
    const { isEnabled } = req.body; // boolean
    const svc = new HolidayService();
    const updated = await svc.setEnabled(id, isEnabled);
    res.json({ success: true, data: updated });
  } catch (err) {
    handle_error(err, res);
  }
});
/**
 * Expand rules → concrete dates for a specific month.
 * GET /api/holidays/occurrences?year=2025&month=7   // month: 0..11
 */
HolidaysController.get('/occurrences', async (req, res) => {
  try {
    const svc = new HolidayService();
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    if (Number.isNaN(year) || Number.isNaN(month)) {
      return res.status(400).json({ message: 'year and month are required (month 0..11)' });
    }
    const data = await svc.monthOccurrences(year, month, req.query);
    res.json(data);
  } catch (err) {
    handle_error(err, res);
  }
});

/**
 * Bulk import of government holidays (already resolved dates).
 * POST /api/holidays/import-government
 * body: { rules: [{ name, date:'YYYY-MM-DD', color?, isGovernment:true }], overwrite?: boolean }
 */
HolidaysController.post('/import-government', async (req, res) => {
  try {
    const svc = new HolidayService();
    const out = await svc.importGovernment(req.body);
    res.json(out);
  } catch (err) {
    handle_error(err, res);
  }
});

module.exports = HolidaysController;
