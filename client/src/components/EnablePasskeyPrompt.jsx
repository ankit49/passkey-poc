import { useState } from 'react';
import { enablePasskeyForCurrentUser } from '../utils/webauthn';

export default function EnablePasskeyPrompt({ onDone }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleEnable() {
    setError('');
    setBusy(true);
    try {
      await enablePasskeyForCurrentUser();
      onDone();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Could not enable passkey.');
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <h2>Enable passkey login?</h2>
      <p>Sign in faster next time using your device's fingerprint, face, or screen lock instead of a password.</p>
      {error && <p className="error">{error}</p>}
      <button type="button" disabled={busy} onClick={handleEnable}>
        Enable passkey
      </button>
      <button type="button" className="secondary" disabled={busy} onClick={onDone}>
        Skip for now
      </button>
    </div>
  );
}
