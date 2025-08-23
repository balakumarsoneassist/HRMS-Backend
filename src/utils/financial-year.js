
const financialYear = (date) => {
    let fy;
    let d = new Date(date);
    let year = d.getFullYear().toString();
    let month = d.getMonth();
    let ys = Number(year.substring(2, 4));
    if (month > 2)
        fy = ys + "-" + (ys + 1);
    else
        fy = (ys - 1) + "-" + ys;
    return fy;
};
module.exports = financialYear;
