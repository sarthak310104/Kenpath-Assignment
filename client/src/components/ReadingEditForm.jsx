import { useState } from 'react';
import { readingsAPI } from '../api/readings';

function ReadingEditForm({ reading, onSaved, onCancel }) {
  const [form, setForm] = useState({
    reading_date: String(reading.reading_date).slice(0, 10),
    slot: reading.slot,
    value: reading.value,
  });

  const [error, setError] = useState('');
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
    setSubmitting(true);

    try {
      await readingsAPI.update(reading.id, {
        ...form,
        value: Number(form.value),
      });

      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="edit-date">Date</label>
        <input
          id="edit-date"
          name="reading_date"
          type="date"
          value={form.reading_date}
          onChange={handleChange}
          required
        />
      </div>

      <div>
        <label htmlFor="edit-slot">Time slot</label>
        <select
          id="edit-slot"
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
        <label htmlFor="edit-value">Glucose value (mg/dL)</label>
        <input
          id="edit-value"
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

      <button type="submit" disabled={submitting}>
        {submitting ? 'Saving...' : 'Save changes'}
      </button>

      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}

export default ReadingEditForm;