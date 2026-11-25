import Database from 'better-sqlite3'
import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

let db: Database.Database | null = null

export function dbPath(): string {
  // 测试/自检可重定向数据库位置
  return process.env.LEXIAOEN_DB_PATH ?? join(app.getPath('userData'), 'lexiaoen.db')
}

export function initDb(): Database.Database {
  if (db) return db
  mkdirSync(app.getPath('userData'), { recursive: true })
  db = new Database(dbPath())
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

/** 迁移用 PRAGMA user_version 驱动,只前进不回退 */
function migrate(d: Database.Database): void {
  const version = d.pragma('user_version', { simple: true }) as number
  if (version < 1) {
    d.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)
    d.pragma('user_version = 1')
  }
  if (version < 2) {
    d.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id               TEXT PRIMARY KEY,
        title            TEXT NOT NULL,
        mode             TEXT NOT NULL CHECK (mode IN ('fast','standard','quality')),
        learner_snapshot TEXT NOT NULL DEFAULT '',
        created_at       INTEGER NOT NULL,
        updated_at       INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id        TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        role              TEXT NOT NULL CHECK (role IN ('user','assistant')),
        content           TEXT NOT NULL,
        reasoning         TEXT NOT NULL DEFAULT '',
        status            INTEGER NOT NULL DEFAULT 0 CHECK (status IN (0,1,2)),
        model             TEXT,
        prompt_tokens     INTEGER,
        completion_tokens INTEGER,
        cache_hit         INTEGER,
        cache_miss        INTEGER,
        ttft_ms           INTEGER,
        total_ms          INTEGER,
        created_at        INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, id);
    `)
    d.pragma('user_version = 2')
  }
  if (version < 3) {
    // M3 记忆层:考纲树 / 知识卡 / FTS5 检索(注记 A:jieba 预分词后空格写入,unicode61 分词器)
    // / 测验题 / FSRS 复习卡(调度状态序列化存 fsrs 列,due_ms 冗余供队列索引)
    d.exec(`
      CREATE TABLE IF NOT EXISTS syllabus_nodes (
        id          TEXT PRIMARY KEY,
        parent_id   TEXT REFERENCES syllabus_nodes(id) ON DELETE CASCADE,
        subject     TEXT NOT NULL CHECK (subject IN ('anatomy','physiology')),
        level       INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
        title       TEXT NOT NULL,
        requirement TEXT,
        bloom       TEXT,
        sort        INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_nodes_parent ON syllabus_nodes(parent_id, sort);

      CREATE TABLE IF NOT EXISTS knowledge_cards (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id    TEXT NOT NULL REFERENCES syllabus_nodes(id) ON DELETE CASCADE,
        title      TEXT NOT NULL,
        definition TEXT NOT NULL DEFAULT '',
        points     TEXT NOT NULL DEFAULT '[]',
        confusion  TEXT NOT NULL DEFAULT '',
        mnemonic   TEXT NOT NULL DEFAULT '',
        source     TEXT NOT NULL DEFAULT 'seed' CHECK (source IN ('seed','ai','user')),
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cards_node ON knowledge_cards(node_id);

      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
        card_id UNINDEXED,
        title,
        body
      );

      CREATE TABLE IF NOT EXISTS quiz_questions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id     TEXT REFERENCES syllabus_nodes(id) ON DELETE SET NULL,
        qtype       TEXT NOT NULL CHECK (qtype IN ('single','multiple','blank','term','short','essay','case')),
        bloom       TEXT NOT NULL DEFAULT '记忆',
        stem        TEXT NOT NULL,
        options     TEXT NOT NULL DEFAULT '[]',
        answer      TEXT NOT NULL,
        explanation TEXT NOT NULL DEFAULT '',
        created_at  INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS review_cards (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        kind        TEXT NOT NULL CHECK (kind IN ('wrong','knowledge')),
        question_id INTEGER REFERENCES quiz_questions(id) ON DELETE CASCADE,
        card_id     INTEGER REFERENCES knowledge_cards(id) ON DELETE CASCADE,
        due_ms      INTEGER NOT NULL,
        fsrs        TEXT NOT NULL,
        created_at  INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_review_wrong ON review_cards(question_id) WHERE kind = 'wrong';
      CREATE UNIQUE INDEX IF NOT EXISTS idx_review_knowledge ON review_cards(card_id) WHERE kind = 'knowledge';
      CREATE INDEX IF NOT EXISTS idx_review_due ON review_cards(due_ms);

      CREATE TABLE IF NOT EXISTS review_logs (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        review_card_id INTEGER NOT NULL REFERENCES review_cards(id) ON DELETE CASCADE,
        grade          INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 4),
        reviewed_at    INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_review_logs_card ON review_logs(review_card_id, id);
    `)
    d.pragma('user_version = 3')
  }
  if (version < 4) {
    // M4:仪表盘答题记录 + 教材导入(《详细方案》六-4/5;FTS 同注记 A:jieba 预分词写入)
    d.exec(`
      CREATE TABLE IF NOT EXISTS quiz_attempts (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id    TEXT REFERENCES syllabus_nodes(id) ON DELETE SET NULL,
        qtype      TEXT,
        bloom      TEXT,
        correct    INTEGER NOT NULL CHECK (correct IN (0,1)),
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_attempts_node ON quiz_attempts(node_id);
      CREATE INDEX IF NOT EXISTS idx_attempts_time ON quiz_attempts(created_at);

      CREATE TABLE IF NOT EXISTS textbook_docs (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        title      TEXT NOT NULL,
        pages      INTEGER NOT NULL DEFAULT 0,
        chunks     INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS textbook_chunks (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_id  INTEGER NOT NULL REFERENCES textbook_docs(id) ON DELETE CASCADE,
        page    INTEGER NOT NULL,
        body    TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chunks_doc ON textbook_chunks(doc_id, id);

      CREATE VIRTUAL TABLE IF NOT EXISTS textbook_fts USING fts5(
        chunk_id UNINDEXED,
        body
      );
    `)
    d.pragma('user_version = 4')
  }
  if (version < 5) {
    // M4:对话 L4 引用随消息落库(answers 气泡持久展示出处,非仅流式期间)
    d.exec('ALTER TABLE messages ADD COLUMN sources TEXT')
    d.pragma('user_version = 5')
  }
}

export function getSetting(key: string): string | null {
  const row = initDb()
    .prepare('SELECT value FROM app_settings WHERE key = ?')
    .get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setSetting(key: string, value: string): void {
  initDb()
    .prepare('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value)
}

export function deleteSetting(key: string): void {
  initDb().prepare('DELETE FROM app_settings WHERE key = ?').run(key)
}

export function pingDb(): { ok: boolean; sqlite: string; userVersion: number; path: string; error: string | null } {
  try {
    const d = initDb()
    const row = d.prepare('SELECT sqlite_version() AS v').get() as { v: string }
    return { ok: true, sqlite: row.v, userVersion: d.pragma('user_version', { simple: true }) as number, path: dbPath(), error: null }
  } catch (e) {
    // native 模块 ABI 不匹配会在这里暴露(《详细方案》工程注记 B)
    return { ok: false, sqlite: '', userVersion: -1, path: dbPath(), error: String(e) }
  }
}

export function closeDb(): void {
  try {
    db?.close()
  } finally {
    db = null
  }
}
