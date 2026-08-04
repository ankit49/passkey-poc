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
  setChallenge,
  getChallenge,
  clearChallenge,
} from '../store.js';
import { requireAuth, signToken } from '../auth.js';

const router = Router();

const rpName = process.env.RP_NAME;
const rpID = process.env.RP_ID;
const origin = process.env.ORIGIN;

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

  const expectedChallenge = getChallenge(`reg:${user.id}`);
  if (!expectedChallenge) {
    return res.status(400).json({ error: 'Registration challenge expired or not found. Please try again.' });
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: req.body,
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

export default router;
