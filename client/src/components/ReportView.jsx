import { lazy, Suspense } from 'react';
import { formatDate, formatPeriod } from '../utils/date';
import { SLOT_LABELS } from '../utils/slots';

// the chart library is big, so it is only downloaded when a report page opens
const MonthChart = lazy(() => import('./MonthChart'));

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

// Everything on a reports page for one date: the three summaries, the
// chart for the month, and the day's readings. Shared by the patient's own
// Reports page and the doctor's view of a patient.
function ReportView({ reports, date }) {
  const { daily, monthToDate, previousMonth } = reports;

  return (
    <>
      <div className="report-grid">
        <ReportCard title="Daily" report={daily} />
        <ReportCard title="Month to date" report={monthToDate} />
        <ReportCard title="Previous month" report={previousMonth} />
      </div>

      <section className="card section-gap">
        <h2>Readings this month</h2>
        <p className="period">{formatPeriod(monthToDate.period)}</p>
        <Suspense fallback={<p className="muted">Loading chart...</p>}>
          <MonthChart readings={monthToDate.readings} />
        </Suspense>
      </section>

      <section className="card">
        <h2>Readings on {formatDate(date)}</h2>

        {daily.readings.length === 0 ? (
          <p className="empty">Nothing logged for this day.</p>
        ) : (
          <table className="daily-table">
            <thead>
              <tr>
                <th>Time slot</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {daily.readings.map((reading) => (
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
  );
}

export default ReportView;