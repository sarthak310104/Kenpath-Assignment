import { useEffect, useState } from 'react';
import { readingsAPI } from '../api/readings';

import ReadingForm from '../components/ReadingForm';
import ReadingEditForm from '../components/ReadingEditForm';

const SLOT_LABELS = {
  morning: 'Morning (fasting)',
  after_breakfast: 'After breakfast',
  after_lunch: 'After lunch',
  after_dinner: 'After dinner',
};

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

function handleReadingAdded() {
  setPage(1);
  setRefreshKey((current) => current + 1);
}

  return (
    <main>
      <h1>My Glucose Readings</h1>
      <p>Track and manage your blood glucose levels.</p>
      <ReadingForm onReadingAdded={handleReadingAdded} />

      {loading && <p>Loading readings...</p>}

      {error && <p role="alert">{error}</p>}

      {!loading && !error && readings.length === 0 && (
        <p>No readings yet. Add your first glucose reading.</p>
      )}

      {!loading && readings.length > 0 && (
        <>
          <div>
            {readings.map((reading) => (
                <article key={reading.id}>
                    {editingId === reading.id ? (
                    <ReadingEditForm
                        reading={reading}
                        onSaved={() => {
                        setEditingId(null);
                        setRefreshKey((current) => current + 1);
                        }}
                        onCancel={() => setEditingId(null)}
                    />
                    ) : (
                    <>
                        <h3>{SLOT_LABELS[reading.slot]}</h3>

                        <p>
                        {String(reading.reading_date).slice(0, 10)}
                        </p>

                        <p>{reading.value} mg/dL</p>

                        <button onClick={() => setEditingId(reading.id)}>
                        Edit
                        </button>
                        <button
                            onClick={async () => {
                                const confirmed = window.confirm(
                                'Are you sure you want to delete this reading?'
                                );

                                if (!confirmed) return;

                                try {
                                await readingsAPI.delete(reading.id);
                                setRefreshKey((current) => current + 1);
                                } catch (err) {
                                setError(err.message);
                                }
                            }}
                            >
                            Delete
                        </button>
                    </>
                    )}
                </article>
            ))}
          </div>

          {pagination && (
            <div>
              <button
                onClick={() => setPage((current) => current - 1)}
                disabled={page <= 1}
              >
                Previous
              </button>

              <span>
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <button
                onClick={() => setPage((current) => current + 1)}
                disabled={page >= pagination.totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}

export default Dashboard;