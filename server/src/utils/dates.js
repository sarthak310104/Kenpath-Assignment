// Today's date as the user sees it on their clock (YYYY-MM-DD).
// Not toISOString(): that gives the UTC date, which is still "yesterday"
// in India between midnight and 5:30am.
function todayLocal(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

module.exports = { todayLocal };