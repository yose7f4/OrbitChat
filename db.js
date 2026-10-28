const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const path = require('node:path');

const dbPath = path.join(__dirname, 'chat.db');
const db = new DatabaseSync(dbPath);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    secret_token TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    text TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  );
`);

// Prepared statements
const stmtGetUser = db.prepare('SELECT username, secret_token, created_at FROM users WHERE username = ?');
const stmtInsertUser = db.prepare('INSERT INTO users (username, secret_token, created_at) VALUES (?, ?, ?)');
const stmtInsertMsg = db.prepare('INSERT INTO messages (username, text, timestamp) VALUES (?, ?, ?)');
const stmtGetRecentMsgs = db.prepare('SELECT id, username, text, timestamp FROM messages ORDER BY id DESC LIMIT ?');

/**
 * Validates and claims or authenticates a username.
 * Rules:
 * - 1 to 20 characters.
 * - Strict exact match.
 * - Letters, numbers, symbols, spaces, emojis allowed.
 */
function claimOrAuthenticateUser(username, providedSecret = null) {
  if (typeof username !== 'string') {
    return { success: false, error: 'Username must be a valid text string.' };
  }

  const trimmed = username.trim();
  if (trimmed.length < 1 || trimmed.length > 20) {
    return { success: false, error: 'Username must be between 1 and 20 characters long.' };
  }

  const existing = stmtGetUser.get(trimmed);

  if (!existing) {
    // Brand new claim: generate unique private key
    const secretToken = 'key_' + crypto.randomBytes(16).toString('hex');
    const now = Date.now();
    stmtInsertUser.run(trimmed, secretToken, now);

    return {
      success: true,
      isNew: true,
      username: trimmed,
      token: secretToken
    };
  }

  // Username already exists: verify secret token
  if (providedSecret && providedSecret.trim() === existing.secret_token) {
    return {
      success: true,
      isNew: false,
      username: trimmed,
      token: existing.secret_token
    };
  }

  return {
    success: false,
    error: 'This username is already claimed! If this is your username, please provide your private key to continue.'
  };
}

/**
 * Saves a message to the database.
 */
function saveMessage(username, text) {
  if (!username || typeof text !== 'string') return null;
  const cleanText = text.trim();
  if (!cleanText || cleanText.length > 1000) return null;

  const now = Date.now();
  const result = stmtInsertMsg.run(username, cleanText, now);
  return {
    id: Number(result.lastInsertRowid),
    username,
    text: cleanText,
    timestamp: now
  };
}

/**
 * Gets the most recent messages (chronological order).
 */
function getRecentMessages(limit = 100) {
  const rows = stmtGetRecentMsgs.all(limit);
  // rows are DESC, reverse to chronological ASC
  return rows.reverse().map(r => ({
    id: r.id,
    username: r.username,
    text: r.text,
    timestamp: r.timestamp
  }));
}

module.exports = {
  claimOrAuthenticateUser,
  saveMessage,
  getRecentMessages
};
