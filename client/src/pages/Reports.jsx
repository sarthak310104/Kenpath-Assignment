import { useState } from 'react';
import { reportsAPI } from '../api/reports';
import { getLocalDate } from '../utils/date';
import { useReportSet } from '../hooks/useReportSet';

import DateToolbar from '../components/DateToolbar';
import ReportView from '../components/ReportView';

// defined out here so it keeps the same identity between renders
async function loadOwnReports(date) {
  const [daily, monthToDate, previousMonth] = await Promise.all([
    reportsAPI.daily(date),
    reportsAPI.monthToDate(date),
    reportsAPI.previousMonth(date),
  ]);

  return { daily, monthToDate, previousMonth };
}

function Reports() {
  const [selectedDate, setSelectedDate] = useState(getLocalDate());
  const { reports, loading, error } = useReportSet(selectedDate, loadOwnReports);

  return (
    <>
      <h1 className="page-title">Reports</h1>
      <p className="page-sub">Pick a date to see that day, the month so far and last month.</p>

      <DateToolbar value={selectedDate} onChange={setSelectedDate} />

      {loading && <p className="muted">Loading reports...</p>}

      {error && <p className="alert alert-error" role="alert">{error}</p>}

      {!loading && !error && reports && (
        <ReportView reports={reports} date={selectedDate} />
      )}
    </>
  );
}

export default Reports;