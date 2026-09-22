import { startRegistration, startAuthentication, base64URLStringToBuffer } from '@simplewebauthn/browser';
import api from '../api/client';

// Registers a new passkey for the currently logged-in user (initial device or an additional one).
export async function enablePasskeyForCurrentUser(name) {
  const { data: options } = await api.post('/passkey/registration/options');
  const attestationResponse = await startRegistration({ optionsJSON: options });
  const { data } = await api.post('/passkey/registration/verify', { name, response: attestationResponse });
  return data;
}

// Lists the current user's registered passkeys.
export async function listPasskeys() {
  const { data } = await api.get('/passkey/credentials');
  return data.credentials;
}

// Renames a passkey owned by the current user.
export async function renamePasskey(credentialId, name) {
  const { data } = await api.patch(`/passkey/credentials/${credentialId}`, { name });
  return data.credential;
}

// Deletes a passkey owned by the current user.
export async function deletePasskey(credentialId) {
  await api.delete(`/passkey/credentials/${credentialId}`);
}

export async function checkPasskeyForEmail(email) {
  const { data: options } = await api.post('/passkey/authentication/options', { email });
  if (!options.allowCredentials?.length) return false;

  try {
    const credential = await navigator.credentials.get({
      mediation: 'silent',
      publicKey: {
        challenge: base64URLStringToBuffer(options.challenge),
        rpId: window.location.hostname,
        userVerification: 'preferred',
        timeout: 2500,
        allowCredentials: options.allowCredentials,
      },
    });
    return Boolean(credential);
  } catch {
    return false;
  }
}

// Starts passkey login for the already-validated account.
export async function loginWithPasskey(email) {
  const { data: options } = await api.post('/passkey/authentication/options', { email });
  const assertionResponse = await startAuthentication({
    optionsJSON: options,
  });
  const { data } = await api.post('/passkey/authentication/verify', {
    requestId: options.requestId,
    response: assertionResponse,
  });
  return data;
}

export async function deviceHasListedPasskey(credentialIds) {
  if (!credentialIds || credentialIds.length === 0) return false;
  if (!window.PublicKeyCredential || !navigator.credentials?.get) return false;

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const credential = await navigator.credentials.get({
      mediation: 'silent',
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        userVerification: 'preferred',
        timeout: 2500,
        allowCredentials: credentialIds.map((id) => ({
          id: base64URLStringToBuffer(id),
          type: 'public-key',
        })),
      },
    });
    return Boolean(credential);
  } catch {
    return false;
  }
}
