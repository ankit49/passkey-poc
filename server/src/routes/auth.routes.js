import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createUser, findUserByEmail, findUserById, getCredentialsByUserId } from '../store.js';
import { signToken, requireAuth } from '../auth.js';

const router = Router();

function toPublicUser(user) {
  const creds = getCredentialsByUserId(user.id);
  return {
    id: user.id,
    email: user.email,
    hasPasskey: creds.length > 0,
    credentialIds: creds.map((c) => c.id),
  };
}

// Single combined flow: logs the user in if the email is registered,
// otherwise creates a new account with the submitted password.
router.post('/continue', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Email and a password of at least 8 characters are required' });
  }

  const existingUser = findUserByEmail(email);

  if (existingUser) {
    if (!(await bcrypt.compare(password, existingUser.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = signToken(existingUser);
    return res.json({ token, user: toPublicUser(existingUser), isNewUser: false });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = createUser({ email, passwordHash });
  const token = signToken(newUser);
  res.status(201).json({ token, user: toPublicUser(newUser), isNewUser: true });
});

router.get('/me', requireAuth, (req, res) => {
  const user = findUserById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: toPublicUser(user) });
});

export default router;
