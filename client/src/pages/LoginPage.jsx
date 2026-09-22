import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage({ onRegistered }) {
  const { continueWithPassword, checkPasskey, loginPasskey } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);

  const passkeyAvailable = useRef(false);
  const passkeyLoginStarted = useRef(false);
  const passkeyCheck = useRef(Promise.resolve(false));

  function addDebugLog(message, type = 'info') {
    setDebugLogs((logs) => [...logs.slice(-4), { message, type, time: new Date().toLocaleTimeString() }]);
  }

  useEffect(() => {
    addDebugLog('Step 1: checking for a passkey silently...');
    passkeyCheck.current = checkPasskey()
      .then((available) => {
        passkeyAvailable.current = available;
        addDebugLog(available ? 'Passkey found. Waiting for email-field focus.' : 'No passkey found. Staying silent.');
        return available;
      })
      .catch((err) => {
        passkeyAvailable.current = false;
        addDebugLog(`Silent check failed: ${getErrorMessage(err)}`, 'error');
        return false;
      });
  }, [checkPasskey]);

  async function handleEmailFocus() {
    if (passkeyLoginStarted.current) return;
    passkeyLoginStarted.current = true;

    addDebugLog('Email focused. Waiting for silent check to finish.');
    await passkeyCheck.current;
    if (!passkeyAvailable.current) {
      addDebugLog('No passkey available. Passkey login not started.');
      return;
    }

    addDebugLog('Step 2: starting passkey login...');
    loginPasskey()
      .then(() => addDebugLog('Passkey login completed.', 'success'))
      .catch((err) => {
        addDebugLog(`Passkey login failed: ${getErrorMessage(err)}`, 'error');
        // Keep password login available after passkey cancellation or failure.
      });
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

