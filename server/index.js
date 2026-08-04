import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './src/routes/auth.routes.js';
import passkeyRoutes from './src/routes/passkey.routes.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.ORIGIN, credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/passkey', passkeyRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Passkey POC server listening on http://localhost:${PORT}`);
});
