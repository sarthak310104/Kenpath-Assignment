import { useEffect, useState } from 'react';
import { readingsAPI } from '../api/readings';
import { formatDate } from '../utils/date';
import { SLOT_LABELS } from '../utils/slots';

import ReadingForm from '../components/ReadingForm';
import ReadingEditForm from '../components/ReadingEditForm';
import DoctorPicker from '../components/DoctorPicker';

// The API sends a flat list (newest first). Put the readings of the same
// day together so the page reads like a diary.
function groupByDate(readings) {
  const groups = [];

  readings.forEach((reading) => {
    const date = String(reading.reading_date).slice(0, 10);
    const last = groups[groups.length - 1];

    if (last && last.date === date) {
      last.items.push(reading);
    } else {
      groups.push({ date, items: [reading] });
    }
  });

  return groups;
}

function Dashboard() {
  const [readings, setReadings] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    async function fetchReadings() {
      setLoading(true);
      setError('');

      try {
        const data = await readingsAPI.getAll({ page, limit: 20 });

        // deleted the last reading on this page -> go back one page
        if (data.readings.length === 0 && page > 1) {
          setPage(page - 1);
          return;
        }

        setReadings(data.readings);
        setPagination(data.pagination);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchReadings();
  }, [page, refreshKey]);

  function reload() {
    setRefreshKey((current) => current + 1);
  }

  function handleReadingAdded() {
    setPage(1);
    reload();
  }

  async function handleDelete(id) {
    const confirmed = window.confirm('Delete this reading?');

    if (!confirmed) return;

    try {
      await readingsAPI.delete(id);
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  const groups = groupByDate(readings);

  return (
    <>
      <h1 className="page-title">My readings</h1>
      <p className="page-sub">Log up to 4 readings a day and keep track of them here.</p>

      <div className="dashboard-grid">
        <div className="side-stack">
          <ReadingForm onReadingAdded={handleReadingAdded} />
          <DoctorPicker />
        </div>

        <section className="card">
          <h2>History</h2>

          {loading && readings.length === 0 && <p className="muted">Loading readings...</p>}

          {error && <p className="alert alert-error" role="alert">{error}</p>}

          {!loading && !error && readings.length === 0 && (
            <p className="empty">No readings yet. Add your first one using the form.</p>
          )}

          {groups.map((group) => (
            <div className="day-group" key={group.date}>
              <h3 className="day-heading">
                {formatDate(group.date)}
                <span className="day-count">{group.items.length}/4</span>
              </h3>

              {group.items.map((reading) => (
                <article className="reading-row" key={reading.id}>
                  {editingId === reading.id ? (
                    <ReadingEditForm
                      reading={reading}
                      onSaved={() => {
                        setEditingId(null);
                        reload();
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <>
                      <span className="slot-name">{SLOT_LABELS[reading.slot]}</span>

                      <span className="reading-value">
                        {reading.value} <small>mg/dl</small>
                      </span>

                      <span className="row-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-small"
                          onClick={() => setEditingId(reading.id)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-small"
                          onClick={() => handleDelete(reading.id)}
                        >
                          Delete
                        </button>
                      </span>
                    </>
                  )}
                </article>
              ))}
            </div>
          ))}

          {pagination && pagination.totalPages > 1 && (
            <div className="pager">
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => setPage((current) => current - 1)}
                disabled={page <= 1}
              >
                Previous
              </button>

              <span>
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => setPage((current) => current + 1)}
                disabled={page >= pagination.totalPages}
              >
                Next
              </button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export default Dashboard;