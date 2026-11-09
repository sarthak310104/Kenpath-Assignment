import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doctorAPI } from '../api/doctor';
import { getLocalDate } from '../utils/date';
import { useReportSet } from '../hooks/useReportSet';

import DateToolbar from '../components/DateToolbar';
import ReportView from '../components/ReportView';

// A doctor looking at one patient's reports (read only).
function PatientReports() {
  const { id } = useParams();
  const [selectedDate, setSelectedDate] = useState(getLocalDate());

  const load = useCallback(
    async (date) => {
      const [daily, monthToDate, previousMonth] = await Promise.all([
        doctorAPI.patientReport(id, 'daily', date),
        doctorAPI.patientReport(id, 'month-to-date', date),
        doctorAPI.patientReport(id, 'previous-month', date),
      ]);

      return { daily, monthToDate, previousMonth };
    },
    [id]
  );

  const { reports, loading, error } = useReportSet(selectedDate, load);

  return (
    <>
      <p className="back-link">
        <Link to="/patients">&larr; All patients</Link>
      </p>

      <h1 className="page-title">
        {reports ? `${reports.daily.patient.name}'s reports` : 'Patient reports'}
      </h1>
      <p className="page-sub">Read only. Pick a date to see that day, the month so far and last month.</p>

      <DateToolbar value={selectedDate} onChange={setSelectedDate} />

      {loading && <p className="muted">Loading reports...</p>}

      {error && <p className="alert alert-error" role="alert">{error}</p>}

      {!loading && !error && reports && (
        <ReportView reports={reports} date={selectedDate} />
      )}
    </>
  );
}

export default PatientReports;