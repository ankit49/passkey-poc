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

// Logs a user in using a discoverable passkey - no email needed, the browser
// prompts the user to pick from any passkey it holds for this site.
export async function loginWithPasskey() {
  const { data: options } = await api.post('/passkey/authentication/options');
  const assertionResponse = await startAuthentication({ optionsJSON: options });
  const { data } = await api.post('/passkey/authentication/verify', {
    requestId: options.requestId,
    response: assertionResponse,
  });
  return data;
}

/**
 * Heuristic-only check for whether this device already holds one of the given
 * discoverable credentials, using `mediation: 'silent'` so the user is never
 * prompted. Only reliable on Chromium-based browsers - WebKit (Safari/iOS)
 * doesn't honor silent mediation and shows the passkey sheet regardless, so we
 * skip the probe there and conservatively assume the device is not enrolled.
 */
function supportsSilentMediation() {
  const ua = navigator.userAgent;
  const isWebKit = /iPad|iPhone|iPod/.test(ua) || (/Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua));
  return !isWebKit;
}

export async function deviceHasPasskey(credentialIds) {
  if (!credentialIds || credentialIds.length === 0) return false;
  if (!window.PublicKeyCredential || !navigator.credentials?.get) return false;
  if (!supportsSilentMediation()) return false;

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
