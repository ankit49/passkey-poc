import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { enablePasskeyForCurrentUser, deviceHasPasskey } from '../utils/webauthn';

export default function Dashboard() {
  const { user, logout, refreshUser } = useAuth();
  const [checkingDevice, setCheckingDevice] = useState(user.hasPasskey);
  const [deviceEnrolled, setDeviceEnrolled] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user.hasPasskey) {
      setCheckingDevice(false);
      return;
    }
    let cancelled = false;
    deviceHasPasskey(user.credentialIds).then((enrolled) => {
      if (!cancelled) {
        setDeviceEnrolled(enrolled);
        setCheckingDevice(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user.hasPasskey, user.credentialIds]);

  async function handleEnablePasskey() {
    setError('');
    setBusy(true);
    try {
      await enablePasskeyForCurrentUser();
      await refreshUser();
      setDeviceEnrolled(true);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Could not enable passkey.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <h1>Welcome, {user.email}!</h1>
      <p>You're logged in.</p>

      {error && <p className="error">{error}</p>}

      {!checkingDevice && !user.hasPasskey && (
        <button type="button" disabled={busy} onClick={handleEnablePasskey}>
          Enable passkey login
        </button>
      )}

      {!checkingDevice && user.hasPasskey && !deviceEnrolled && (
        <button type="button" disabled={busy} onClick={handleEnablePasskey}>
          Enable passkey on this device
        </button>
      )}

      <button type="button" className="secondary" onClick={logout}>
        Logout
      </button>
    </div>
  );
}
