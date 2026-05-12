import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import db from './db.js';
import { authRequired, signToken } from './auth.js';

const app = express();
app.use(cors());
app.use(express.json());
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

const activeUsers = new Set();
const emitPresence = () => io.emit('presence:update', { inTheZone: activeUsers.size });

io.on('connection', (socket) => {
  socket.on('zone:join', (userId) => {
    socket.userId = userId;
    activeUsers.add(userId);
    emitPresence();
  });
  socket.on('disconnect', () => {
    if (socket.userId) activeUsers.delete(socket.userId);
    emitPresence();
  });
});

app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body;
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const result = db.prepare('INSERT INTO users (email,password_hash) VALUES (?,?)').run(email, passwordHash);
    const user = { id: result.lastInsertRowid, email };
    res.json({ token: signToken(user), user });
  } catch {
    res.status(400).json({ error: 'Email already exists' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Invalid creds' });
  res.json({ token: signToken(user), user: { id: user.id, email: user.email } });
});

app.get('/api/lessons', authRequired, (req, res) => {
  const lessons = db.prepare('SELECT id,title,markdown FROM lessons').all();
  res.json(lessons);
});

app.post('/api/lessons/:id/complete', authRequired, (req, res) => {
  db.prepare('INSERT INTO lesson_progress (user_id, lesson_id, completed_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id,lesson_id) DO UPDATE SET completed_at=CURRENT_TIMESTAMP').run(req.user.sub, req.params.id);
  res.json({ ok: true });
});

app.post('/api/sessions/start', authRequired, (req, res) => {
  const result = db.prepare('INSERT INTO study_sessions (user_id, started_at) VALUES (?,CURRENT_TIMESTAMP)').run(req.user.sub);
  io.emit('heatmap:update');
  res.json({ sessionId: result.lastInsertRowid });
});
app.post('/api/sessions/:id/end', authRequired, (req, res) => {
  db.prepare('UPDATE study_sessions SET ended_at=CURRENT_TIMESTAMP, focus_score=? WHERE id=? AND user_id=?').run(req.body.focusScore || 1, req.params.id, req.user.sub);
  io.emit('heatmap:update');
  res.json({ ok: true });
});
app.get('/api/sessions/heatmap', authRequired, (req, res) => {
  const rows = db.prepare(`SELECT date(started_at) day, COUNT(*) count FROM study_sessions WHERE user_id=? GROUP BY day`).all(req.user.sub);
  res.json(rows);
});

app.get('/api/flashcards/due', authRequired, (req, res) => {
  const card = db.prepare('SELECT * FROM flashcards WHERE user_id=? AND due_at<=CURRENT_TIMESTAMP ORDER BY due_at LIMIT 1').get(req.user.sub);
  res.json(card || null);
});
app.post('/api/flashcards', authRequired, (req, res) => {
  const { prompt, answer } = req.body;
  const result = db.prepare('INSERT INTO flashcards (user_id,prompt,answer,due_at,interval_days) VALUES (?,?,?,CURRENT_TIMESTAMP,1)').run(req.user.sub, prompt, answer);
  res.json({ id: result.lastInsertRowid });
});
app.post('/api/flashcards/:id/review', authRequired, (req, res) => {
  const { rating } = req.body;
  const card = db.prepare('SELECT * FROM flashcards WHERE id=? AND user_id=?').get(req.params.id, req.user.sub);
  if (!card) return res.status(404).json({ error: 'Not found' });
  const interval = rating === 'easy' ? card.interval_days * 2 : Math.max(1, Math.floor(card.interval_days / 2));
  db.prepare("UPDATE flashcards SET interval_days=?, due_at=datetime('now', '+' || ? || ' day') WHERE id=?").run(interval, interval, card.id);
  res.json({ nextInDays: interval });
});

httpServer.listen(4000, () => console.log('server on 4000'));
