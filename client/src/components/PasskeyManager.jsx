import { useEffect, useState } from 'react';
import { enablePasskeyForCurrentUser, listPasskeys, renamePasskey, deletePasskey } from '../utils/webauthn';

export default function PasskeyManager({ onChange }) {
  const [passkeys, setPasskeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setPasskeys(await listPasskeys());
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load passkeys.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd() {
    setError('');
    setAdding(true);
    try {
      await enablePasskeyForCurrentUser(newName.trim());
      setNewName('');
      await load();
      await onChange?.();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Could not add passkey.');
    } finally {
      setAdding(false);
    }
  }

  async function handleRename(id) {
    if (!editingName.trim()) return;
    setError('');
    setBusyId(id);
    try {
      await renamePasskey(id, editingName.trim());
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not rename passkey.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Remove this passkey? You will no longer be able to sign in with it.')) return;
    setError('');
    setBusyId(id);
    try {
      await deletePasskey(id);
      await load();
      await onChange?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not delete passkey.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="passkey-manager">
      <h2>Your passkeys</h2>
      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="hint">Loading passkeys…</p>
      ) : passkeys.length === 0 ? (
        <p className="hint">No passkeys registered yet.</p>
      ) : (
        <ul className="passkey-list">
          {passkeys.map((passkey) => (
            <li key={passkey.id} className="passkey-row">
              {editingId === passkey.id ? (
                <>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    disabled={busyId === passkey.id}
                  />
                  <div className="passkey-row-actions">
                    <button type="button" disabled={busyId === passkey.id} onClick={() => handleRename(passkey.id)}>
                      Save
                    </button>
                    <button type="button" className="secondary" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="passkey-name">{passkey.name}</span>
                  <div className="passkey-row-actions">
                    <button
                      type="button"
                      className="secondary"
                      disabled={busyId === passkey.id}
                      onClick={() => {
                        setEditingId(passkey.id);
                        setEditingName(passkey.name);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={busyId === passkey.id}
                      onClick={() => handleDelete(passkey.id)}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="passkey-add">
        <input
          type="text"
          placeholder="Name this passkey (optional)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          disabled={adding}
        />
        <button type="button" disabled={adding} onClick={handleAdd}>
          Add a passkey
        </button>
      </div>
    </div>
  );
}
