// In-memory data store for this POC. Data resets whenever the server restarts.
import { randomUUID } from 'crypto';

const users = new Map(); // id -> { id, email, passwordHash, createdAt }
const usersByEmail = new Map(); // email -> id
const credentials = new Map(); // credentialId (base64url) -> { id, userId, publicKey, counter, transports, deviceType, backedUp }
const challenges = new Map(); // key -> { challenge, expiresAt }

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export function createUser({ email, passwordHash }) {
  const id = randomUUID();
  const user = { id, email, passwordHash, createdAt: new Date().toISOString() };
  users.set(id, user);
  usersByEmail.set(email.toLowerCase(), id);
  return user;
}

export function findUserByEmail(email) {
  const id = usersByEmail.get(email.toLowerCase());
  return id ? users.get(id) : undefined;
}

export function findUserById(id) {
  return users.get(id);
}

export function getCredentialsByUserId(userId) {
  return [...credentials.values()].filter((c) => c.userId === userId);
}

export function getCredentialById(credentialId) {
  return credentials.get(credentialId);
}

export function saveCredential(credential) {
  credentials.set(credential.id, credential);
  return credential;
}

export function updateCredentialCounter(credentialId, counter) {
  const cred = credentials.get(credentialId);
  if (cred) cred.counter = counter;
}

export function setChallenge(key, challenge) {
  challenges.set(key, { challenge, expiresAt: Date.now() + CHALLENGE_TTL_MS });
}

export function getChallenge(key) {
  const entry = challenges.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    challenges.delete(key);
    return undefined;
  }
  return entry.challenge;
}

export function clearChallenge(key) {
  challenges.delete(key);
}
