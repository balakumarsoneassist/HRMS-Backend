// services/holiday-service.js
const crud_service = require("../services/crud-service");
const HolidayRuleModel = require("../models/holiday-rule-model");

class HolidayService extends crud_service {
  constructor() {
    super();
    this.model = HolidayRuleModel;
            this.validateAdd = async (data) => {
            };
            this.validateEdit = async (data, id) => {
            };
            this.validateDelete = async (data) => {
            };
  }

  async isHolidayOn(dateObj) {
    const y = dateObj.getFullYear();
    const m = dateObj.getMonth();
    const d = dateObj.getDate();
    const weekday = dateObj.getDay();
    const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const mmdd = `${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    const rules = await this.model.find({ isEnabled: true }).lean();
    const hits = [];

    for (const r of rules) {
      if (r.date && r.date === iso) { hits.push(r); continue; }
      const rec = r.recurrence;
      if (!rec || !rec.kind) continue;

      if (rec.kind === "weekly") {
        if (rec.weekdays?.includes(weekday)) hits.push(r);
      } else if (rec.kind === "annual-fixed") {
        if (rec.startDate === mmdd) hits.push(r);
      } else if (rec.kind === "nth-weekday-monthly") {
        const months = (rec.months?.length ? rec.months : [0,1,2,3,4,5,6,7,8,9,10,11]);
        if (!months.includes(m)) continue;
        if (!rec.weekdays?.includes(weekday)) continue;
        const nth = this._nthOfMonth(dateObj);
        if (rec.nths?.includes(nth)) hits.push(r);
      }
    }

    return {
      isHoliday: hits.length > 0,
      holidays: hits.map(h => ({
        id: String(h._id || h.id),
        name: h.name,
        color: h.color,
        isGovernment: !!h.isGovernment,
      })),
    };
  }

  async monthOccurrences(year, month) {
    const start = new Date(year, month, 1);
    const end   = new Date(year, month + 1, 0);
    const dates = new Set();

    // prefetch all enabled rules
    const rules = await this.model.find({ isEnabled: true }).lean();

    // iterate each day, collect hits
    for (let d = 1; d <= end.getDate(); d++) {
      const dt = new Date(year, month, d);
      const info = await this.isHolidayOn(dt);
      if (info.isHoliday) dates.add(this._iso(dt));
    }

    return {
      dates: Array.from(dates),
      items: Array.from(dates).map(date => ({ date })) // extend if you want names/colors per day
    };
  }

  async setEnabled(id, isEnabled) {
    return this.model.findByIdAndUpdate(id, { isEnabled }, { new: true });
  }

  async importGovernment(body) {
    const rules = Array.isArray(body?.rules) ? body.rules : [];
    if (!rules.length) return { success: false, message: 'No rules provided' };

    // normalize payload
    const docs = rules.map(r => ({
      name: r.name,
      date: r.date, // 'YYYY-MM-DD'
      color: r.color || '#22d3ee',
      isGovernment: true,
      isEnabled: r.isEnabled !== false
    }));

    const created = await this.model.insertMany(docs, { ordered: false });
    return { success: true, count: created.length, data: created };
  }

  _iso(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  _nthOfMonth(dateObj) {
    const day = dateObj.getDate();
    const weekday = dateObj.getDay();
    const first = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
    const firstW = first.getDay();
    const offset = (weekday - firstW + 7) % 7;
    const firstThisWeekday = 1 + offset;
    return Math.floor((day - firstThisWeekday) / 7) + 1; // 1..5
  }
}

module.exports = HolidayService;
