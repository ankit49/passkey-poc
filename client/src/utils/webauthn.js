import { startRegistration, base64URLStringToBuffer } from '@simplewebauthn/browser';
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
  const credentialCount = options.allowCredentials?.length || 0;
  if (!credentialCount) return { available: false, credentialCount, reason: 'Server returned no passkeys for this email.' };

  try {
    const credential = await navigator.credentials.get({
      mediation: 'silent',
      publicKey: {
        challenge: base64URLStringToBuffer(options.challenge),
        rpId: window.location.hostname,
        userVerification: 'preferred',
        timeout: 2500,
        allowCredentials: options.allowCredentials.map(({ id, transports }) => ({
          id: base64URLStringToBuffer(id),
          type: 'public-key',
          transports,
        })),
      },
    });
    return {
      available: Boolean(credential),
      credentialCount,
      reason: credential ? 'Matching passkey returned by the browser.' : 'Browser returned no matching credential.',
      requestId: options.requestId,
      response: credential ? credentialToJSON(credential) : null,
    };
  } catch (error) {
    return {
      available: false,
      credentialCount,
      reason: `${error.name || 'WebAuthn error'}: ${error.message || 'silent request rejected'}`,
    };
  }
}

// Verifies the assertion already returned by the availability check.
export async function loginWithPasskey(checkResult) {
  const { data } = await api.post('/passkey/authentication/verify', {
    requestId: checkResult.requestId,
    response: checkResult.response,
  });
  return data;
}

function credentialToJSON(credential) {
  const response = credential.response;
  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      authenticatorData: bufferToBase64Url(response.authenticatorData),
      signature: bufferToBase64Url(response.signature),
      userHandle: response.userHandle ? bufferToBase64Url(response.userHandle) : null,
    },
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment,
  };
}

function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
