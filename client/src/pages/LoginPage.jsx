import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage({ onRegistered }) {
  const { continueWithPassword, loginPasskey } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { user, isNewUser } = await continueWithPassword(email, password);
      if (isNewUser) onRegistered?.(user);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePasskeyLogin() {
    setError('');
    setBusy(true);
    try {
      await loginPasskey();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Passkey login failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <h1>Passkey POC</h1>
      <p className="hint">Enter your email and password. New here? We'll create your account automatically.</p>

      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={busy}>
          Continue
        </button>
      </form>

      <button type="button" className="secondary" disabled={busy} onClick={handlePasskeyLogin}>
        Login with passkey
      </button>
    </div>
  );
}

