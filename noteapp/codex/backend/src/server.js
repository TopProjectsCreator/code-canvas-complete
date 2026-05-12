import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import db from './db.js';
import { authMiddleware, signToken } from './auth.js';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' },
});

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_, res) => res.json({ ok: true }));

app.post('/auth/signup', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Email and password (min 6 chars) required' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, hash);
  const user = { id: result.lastInsertRowid, email };
  const token = signToken(user);
  return res.status(201).json({ token, user });
});

app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = signToken({ id: user.id, email: user.email });
  return res.json({ token, user: { id: user.id, email: user.email } });
});

app.get('/notes', authMiddleware, (req, res) => {
  const notes = db.prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC').all(req.user.id);
  res.json(notes.map((n) => ({ ...n, tags: JSON.parse(n.tags) })));
});

app.post('/notes', authMiddleware, (req, res) => {
  const { title = 'Untitled', content = '', color = '#ffffff', tags = [] } = req.body;
  const result = db
    .prepare('INSERT INTO notes (user_id, title, content, color, tags) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.id, title, content, color, JSON.stringify(tags));

  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid);
  const payload = { ...note, tags: JSON.parse(note.tags) };
  io.to(`user-${req.user.id}`).emit('note:created', payload);
  res.status(201).json(payload);
});

app.put('/notes/:id', authMiddleware, (req, res) => {
  const note = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });

  const { title = note.title, content = note.content, color = note.color, tags = JSON.parse(note.tags) } = req.body;
  db.prepare('UPDATE notes SET title = ?, content = ?, color = ?, tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(title, content, color, JSON.stringify(tags), req.params.id);

  const updated = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  const payload = { ...updated, tags: JSON.parse(updated.tags) };
  io.to(`user-${req.user.id}`).emit('note:updated', payload);
  res.json(payload);
});

app.delete('/notes/:id', authMiddleware, (req, res) => {
  const result = db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (!result.changes) return res.status(404).json({ error: 'Note not found' });
  io.to(`user-${req.user.id}`).emit('note:deleted', Number(req.params.id));
  res.status(204).send();
});

io.use((socket, next) => {
  const userId = socket.handshake.auth?.userId;
  if (!userId) return next(new Error('Unauthorized'));
  socket.userId = userId;
  return next();
});

io.on('connection', (socket) => {
  socket.join(`user-${socket.userId}`);
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`API listening on ${PORT}`));
