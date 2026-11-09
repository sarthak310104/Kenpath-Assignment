import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isDoctor, setIsDoctor] = useState(false);
  const [error, setError] = useState('');
  const [waitingMessage, setWaitingMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const data = await register({
        name,
        email,
        password,
        role: isDoctor ? 'doctor' : 'patient',
      });

      if (data.pending) {
        setWaitingMessage(data.message);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (waitingMessage) {
    return (
      <main className="auth-page">
        <div className="card auth-card">
          <p className="brand brand-center">Sweety</p>
          <h1>Thanks, {name.trim()}</h1>
          <p className="alert alert-success" role="status">{waitingMessage}</p>
          <p className="muted">
            Once your profile is approved you can log in with the email and
            password you just used.
          </p>
          <p className="auth-switch">
            <Link to="/login">Back to log in</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <div className="card auth-card">
        <p className="brand brand-center">Sweety</p>
        <h1>Create your account</h1>
        <p className="muted">Start tracking your blood glucose.</p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <span className="hint">At least 8 characters.</span>
          </div>

          <label className="check">
            <input
              type="checkbox"
              checked={isDoctor}
              onChange={(event) => setIsDoctor(event.target.checked)}
            />
            <span>I'm a doctor and want to view my patients' reports</span>
          </label>

          {error && <p className="alert alert-error" role="alert">{error}</p>}

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Creating account...' : 'Sign up'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </main>
  );
}

export default Signup;