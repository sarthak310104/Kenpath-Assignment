import { useState } from 'react';
import { readingsAPI } from '../api/readings';
import { SLOTS } from '../utils/slots';

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
        value: form.value === '' ? null : Number(form.value),
      });

      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="edit-form" onSubmit={handleSubmit} noValidate>
      <div className="edit-fields">
        <div className="field">
          <label htmlFor={`edit-date-${reading.id}`}>Date</label>
          <input
            id={`edit-date-${reading.id}`}
            name="reading_date"
            type="date"
            value={form.reading_date}
            onChange={handleChange}
          />
        </div>

        <div className="field">
          <label htmlFor={`edit-slot-${reading.id}`}>Time slot</label>
          <select
            id={`edit-slot-${reading.id}`}
            name="slot"
            value={form.slot}
            onChange={handleChange}
          >
            {SLOTS.map((slot) => (
              <option key={slot.value} value={slot.value}>
                {slot.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor={`edit-value-${reading.id}`}>Value (mg/dl)</label>
          <input
            id={`edit-value-${reading.id}`}
            name="value"
            type="number"
            inputMode="numeric"
            value={form.value}
            onChange={handleChange}
          />
        </div>
      </div>

      {error && <p className="alert alert-error" role="alert">{error}</p>}

      <div className="row-actions">
        <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>
          {submitting ? 'Saving...' : 'Save'}
        </button>
        <button type="button" className="btn btn-ghost btn-small" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default ReadingEditForm;