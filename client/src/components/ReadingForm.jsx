import { useState } from 'react';
import { readingsAPI } from '../api/readings';
import { getLocalDate } from '../utils/date';
import { SLOTS } from '../utils/slots';

function emptyForm() {
  return {
    reading_date: getLocalDate(),
    slot: SLOTS[0].value,
    value: '',
  };
}

function ReadingForm({ onReadingAdded }) {
  const [form, setForm] = useState(emptyForm);
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
        // empty box -> null, so the server says "Please enter a glucose value."
        // (Number('') would turn it into 0)
        value: form.value === '' ? null : Number(form.value),
      });

      setSuccess('Reading added.');

      // Keep the date (people usually log a few slots in a row),
      // jump to the next slot and clear the value.
      const slotIndex = SLOTS.findIndex((s) => s.value === form.slot);
      setForm({
        ...form,
        slot: SLOTS[(slotIndex + 1) % SLOTS.length].value,
        value: '',
      });

      onReadingAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card">
      <h2>Add a reading</h2>

      {/* noValidate: let the server's messages show instead of the browser's */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="reading_date">Date</label>
          <input
            id="reading_date"
            name="reading_date"
            type="date"
            value={form.reading_date}
            onChange={handleChange}
          />
        </div>

        <div className="field">
          <label htmlFor="slot">Time slot</label>
          <select
            id="slot"
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
          <label htmlFor="value">Glucose value (mg/dl)</label>
          <input
            id="value"
            name="value"
            type="number"
            inputMode="numeric"
            placeholder="e.g. 110"
            value={form.value}
            onChange={handleChange}
          />
        </div>

        {error && <p className="alert alert-error" role="alert">{error}</p>}
        {success && <p className="alert alert-success" role="status">{success}</p>}

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Saving...' : 'Add reading'}
        </button>
      </form>
    </section>
  );
}

export default ReadingForm;