import { startRegistration, startAuthentication, base64URLStringToBuffer } from '@simplewebauthn/browser';
import api from '../api/client';

// Registers a new passkey for the currently logged-in user (initial device or an additional one).
export async function enablePasskeyForCurrentUser() {
  const { data: options } = await api.post('/passkey/registration/options');
  const attestationResponse = await startRegistration({ optionsJSON: options });
  const { data } = await api.post('/passkey/registration/verify', attestationResponse);
  return data;
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
 * prompted. Supported in Chromium-based browsers; other browsers reject/throw,
 * in which case we conservatively assume the device is not enrolled.
 */
export async function deviceHasPasskey(credentialIds) {
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
