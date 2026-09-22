import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage({ onRegistered }) {
  const { continueWithPassword, checkPasskey, loginPasskey } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);

  const passkeyEmailChecked = useRef('');

  function addDebugLog(message, type = 'info') {
    setDebugLogs((logs) => [...logs.slice(-4), { message, type, time: new Date().toLocaleTimeString() }]);
  }

  async function handleEmailBlur() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      addDebugLog('Email is not valid. Passkey check skipped.');
      return;
    }
    if (passkeyEmailChecked.current === normalizedEmail) return;
    passkeyEmailChecked.current = normalizedEmail;

    addDebugLog('Valid email entered. Checking for this user\'s passkey...');
    try {
      const available = await checkPasskey(normalizedEmail);
      if (!available) {
        addDebugLog('No matching passkey found on this device. Continue with password.');
        return;
      }

      addDebugLog('Matching passkey found. Starting passkey login...');
      await loginPasskey(normalizedEmail);
      addDebugLog('Passkey login completed.', 'success');
    } catch (err) {
      addDebugLog(`Passkey login failed: ${getErrorMessage(err)}`, 'error');
      // Keep password login available after passkey cancellation or failure.
    }
  }

  function getErrorMessage(err) {
    return err.response?.data?.error || err.message || 'Unknown error';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    addDebugLog('Password login started.');
    try {
      const { user, isNewUser } = await continueWithPassword(email, password);
      addDebugLog('Password login completed.', 'success');
      if (isNewUser) onRegistered?.(user);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      addDebugLog(`Password login failed: ${message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="debug-toaster" role="status" aria-live="polite">
        <strong>Passkey debug log</strong>
        {debugLogs.length === 0 && <span>Waiting to start...</span>}
        {debugLogs.map((log, index) => (
          <div key={`${log.time}-${index}`} className={`debug-log ${log.type}`}>
            <time>{log.time}</time> {log.message}
          </div>
        ))}
      </div>

      <h1>Passkey POC</h1>
      <p className="hint">Enter your email and password. New here? We'll create your account automatically.</p>

      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={handleEmailBlur}
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

