import { Router } from 'express';
import { randomUUID } from 'crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import {
  findUserById,
  getCredentialsByUserId,
  getCredentialById,
  saveCredential,
  updateCredentialCounter,
  renameCredential,
  deleteCredential,
  setChallenge,
  getChallenge,
  clearChallenge,
} from '../store.js';
import { requireAuth, signToken } from '../auth.js';

const router = Router();

const rpName = process.env.RP_NAME;
const rpID = process.env.RP_ID;
const origin = process.env.ORIGIN;

// Best-effort, human-friendly default name for a newly registered passkey.
function guessDeviceName(userAgent = '') {
  if (/iPhone/.test(userAgent)) return 'iPhone';
  if (/iPad/.test(userAgent)) return 'iPad';
  if (/Android/.test(userAgent)) return 'Android device';
  if (/Macintosh/.test(userAgent)) return 'Mac';
  if (/Windows/.test(userAgent)) return 'Windows PC';
  return 'Passkey';
}

function toPublicCredential(credential) {
  return {
    id: credential.id,
    name: credential.name,
    deviceType: credential.deviceType,
    backedUp: credential.backedUp,
    createdAt: credential.createdAt,
  };
}

// Step 1: logged-in user requests options to register a new passkey (initial or additional device).
router.post('/registration/options', requireAuth, async (req, res) => {
  const user = findUserById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const userPasskeys = getCredentialsByUserId(user.id);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email,
    attestationType: 'none',
    excludeCredentials: userPasskeys.map((passkey) => ({
      id: passkey.id,
      transports: passkey.transports,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  setChallenge(`reg:${user.id}`, options.challenge);
  res.json(options);
});

// Step 2: verify the authenticator's registration response and persist the new credential.
router.post('/registration/verify', requireAuth, async (req, res) => {
  const user = findUserById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { name, response } = req.body || {};

  const expectedChallenge = getChallenge(`reg:${user.id}`);
  if (!expectedChallenge) {
    return res.status(400).json({ error: 'Registration challenge expired or not found. Please try again.' });
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  clearChallenge(`reg:${user.id}`);

  if (!verification.verified || !verification.registrationInfo) {
    return res.status(400).json({ error: 'Passkey registration could not be verified' });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  saveCredential({
    id: credential.id,
    userId: user.id,
    name: (name || '').trim() || guessDeviceName(req.headers['user-agent']),
    publicKey: credential.publicKey,
    counter: credential.counter,
    transports: credential.transports,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    createdAt: new Date().toISOString(),
  });

  res.json({ verified: true });
});

// Step 1: no identifier needed - options omit allowCredentials so the browser/authenticator
// presents any discoverable (resident-key) passkey it holds for this RP.
router.post('/authentication/options', async (req, res) => {
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
  });

  const requestId = randomUUID();
  setChallenge(`auth:${requestId}`, options.challenge);
  res.json({ ...options, requestId });
});

// Step 2: verify the authenticator's assertion; the credential itself tells us which user signed in.
router.post('/authentication/verify', async (req, res) => {
  const { requestId, response } = req.body || {};
  if (!requestId || !response) return res.status(400).json({ error: 'requestId and response are required' });

  const expectedChallenge = getChallenge(`auth:${requestId}`);
  if (!expectedChallenge) {
    return res.status(400).json({ error: 'Authentication challenge expired or not found. Please try again.' });
  }

  const passkey = getCredentialById(response.id);
  if (!passkey) {
    return res.status(400).json({ error: 'Passkey not recognized' });
  }

  const user = findUserById(passkey.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.id,
        publicKey: passkey.publicKey,
        counter: passkey.counter,
        transports: passkey.transports,
      },
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  clearChallenge(`auth:${requestId}`);

  if (!verification.verified) {
    return res.status(400).json({ error: 'Passkey authentication could not be verified' });
  }

  updateCredentialCounter(passkey.id, verification.authenticationInfo.newCounter);

  const token = signToken(user);
  const creds = getCredentialsByUserId(user.id);
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      hasPasskey: creds.length > 0,
      credentialIds: creds.map((c) => c.id),
    },
  });
});

// List the logged-in user's registered passkeys.
router.get('/credentials', requireAuth, (req, res) => {
  const credentials = getCredentialsByUserId(req.userId).map(toPublicCredential);
  res.json({ credentials });
});

// Rename a passkey owned by the logged-in user.
router.patch('/credentials/:credentialId', requireAuth, (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

  const credential = getCredentialById(req.params.credentialId);
  if (!credential || credential.userId !== req.userId) {
    return res.status(404).json({ error: 'Passkey not found' });
  }

  renameCredential(credential.id, name.trim());
  res.json({ credential: toPublicCredential(credential) });
});

// Delete a passkey owned by the logged-in user.
router.delete('/credentials/:credentialId', requireAuth, (req, res) => {
  const credential = getCredentialById(req.params.credentialId);
  if (!credential || credential.userId !== req.userId) {
    return res.status(404).json({ error: 'Passkey not found' });
  }

  deleteCredential(credential.id);
  res.json({ deleted: true });
});

export default router;
