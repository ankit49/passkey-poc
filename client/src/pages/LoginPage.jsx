import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage({ onRegistered }) {
  const { continueWithPassword, loginPasskey } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const passkeyCheckStarted = useRef(false);

  function handleEmailFocus() {
    if (passkeyCheckStarted.current) return;
    passkeyCheckStarted.current = true;

    loginPasskey().catch(() => {
      // No passkey, unsupported browser, or user cancellation: keep password login available.
    });
  }

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

  return (
    <div className="auth-card">
      <h1>Passkey POC</h1>
      <p className="hint">Enter your email and password. New here? We'll create your account automatically.</p>

      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={handleEmailFocus}
            autoComplete="username"
            required
          />
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

    </div>
  );
}

