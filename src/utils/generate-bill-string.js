
const financialYear = require("./financial-year");
const generateBillString = (date) => {
    try {
        let quarterly;
        let half_yearly;
        let month = date.getMonth();
        const monthNames = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ];
        if (month >= 3 && month < 6)
            quarterly = "Q1";
        else if (month >= 6 && month < 9)
            quarterly = "Q2";
        else if (month >= 9 && month < 12)
            quarterly = "Q3";
        else
            quarterly = "Q4";
        if (quarterly == "Q1" || quarterly == "Q2")
            half_yearly = "H1";
        else
            half_yearly = "H2";
        let monthName = monthNames[month];
        let financial_year = financialYear(date);
        return {
            financial_year: financial_year,
            month: monthName,
            quarterly: quarterly,
            half_yearly: half_yearly,
        };
    }
    catch (error) {
        throw error;
    }
};
module.exports = generateBillString;
