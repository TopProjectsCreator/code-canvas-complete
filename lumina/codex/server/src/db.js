import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('db/lumina.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  markdown TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id INTEGER NOT NULL,
  lesson_id INTEGER NOT NULL,
  completed_at TEXT,
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS study_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  focus_score INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS flashcards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  answer TEXT NOT NULL,
  due_at TEXT NOT NULL,
  interval_days INTEGER DEFAULT 1
);
`);

const lessonCount = db.prepare('SELECT COUNT(*) AS c FROM lessons').get().c;
if (lessonCount === 0) {
  db.prepare('INSERT INTO lessons (title, markdown) VALUES (?,?)').run(
    'Neural Focus Fundamentals',
    '# Deep Work\n\nFocus in 25-minute blocks and review with active recall.'
  );
}

export default db;
