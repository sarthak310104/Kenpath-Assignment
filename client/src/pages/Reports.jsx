import { useEffect, useState } from 'react';
import { reportsAPI } from '../api/reports';

const SLOT_LABELS = {
  morning: 'Morning (fasting)',
  after_breakfast: 'After breakfast',
  after_lunch: 'After lunch',
  after_dinner: 'After dinner',
};

function ReportCard({ title, report }) {
  if (!report) return null;

  const { summary } = report;

  return (
    <section>
      <h2>{title}</h2>

      {summary.total_readings === 0 ? (
        <p>No readings available for this period.</p>
      ) : (
        <div>
          <p>Total readings: {summary.total_readings}</p>
          <p>Average: {summary.average} mg/dL</p>
          <p>Lowest: {summary.minimum} mg/dL</p>
          <p>Highest: {summary.maximum} mg/dL</p>
        </div>
      )}
    </section>
  );
}
function getLocalDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
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
    async function fetchReports() {
      setLoading(true);
      setError('');

      try {
        const [daily, monthToDate, previousMonth] = await Promise.all([
          reportsAPI.daily(selectedDate),
          reportsAPI.monthToDate(selectedDate),
          reportsAPI.previousMonth(selectedDate),
        ]);

        setReports({
          daily,
          monthToDate,
          previousMonth,
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchReports();
  }, [selectedDate]);

  return (
    <main>
      <h1>Glucose Reports</h1>
      <p>Review your glucose readings over different periods.</p>

      <label htmlFor="report-date">Select date: </label>
      <input
        id="report-date"
        type="date"
        value={selectedDate}
        max={getLocalDate()}
        onChange={(event) => setSelectedDate(event.target.value)}
      />

      {loading && <p>Loading reports...</p>}

      {error && <p role="alert">{error}</p>}

      {!loading && !error && (
        <>
          <ReportCard title="Daily Report" report={reports.daily} />

          <ReportCard
            title="Month-to-Date Report"
            report={reports.monthToDate}
          />

          <ReportCard
            title="Previous Month Report"
            report={reports.previousMonth}
          />

          <section>
            <h2>Daily Readings</h2>

            {reports.daily.readings.length === 0 ? (
              <p>No readings for this date. Add a reading from your dashboard.</p>
            ) : (
              reports.daily.readings.map((reading) => (
                <article key={reading.id}>
                  <h3>{SLOT_LABELS[reading.slot]}</h3>
                  <p>{reading.value} mg/dL</p>
                </article>
              ))
            )}
          </section>
        </>
      )}
    </main>
  );
}

export default Reports;