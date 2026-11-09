import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doctorAPI } from '../api/doctor';

function DoctorPatients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    doctorAPI
      .patients()
      .then((data) => setPatients(data.patients))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <h1 className="page-title">My patients</h1>
      <p className="page-sub">Patients who chose you as their doctor.</p>

      <section className="card">
        {loading && <p className="muted">Loading patients...</p>}

        {error && <p className="alert alert-error" role="alert">{error}</p>}

        {!loading && !error && patients.length === 0 && (
          <p className="empty">
            No patients yet. A patient can pick you from the "My doctor" box on their Readings page.
          </p>
        )}

        {patients.length > 0 && (
          <table className="daily-table patients-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr key={patient.id}>
                  <td>{patient.name}</td>
                  <td className="muted">{patient.email}</td>
                  <td className="table-action">
                    <Link className="btn btn-ghost btn-small" to={`/patients/${patient.id}`}>
                      View reports
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

export default DoctorPatients;