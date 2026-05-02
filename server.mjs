import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.REPLIT_SERVER_PORT || '3001', 10);

app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.get('/api/replit/me', (req, res) => {
  const userId = req.headers['x-replit-user-id'];
  const userName = req.headers['x-replit-user-name'];
  const userRoles = req.headers['x-replit-user-roles'];

  if (!userId) {
    return res.json({ user: null });
  }

  res.json({
    user: {
      id: String(userId),
      name: String(userName || ''),
      roles: String(userRoles || '').split(',').filter(Boolean),
    },
  });
});

app.get('/api/replit/auth', (req, res) => {
  const domain = req.headers['x-forwarded-host'] || req.headers.host || '';
  res.redirect(`https://replit.com/auth_with_repl_site?domain=${domain}`);
});

app.get('/api/replit/signout', (req, res) => {
  res.json({ ok: true });
});

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Replit server running on port ${PORT}`);
});
