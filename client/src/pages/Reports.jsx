import { useEffect, useState } from 'react';
import { reportsAPI } from '../api/reports';
import { formatDate, formatPeriod, getLocalDate } from '../utils/date';
import { SLOT_LABELS } from '../utils/slots';

function Stat({ label, value, unit }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">
        {value}
        {unit && <small> {unit}</small>}
      </span>
    </div>
  );
}

function ReportCard({ title, report }) {
  if (!report) return null;

  const { summary, period } = report;

  return (
    <section className="card report-card">
      <h2>{title}</h2>
      <p className="period">{formatPeriod(period)}</p>

      {summary.total_readings === 0 ? (
        <p className="empty">No readings in this period yet.</p>
      ) : (
        <div className="stats">
          <Stat label="Average" value={summary.average} unit="mg/dl" />
          <Stat label="Lowest" value={summary.minimum} unit="mg/dl" />
          <Stat label="Highest" value={summary.maximum} unit="mg/dl" />
          <Stat label="Readings" value={summary.total_readings} />
        </div>
      )}
    </section>
  );
}

function Reports() {
  const [selectedDate, setSelectedDate] = useState(getLocalDate());

  const [reports, setReports] = useState({
    daily: null,
    monthToDate: null,
    previousMonth: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // if the date changes again before this finishes, drop the old answer
    let stale = false;

    async function fetchReports() {
      setLoading(true);
      setError('');

      try {
        const [daily, monthToDate, previousMonth] = await Promise.all([
          reportsAPI.daily(selectedDate),
          reportsAPI.monthToDate(selectedDate),
          reportsAPI.previousMonth(selectedDate),
        ]);

        if (stale) return;

        setReports({ daily, monthToDate, previousMonth });
      } catch (err) {
        if (!stale) setError(err.message);
      } finally {
        if (!stale) setLoading(false);
      }
    }

    fetchReports();

    return () => {
      stale = true;
    };
  }, [selectedDate]);

  const dailyReadings = reports.daily ? reports.daily.readings : [];

  return (
    <>
      <h1 className="page-title">Reports</h1>
      <p className="page-sub">Pick a date to see that day, the month so far and last month.</p>

      <div className="toolbar">
        <label htmlFor="report-date">Date</label>
        <input
          id="report-date"
          type="date"
          value={selectedDate}
          max={getLocalDate()}
          onChange={(event) => {
            // ignore the box being cleared, there is no report for "no date"
            if (event.target.value) setSelectedDate(event.target.value);
          }}
        />
      </div>

      {loading && <p className="muted">Loading reports...</p>}

      {error && <p className="alert alert-error" role="alert">{error}</p>}

      {!loading && !error && reports.daily && (
        <>
          <div className="report-grid">
            <ReportCard title="Daily" report={reports.daily} />
            <ReportCard title="Month to date" report={reports.monthToDate} />
            <ReportCard title="Previous month" report={reports.previousMonth} />
          </div>

          <section className="card">
            <h2>Readings on {formatDate(selectedDate)}</h2>

            {dailyReadings.length === 0 ? (
              <p className="empty">
                Nothing logged for this day. You can add a reading from the Readings page.
              </p>
            ) : (
              <table className="daily-table">
                <thead>
                  <tr>
                    <th>Time slot</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyReadings.map((reading) => (
                    <tr key={reading.id}>
                      <td>{SLOT_LABELS[reading.slot]}</td>
                      <td>{reading.value} mg/dl</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </>
  );
}

export default Reports;