const express = require("express");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const payload_service = require("../services/payload-service");
const routesUtil = require("../utils/routes");
const UserAttendanceReportService = require("../services/user-attendance-report-service");
const HolidayService = require("../services/holiday-service");
const creditPetrolService = require("../services/creditPetrol-service");
const UserService = require("../services/user-service"); // ✅ Imported UserService

const PayloadController = express.Router();
let routes = new routesUtil(payload_service);

const attendanceService = new UserAttendanceReportService();
const holidayService = new HolidayService();
const userService = new UserService(); // ✅ Instantiated

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

  // 1. Get Payload
  const payload = await services.model.findOne({ user_id: userId });
  if (!payload) throw new Error("No salary payload found for this user.");

  // 2. ✅ Get Real User Details (Fix Name Conflict)
  const userDoc = await userService.retrieve({ _id: userId });
  if (!userDoc) throw new Error("User not found.");

  const username = userDoc.user_name || "Employee";
  const empId = userDoc.empId || payload.empId || "-";
  const designation = payload.designation || userDoc.position || userDoc.role || "Employee"; // Prioritize payload designation
  const doj = toISO(userDoc.doj) || payload.date_of_joining || "-";

  // Monthly CTC
  const monthlyCTC = Number(payload.ctc || 0);
  if (!monthlyCTC || isNaN(monthlyCTC)) throw new Error("Invalid monthly CTC");

  // Fetch Holidays
  const holidaysResponse = await holidayService.list();
  const holidays = holidaysResponse?.data || holidaysResponse || [];
  const holidayDates = expandHolidayDates(holidays, Number(year), Number(month) - 1);

  // Calculate Working Days
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

  // Get Attendance Pivot
  const pivotResult = await attendanceService.getPersistedMonthlyPivotHourly(
    Number(year),
    Number(month),
    userId
  );

  // Extract employee record from pivot
  const pivotUser = (pivotResult.users && pivotResult.users[userId])
    ? pivotResult.users[userId]
    : (Object.values(pivotResult.users || {})[0] || {});

  const totalStr = pivotUser._totals || "0/0";
  const [presentDaysStr] = totalStr.split("/");
  const presentDays = parseInt(presentDaysStr || 0, 10);

  // Attendance-based ratio
  const perDay = workingDays > 0 ? +(monthlyCTC / workingDays).toFixed(2) : 0;
  const ratio = workingDays > 0 ? (presentDays / workingDays) : 0;

  return {
    userId,
    empId,
    username,
    designation, // ✅ Return fixed designation
    doj,         // ✅ Return fixed doj
    payload,
    year: Number(year),
    month: Number(month),
    monthlyCTC,
    workingDays,
    presentDays,
    perDay,
    ratio
  };
}

/* ------------------- Generate Salary PDF (Govt norms + your payslip format) ------------------- */
PayloadController.get("/salary-pdf/:userId/:year/:month", async (req, res) => {
  try {
    const { userId, year, month } = req.params;
    const creditPetrol_Service = new creditPetrolService();

    // Parse numbers
    const ye = Number(year);
    const m = Number(month) - 1;  // convert to 0–11 month index

    if (isNaN(ye) || isNaN(m) || m < 0 || m > 11) {
      return res.status(400).json({ message: "Invalid year or month" });
    }

    // Build month range
    const startOfMonth = new Date(ye, m, 1, 0, 0, 0);
    const endOfMonth = new Date(ye, m + 1, 0, 23, 59, 59);

    // Fetch reimbursement entries (Petrol/Travel)
    const reimbursementTravel = await creditPetrol_Service.retrieveAll({
      userId,
      updatedAt: {
        $gte: startOfMonth,
        $lte: endOfMonth
      }
    });

    // Sum of reimbursement "amount"
    const totalAmount = reimbursementTravel.reduce((sum, item) => {
      return sum + Number(item.amount || 0);
    }, 0);

    // Get salary + attendance context
    const result = await calculateMonthlySalary(userId, year, month);
    // ✅ Extract Corrected Details
    const { payload, monthlyCTC, ratio, username, empId, designation, doj, workingDays, presentDays } = result;

    // ------------- Helper: build effective allowance % (Basic >= 40% of Gross) -------------
    const allowanceKeys = ["basic", "hra", "da", "ta", "conveyance", "medical", "special"];

    const effectivePercent = {};
    const enabledKeys = allowanceKeys.filter(
      (k) => payload[k] && payload[k].enabled
    );

    // If nothing enabled, default to basic+special
    if (enabledKeys.length === 0) {
      enabledKeys.push("basic", "special");
    }

    // Input Basic percent (0 if missing)
    let basicInput =
      payload.basic && payload.basic.enabled ? Number(payload.basic.percent || 0) : 0;

    // If Basic not enabled or set, force 40% as per govt style
    if (!payload.basic || !payload.basic.enabled || basicInput <= 0) {
      basicInput = 40;
    }

    // Other allowances (that are enabled and not Basic)
    const otherKeys = enabledKeys.filter((k) => k !== "basic");
    const sumOthersInput = otherKeys.reduce((sum, k) => {
      const p = payload[k] ? Number(payload[k].percent || 0) : 0;
      return sum + p;
    }, 0);

    if (sumOthersInput <= 0) {
      // Only Basic effectively => Basic 100%
      effectivePercent["basic"] = 100;
      otherKeys.forEach((k) => (effectivePercent[k] = 0));
    } else if (basicInput >= 40) {
      // Already compliant: keep user distribution
      effectivePercent["basic"] = basicInput;
      otherKeys.forEach((k) => {
        const p = payload[k] ? Number(payload[k].percent || 0) : 0;
        effectivePercent[k] = p;
      });
    } else {
      // Basic < 40 => bump to 40 and scale others into remaining 60
      effectivePercent["basic"] = 40;
      const remaining = 60;
      otherKeys.forEach((k) => {
        const orig = payload[k] ? Number(payload[k].percent || 0) : 0;
        effectivePercent[k] = sumOthersInput > 0
          ? (orig / sumOthersInput) * remaining
          : 0;
      });
    }

    // Any non-enabled allowance => 0 effective percent
    allowanceKeys.forEach((k) => {
      if (!effectivePercent.hasOwnProperty(k)) {
        effectivePercent[k] = 0;
      }
    });

    // ------------- Step 2: Solve Gross -------------
    let gross = monthlyCTC;
    let prevGross = 0;
    let employerPfFull = 0;
    let employerEsicFull = 0;

    const maxIterations = 50;
    let it = 0;

    while (Math.abs(gross - prevGross) > 1 && it < maxIterations) {
      it++;
      prevGross = gross;

      const basicFromGross = gross * (effectivePercent["basic"] || 0) / 100;

      // Employer PF (same as employee formula but from CTC)
      if (payload.pf && payload.pf.enabled) {
        employerPfFull = basicFromGross > 15000 ? 1800 : basicFromGross * 0.12;
      } else {
        employerPfFull = 0;
      }

      // Employer ESIC (3.25% of Gross if enabled & < 21000)
      if (payload.esicEmployer && payload.esicEmployer.enabled && gross < 21000) {
        employerEsicFull = gross * 0.0325;
      } else {
        employerEsicFull = 0;
      }

      const newGross = monthlyCTC - (employerPfFull + employerEsicFull);
      gross = newGross;
    }

    if (gross < 0) gross = 0;

    // ------------- Step 3: Allowances based on Gross & effective % -------------
    const basicMonthly = gross * (effectivePercent["basic"] || 0) / 100;
    const hraMonthly = gross * (effectivePercent["hra"] || 0) / 100;
    const conveyMonthly = gross * (effectivePercent["conveyance"] || 0) / 100;
    const medicalMonthly = gross * (effectivePercent["medical"] || 0) / 100;

    // Other allowance = Special + DA + TA (per your instruction)
    const daMonthly = gross * (effectivePercent["da"] || 0) / 100;
    const taMonthly = gross * (effectivePercent["ta"] || 0) / 100;
    const specialMonthly = gross * (effectivePercent["special"] || 0) / 100;
    const otherAllowanceMonthly = daMonthly + taMonthly + specialMonthly;

    // ------------- Step 4: Statutory contributions (full month) -------------
    // Employee PF (12% of Basic, capped at 1800)
    let employeePfFull = 0;
    if (payload.pf && payload.pf.enabled) {
      employeePfFull = basicMonthly > 15000 ? 1800 : basicMonthly * 0.12;
    }

    // Employee ESIC (0.75% of Gross if < 21000)
    let employeeEsicFull = 0;
    if (payload.esicEmployee && payload.esicEmployee.enabled && gross < 21000) {
      employeeEsicFull = gross * 0.0075;
    }

    // PT & TDS – percentage of CTC (company-defined)
    let ptFull = 0, tdsFull = 0;
    if (payload.pt && payload.pt.enabled) {
      ptFull = monthlyCTC * (Number(payload.pt.percent || 0) / 100);
    }
    if (payload.tds && payload.tds.enabled) {
      tdsFull = monthlyCTC * (Number(payload.tds.percent || 0) / 100);
    }

    // Employer PF/ESIC already computed via iteration: employerPfFull, employerEsicFull

    // ------------- Step 5: Attendance proration (actual payable) -------------
    const prorate = (amt) => +(amt * ratio).toFixed(2);

    const basicPay = prorate(basicMonthly);
    const hraPay = prorate(hraMonthly);
    const conveyPay = prorate(conveyMonthly);
    const medicalPay = prorate(medicalMonthly);
    const otherPay = prorate(otherAllowanceMonthly);

    // Gross (actual earnings) = sum of prorated allowances
    const grossPay = +(basicPay + hraPay + conveyPay + medicalPay + otherPay).toFixed(2);

    const employeePfPay = prorate(employeePfFull);
    const employeeEsicPay = prorate(employeeEsicFull);
    const ptPay = prorate(ptFull);
    const tdsPay = prorate(tdsFull);

    const employerPfPay = prorate(employerPfFull);
    const employerEsicPay = prorate(employerEsicFull);

    const totalEmployeeDeductionsPay = +(
      employeePfPay + employeeEsicPay + ptPay + tdsPay
    ).toFixed(2);

    // Net salary = Gross + Reimbursement − employee deductions
    const netPay = +(
      grossPay + totalAmount - totalEmployeeDeductionsPay
    ).toFixed(2);

    // ------------- Step 6: Build Earnings & Deductions arrays (for PDF) -------------
    const earnings = [];

    if (basicPay > 0) earnings.push(["Basic", basicPay]);
    if (hraPay > 0) earnings.push(["HRA", hraPay]);
    if (conveyPay > 0) earnings.push(["Conveyance Allowance", conveyPay]);
    if (medicalPay > 0) earnings.push(["Medical", medicalPay]);
    if (otherPay > 0) earnings.push(["Other Allowance", otherPay]);

    // Gross row (sum of above)
    earnings.push(["Gross", grossPay]);

    // Performance Allowance / Other Payment = Petrol/Travel reimbursement (non-prorated)
    earnings.push(["Performance Allowance/Other Payment", totalAmount]);

    // Less : Loss of Pay 
    earnings.push(["Less : Loss of Pay", 0]);

    // CTC (configured monthly)
    earnings.push(["CTC", monthlyCTC]);

    // Net Salary Payable
    earnings.push(["Net Salary Payable", netPay]);

    const deductions = [];

    // Employer-side (info – from CTC)
    if (employerPfPay > 0) {
      deductions.push(["Provident Fund (Employer)", employerPfPay]);
    }
    if (employerEsicPay > 0) {
      deductions.push(["Employer ESIC Contribution", employerEsicPay]);
    }

    // Employee-side (affects net)
    if (employeePfPay > 0) {
      deductions.push(["Provident Fund (Employee)", employeePfPay]);
    }
    if (employeeEsicPay > 0) {
      deductions.push(["Employee ESIC Contribution", employeeEsicPay]);
    }
    if (ptPay > 0) {
      deductions.push(["Professional Tax (PT)", ptPay]);
    }
    if (tdsPay > 0) {
      deductions.push(["Income Tax (TDS)", tdsPay]);
    }

    const totalDeductions = +(totalEmployeeDeductionsPay).toFixed(2);

    // ------------- Step 7: Build PDF (Original Style with Alignment Fixes) -------------
    const uploadsDir = path.join(__dirname, "../../uploads");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const monthName = new Date(Number(year), Number(month) - 1, 1)
      .toLocaleString("en-US", { month: "long" });

    const pdfPath = path.join(
      uploadsDir,
      `payslip_${username.replace(/ /g, '_')}_${year}_${month}.pdf`
    );

    const doc = new PDFDocument({ margin: 40 });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    const leftX = 60;
    const midX = 300;
    const rightX = 540;
    const tableStartY = 220;
    const money = (n) =>
      Number(n).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });

    // ---------- Header ----------
    doc.fontSize(14).font("Helvetica-Bold").text("One Assist Technologies", { align: "center" }); // Updated to One Assist based on context
    doc.moveDown(0.2);
    doc.fontSize(10).font("Helvetica").text("553,NVN Layout, Ponnai Street, Tatabad, Gandhipuram, Coimbatore, Tamilnadu 641012, IN.", { align: "center" });
    // doc.text("Company Address Line 2", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(12).font("Helvetica-Bold").text(`Salary For the Month of ${monthName} ${year}`, { align: "center" });
    doc.moveDown(1.0);

    // ---------- Employee Details Box ----------
    doc.rect(50, 100, 500, 90).stroke();
    doc.font("Helvetica").fontSize(10);

    doc.text("Employee's Name :", leftX, 110);
    doc.text("Designation :", leftX, 125);
    doc.text("Date of Joining :", leftX, 140);

    doc.text("Employee ID No :", midX, 110);
    doc.text("No. of Working Days :", midX, 125);
    doc.text("Days Present :", midX, 140);

    doc.font("Helvetica-Bold");
    doc.text(username || "Employee", leftX + 120, 110);
    doc.text(designation, leftX + 120, 125);
    doc.text(doj, leftX + 120, 140);

    doc.text(empId || "-", midX + 130, 110);
    doc.text(`${workingDays} Days`, midX + 130, 125);
    doc.text(`${presentDays} Days`, midX + 130, 140);

    // ---------- Earnings / Deductions Table ----------
    let y = tableStartY;
    const tableHeight = 210; // a bit taller to fit all rows
    doc.rect(50, y, 500, tableHeight).stroke();
    doc.moveTo(300, y).lineTo(300, y + tableHeight).stroke();

    doc.font("Helvetica-Bold").fontSize(11);
    doc.text("Earning (in Rs. Ps.)", leftX, y + 5);
    doc.text("Deduction (in Rs. Ps.)", midX + 10, y + 5);

    doc.moveTo(50, y + 22).lineTo(550, y + 22).stroke();
    doc.font("Helvetica").fontSize(10);

    let rowY = y + 27;
    const maxRows = Math.max(earnings.length, deductions.length);

    for (let i = 0; i < maxRows; i++) {
      const e = earnings[i];
      const d = deductions[i];

      if (e) {
        doc.text(e[0], leftX, rowY);
        // ✅ ALIGNMENT FIX: Adjusted amount position to not overlapping center line (300)
        // Previous x: leftX + 180 = 240. Width 70. Ends 310. (Overlapped)
        // New x: leftX + 160 = 220. Width 70. Ends 290. (Safe)
        doc.text(money(e[1]), leftX + 160, rowY, { width: 70, align: "right" });
      }
      if (d) {
        doc.text(d[0], midX + 10, rowY); // 310
        doc.text(money(d[1]), rightX - 60, rowY, { width: 60, align: "right" }); // 480-540
      }

      rowY += 16;
    }

    // ---------- Total Deductions ----------
    rowY += 5;
    doc.font("Helvetica-Bold");
    doc.text("Total Employee Deductions", midX + 10, rowY);
    doc.text(money(totalDeductions), rightX - 60, rowY, { width: 60, align: "right" });

    // ---------- Net Pay Row ----------
    y = tableStartY + tableHeight + 20;
    doc.rect(50, y, 500, 25).stroke();
    doc.font("Helvetica-Bold").fontSize(11);
    doc.text("Net Salary Payable", leftX, y + 5);
    // ✅ Alignment Fix for Net Pay too
    doc.text(money(netPay), leftX + 160, y + 5, { width: 70, align: "right" });

    // ---------- Amount in Words ----------
    y += 35;
    doc.font("Helvetica").fontSize(10);
    doc.text("Amount In Words:", leftX, y);
    doc.text(numberToWords(Math.round(netPay)), leftX + 100, y, { width: 370 });

    // ---------- Footer ----------
    y += 40;
    doc.fontSize(9).text("HR Manager", leftX, y + 10);
    doc.fontSize(8).text(
      "This is a system generated payslip, hence signature is not required.",
      { align: "center" }
    );

    doc.end();
    stream.on("finish", () => {
      res.download(pdfPath, `Payslip_${username}_${month}_${year}.pdf`, err => {
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
