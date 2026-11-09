import { useState } from 'react';
import { readingsAPI } from '../api/readings';

const INITIAL_FORM = {
  reading_date: new Date().toISOString().slice(0, 10),
  slot: 'morning',
  value: '',
};

function ReadingForm({ onReadingAdded }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      await readingsAPI.create({
        ...form,
        value: Number(form.value),
      });

      setSuccess('Reading added successfully.');
      setForm({
        ...INITIAL_FORM,
        reading_date: new Date().toISOString().slice(0, 10),
      });

      onReadingAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h2>Add a glucose reading</h2>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="reading_date">Date</label>
          <input
            id="reading_date"
            name="reading_date"
            type="date"
            value={form.reading_date}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="slot">Time slot</label>
          <select
            id="slot"
            name="slot"
            value={form.slot}
            onChange={handleChange}
            required
          >
            <option value="morning">Morning (fasting)</option>
            <option value="after_breakfast">After breakfast</option>
            <option value="after_lunch">After lunch</option>
            <option value="after_dinner">After dinner</option>
          </select>
        </div>

        <div>
          <label htmlFor="value">Glucose value (mg/dL)</label>
          <input
            id="value"
            name="value"
            type="number"
            min="40"
            max="600"
            step="1"
            value={form.value}
            onChange={handleChange}
            required
          />
        </div>

        {error && <p role="alert">{error}</p>}
        {success && <p role="status">{success}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : 'Add reading'}
        </button>
      </form>
    </section>
  );
}

export default ReadingForm;