import { useEffect, useState } from 'react';
import { usersAPI } from '../api/doctor';
import { useAuth } from '../context/AuthContext';

// Lets a patient choose which doctor can see their reports (or nobody).
function DoctorPicker() {
  const { user, updateUser } = useAuth();

  const [doctors, setDoctors] = useState([]);
  const [selected, setSelected] = useState(user.doctor_id ? String(user.doctor_id) : '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    usersAPI
      .listDoctors()
      .then((data) => setDoctors(data.doctors))
      .catch((err) => setError(err.message));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);

    try {
      const doctorId = selected === '' ? null : Number(selected);

      await usersAPI.setMyDoctor(doctorId);
      updateUser({ doctor_id: doctorId });

      setMessage(
        doctorId === null
          ? 'No doctor can see your reports now.'
          : 'Saved. Your doctor can now see your reports.'
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      <h2>My doctor</h2>
      <p className="muted small-text">
        The doctor you pick can view your reports. You can change or remove them any time.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="doctor">Doctor</label>
          <select
            id="doctor"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            <option value="">No one</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="alert alert-error" role="alert">{error}</p>}
        {message && <p className="alert alert-success" role="status">{message}</p>}

        <button type="submit" className="btn btn-ghost btn-block" disabled={saving}>
          {saving ? 'Saving...' : 'Save doctor'}
        </button>
      </form>
    </section>
  );
}

export default DoctorPicker;