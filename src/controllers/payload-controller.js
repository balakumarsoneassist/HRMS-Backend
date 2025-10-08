const express = require("express");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const payload_service = require("../services/payload-service");
const routesUtil = require("../utils/routes");
const UserAttendanceReportService = require("../services/user-attendance-report-service");
const HolidayService = require("../services/holiday-service");

const PayloadController = express.Router();
let routes = new routesUtil(payload_service);

const attendanceService = new UserAttendanceReportService();
const holidayService = new HolidayService();

/* ------------------- CRUD ------------------- */
PayloadController.get("/", routes.list)
  .get("/:id", routes.retrieve)
  .post("/", routes.add)
  .put("/:id", routes.update)
  .delete("/:id", routes.delete);

/* ------------------- Helpers ------------------- */
function toISO(d) {
  if (!(d instanceof Date) || isNaN(d)) return null;
  return d.toISOString().split("T")[0];
}

function nthWeekdayOfMonth(year, month, weekday, nth) {
  const first = new Date(year, month, 1);
  const firstW = first.getDay();
  const offset = (weekday - firstW + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  const dim = new Date(year, month + 1, 0).getDate();
  if (day > dim) return null;
  return new Date(year, month, day);
}

function expandHolidayDates(holidays, year, month) {
  const dates = new Set();
  for (const h of holidays) {
    if (!h || h.isEnabled === false) continue;

    if (h.date) {
      const d = new Date(`${h.date}T00:00:00`);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const iso = toISO(d);
        if (iso) dates.add(iso);
      }
      continue;
    }

    if (!h.recurrence) continue;
    const kind = h.recurrence.kind;

    if (kind === "nth-weekday-monthly") {
      const nths = h.recurrence.nths || [];
      const wds = h.recurrence.weekdays || [];
      const months = h.recurrence.months || Array.from({ length: 12 }, (_, i) => i);
      if (!months.includes(month)) continue;

      for (const wd of wds) {
        for (const nth of nths) {
          const date = nthWeekdayOfMonth(year, month, wd, nth);
          if (date) dates.add(toISO(date));
        }
      }
    } else if (kind === "weekly") {
      const wds = h.recurrence.weekdays || [];
      const dim = new Date(year, month + 1, 0).getDate();
      for (let d = 1; d <= dim; d++) {
        const dt = new Date(year, month, d);
        if (wds.includes(dt.getDay())) dates.add(toISO(dt));
      }
    } else if (kind === "annual-fixed") {
      const base = h.recurrence.startDate;
      if (base) {
        const mm = +base.slice(0, 2);
        const dd = +base.slice(3, 5);
        if (mm - 1 === month) {
          const dt = new Date(year, month, dd);
          dates.add(toISO(dt));
        }
      }
    }
  }
  return Array.from(dates);
}

/* ------------------- Salary Calculation (attendance-aware) ------------------- */
async function calculateMonthlySalary(userId, year, month) {
  const services = new payload_service();
  const payload = await services.model.findOne({ user_id: userId });

  if (!payload) throw new Error("No salary payload found for this user.");

  // CTC (Monthly)
  const monthlyCTC = Number(payload.ctc || 0);
  if (!monthlyCTC || isNaN(monthlyCTC)) throw new Error("Invalid monthly CTC");

  // ✅ Fetch Holidays
  const holidaysResponse = await holidayService.list();
  const holidays = holidaysResponse?.data || holidaysResponse || [];
  const holidayDates = expandHolidayDates(holidays, Number(year), Number(month) - 1);

  // ✅ Calculate Working Days
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  let totalDays = 0, weekends = 0, holidayCount = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    totalDays++;
    const dow = d.getDay();
    const iso = toISO(d);
    if (!iso) continue;

    if (holidayDates.includes(iso)) { holidayCount++; continue; }
    if (dow === 0 || dow === 6) { weekends++; continue; }
  }
  const workingDays = totalDays - weekends - holidayCount;

  // ✅ Get Attendance Pivot
  const pivotResult = await attendanceService.getPersistedMonthlyPivot(
    Number(year),
    Number(month),
    userId
  );

  // Extract employee record from pivot
  const pivotUsers = Object.values(pivotResult.users);
  const employee = pivotUsers[0] || {};  // since this API fetches only one user's data
  const empId = employee.empId || "Unknown";
  const username = employee.user_name || "Employee";

  const totalStr = employee._totals || "0/0";
  const [presentDaysStr] = totalStr.split("/");
  const presentDays = parseInt(presentDaysStr || 0);

  // ✅ Calculate Pay
  const perDay = workingDays > 0 ? +(monthlyCTC / workingDays).toFixed(2) : 0;
  const ratio = workingDays > 0 ? (presentDays / workingDays) : 0;

  return {
    userId,
    empId,           // 👈 added
    username,
    payload,
    year,
    month,
    monthlyCTC,
    workingDays,
    presentDays,
    perDay,
    ratio
  };
}


/* ------------------- Generate Salary PDF (dynamic like your image) ------------------- */
PayloadController.get("/salary-pdf/:userId/:year/:month", async (req, res) => {
  try {
    const { userId, year, month } = req.params;
    const result = await calculateMonthlySalary(userId, year, month);
    const { payload, monthlyCTC, ratio } = result;

    // Base for percent: monthly CTC
    const base = monthlyCTC;

    // Safely compute percent-of-base; support {enabled, percent} OR numeric
    const pctAmount = (field, customBase = base) => {
      if (!field) return 0;
      if (typeof field === "number") return field;
      if (typeof field === "object" && field.enabled) {
        const p = Number(field.percent || 0);
        return +((customBase * p) / 100).toFixed(2);
      }
      return 0;
    };

    // Monthly (un-prorated) components
    const basicMonthly =
      typeof payload.basic_salary === "number"
        ? Number(payload.basic_salary)
        : pctAmount(payload.basic || payload.basicPercent); // support either shape

    const hraMonthly         = pctAmount(payload.hra);
    const convMonthly        = pctAmount(payload.conveyance);
    const medicalMonthly     = pctAmount(payload.medical);
    const specialMonthly     = pctAmount(payload.special);

    const pfMonthly          = pctAmount(payload.pf, basicMonthly || base); // often based on Basic
    const healthInsMonthly   = pctAmount(payload.health_insurance);
    const ptMonthly          = pctAmount(payload.prof_tax);
    const tdsMonthly         = pctAmount(payload.tds);

    // Apply attendance proration: amount * ratio
    const prorate = (amt) => +(amt * ratio).toFixed(2);

    const earnings = [];
    if (basicMonthly > 0)     earnings.push(["Basic Salary", prorate(basicMonthly)]);
    if (hraMonthly > 0)       earnings.push(["House Rent Allowances", prorate(hraMonthly)]);
    if (convMonthly > 0)      earnings.push(["Conveyance Allowances", prorate(convMonthly)]);
    if (medicalMonthly > 0)   earnings.push(["Medical Allowances", prorate(medicalMonthly)]);
    if (specialMonthly > 0)   earnings.push(["Special Allowances", prorate(specialMonthly)]);

    const gross = +(earnings.reduce((s, e) => s + e[1], 0).toFixed(2));

    const deductions = [];
    if (pfMonthly > 0)        deductions.push(["EPF", prorate(pfMonthly)]);
    if (healthInsMonthly > 0) deductions.push(["Health Insurance", prorate(healthInsMonthly)]);
    if (ptMonthly > 0)        deductions.push(["Professional Tax", prorate(ptMonthly)]);
    if (tdsMonthly > 0)       deductions.push(["TDS", prorate(tdsMonthly)]);

    const totalDeductions = +(deductions.reduce((s, d) => s + d[1], 0).toFixed(2));
    const netPay = +(gross - totalDeductions).toFixed(2);

    // Ensure uploads dir
    const uploadsDir = path.join(__dirname, "../../uploads");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const monthName = new Date(Number(year), Number(month) - 1, 1)
      .toLocaleString("en-US", { month: "long" });
    const pdfPath = path.join(uploadsDir, `payslip_${result.username}_${year}_${month}.pdf`);
    const doc = new PDFDocument({ margin: 40 });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // ---------- Layout constants ----------
    const leftX = 60;
    const midX = 300;
    const rightX = 540;
    const tableStartY = 200;
    const money = (n) =>
      Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    // ---------- Header ----------
    doc.fontSize(14).font("Helvetica-Bold").text("OneAssist Technologies LLP", { align: "center" });
    doc.moveDown(0.2);
    doc.fontSize(12).font("Helvetica-Bold").text(`Salary Slip for ${monthName} ${year}`, { align: "center" });
    doc.moveDown(1.0);

    // ---------- Employee Box ----------
    doc.rect(50, 100, 500, 100).stroke();
    doc.font("Helvetica").fontSize(10);
    doc.text("Name", leftX, 120);
    doc.text("Department", midX, 120);
    doc.text("Emp. No", leftX, 140);
    doc.text("Bank Name", midX, 140);
    doc.text("Designation", leftX, 160);
    doc.text("A/c No.", midX, 160);

    doc.text(result.username || "Employee", leftX + 80, 120);
    doc.text(payload.department || "IT", midX + 80, 120);
    doc.text(result.empId, leftX + 80, 140);
    doc.text(payload.bank_name || "HDFC Bank", midX + 80, 140);
    doc.text(payload.designation || "Software Developer", leftX + 80, 160);
    doc.text(payload.account_no || "XXXXXX1234", midX + 80, 160);

    // ---------- Earnings / Deductions Table ----------
    let y = tableStartY;
    doc.rect(50, y, 500, 150).stroke();
    doc.moveTo(300, y).lineTo(300, y + 150).stroke();

    doc.font("Helvetica-Bold").fontSize(11);
    doc.text("Earnings", leftX, y + 5);
    doc.text("Deductions", midX + 10, y + 5);

    doc.moveTo(50, y + 20).lineTo(550, y + 20).stroke();
    doc.font("Helvetica").fontSize(10);

    const earningsWithTotal = [...earnings, ["Gross Salary", gross]];
    const deductionsWithTotal = [...deductions, ["Total Deductions", totalDeductions]];

    let rowY = y + 25;
    const rows = Math.max(earningsWithTotal.length, deductionsWithTotal.length);
    for (let i = 0; i < rows; i++) {
      const e = earningsWithTotal[i];
      const d = deductionsWithTotal[i];

      if (e) {
        const isTotal = e[0] === "Gross Salary";
        doc.font(isTotal ? "Helvetica-Bold" : "Helvetica");
        doc.text(e[0], leftX, rowY);
        doc.text(money(e[1]), leftX + 160, rowY, { width: 60, align: "right" });
      }
      if (d) {
        const isTotal = d[0] === "Total Deductions";
        doc.font(isTotal ? "Helvetica-Bold" : "Helvetica");
        doc.text(d[0], midX + 10, rowY);
        doc.text(money(d[1]), rightX - 60, rowY, { width: 60, align: "right" });
      }
      rowY += 18;
    }

    // ---------- Net Pay Row ----------
    y = tableStartY + 150;
    doc.rect(50, y, 500, 25).stroke();
    doc.font("Helvetica-Bold").text("Net Pay", leftX, y + 5);
    doc.text(money(netPay), leftX + 160, y + 5, { width: 60, align: "right" });

    // ---------- Amount in Words ----------
    y += 35;
    doc.font("Helvetica").fontSize(10);
    doc.text("Amount in Words:", leftX, y);
    doc.text(numberToWords(Math.round(netPay)), leftX + 120, y);

    // ---------- Footer ----------
    y += 40;
    doc.fontSize(9).text("This is a system-generated payslip and does not require a signature.", { align: "center" });

    doc.end();
    stream.on("finish", () => {
      res.download(pdfPath, `Payslip_${result.username}_${month}_${year}.pdf`, err => {
        if (!err) fs.unlinkSync(pdfPath);
      });
    });
  } catch (err) {
    console.error("Error generating salary PDF:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ------------------- Amount in words (Indian system) ------------------- */
function numberToWords(num) {
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  if ((num = num.toString()).length > 9) return "Overflow";
  const n = ("000000000" + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return "";
  let str = "";
  str += (n[1] != 0) ? (a[+n[1]] || (b[n[1][0]] + " " + a[n[1][1]])) + " Crore " : "";
  str += (n[2] != 0) ? (a[+n[2]] || (b[n[2][0]] + " " + a[n[2][1]])) + " Lakh " : "";
  str += (n[3] != 0) ? (a[+n[3]] || (b[n[3][0]] + " " + a[n[3][1]])) + " Thousand " : "";
  str += (n[4] != 0) ? (a[+n[4]] || (b[n[4][0]] + " " + a[n[4][1]])) + " Hundred " : "";
  str += (n[5] != 0) ? ((str !== "") ? "and " : "") + (a[+n[5]] || (b[n[5][0]] + " " + a[n[5][1]])) + " " : "";
  return (str.trim() || "Zero") + " Only";
}

module.exports = PayloadController;
