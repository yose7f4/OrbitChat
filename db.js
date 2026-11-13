require('dotenv').config();
const crypto = require('node:crypto');
const path = require('node:path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;
let sqliteDb = null;
let stmtGetUser, stmtInsertUser, stmtInsertMsg, stmtGetRecentMsgs;

if (supabaseUrl && supabaseKey) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  const { DatabaseSync } = require('node:sqlite');
  const dbPath = process.env.VERCEL
    ? path.join('/tmp', 'chat.db')
    : path.join(__dirname, 'chat.db');
  sqliteDb = new DatabaseSync(dbPath);

  // Initialize schema
  sqliteDb.exec(`
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
  stmtGetUser = sqliteDb.prepare('SELECT username, secret_token, created_at FROM users WHERE username = ?');
  stmtInsertUser = sqliteDb.prepare('INSERT INTO users (username, secret_token, created_at) VALUES (?, ?, ?)');
  stmtInsertMsg = sqliteDb.prepare('INSERT INTO messages (username, text, timestamp) VALUES (?, ?, ?)');
  stmtGetRecentMsgs = sqliteDb.prepare('SELECT id, username, text, timestamp FROM messages ORDER BY id DESC LIMIT ?');
}

/**
 * Validates and claims or authenticates a username.
 * Rules:
 * - 1 to 20 characters.
 * - Strict exact match.
 * - Letters, numbers, symbols, spaces, emojis allowed.
 */
async function claimOrAuthenticateUser(username, providedSecret = null) {
  if (typeof username !== 'string') {
    return { success: false, error: 'Username must be a valid text string.' };
  }

  const trimmed = username.trim();
  if (trimmed.length < 1 || trimmed.length > 20) {
    return { success: false, error: 'Username must be between 1 and 20 characters long.' };
  }

  if (supabase) {
    const { data: existing, error: fetchErr } = await supabase
      .from('users')
      .select('username, secret_token, created_at')
      .eq('username', trimmed)
      .maybeSingle();

    if (fetchErr) {
      console.error('Supabase fetch error:', fetchErr);
      return { success: false, error: 'Database error occurred. Please try again.' };
    }

    if (!existing) {
      const secretToken = 'key_' + crypto.randomBytes(16).toString('hex');
      const now = Date.now();
      const { error: insertErr } = await supabase
        .from('users')
        .insert({ username: trimmed, secret_token: secretToken, created_at: now });

      if (insertErr) {
        if (insertErr.code === '23505') {
          return {
            success: false,
            error: 'This username is already claimed! If this is your username, please provide your private key to continue.'
          };
        }
        console.error('Supabase insert error:', insertErr);
        return { success: false, error: 'Database error occurred. Please try again.' };
      }

      return {
        success: true,
        isNew: true,
        username: trimmed,
        token: secretToken
      };
    }

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

  // SQLite fallback
  const existing = stmtGetUser.get(trimmed);

  if (!existing) {
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
async function saveMessage(username, text) {
  if (!username || typeof text !== 'string') return null;
  const cleanText = text.trim();
  if (!cleanText || cleanText.length > 1000) return null;

  const now = Date.now();

  if (supabase) {
    const { data, error } = await supabase
      .from('messages')
      .insert({ username, text: cleanText, timestamp: now })
      .select('id, username, text, timestamp')
      .single();

    if (error) {
      console.error('Supabase saveMessage error:', error);
      return null;
    }

    return {
      id: Number(data.id),
      username: data.username,
      text: data.text,
      timestamp: Number(data.timestamp)
    };
  }

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
async function getRecentMessages(limit = 100) {
  if (supabase) {
    const { data, error } = await supabase
      .from('messages')
      .select('id, username, text, timestamp')
      .order('id', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Supabase getRecentMessages error:', error);
      return [];
    }

    return (data || []).reverse().map(r => ({
      id: Number(r.id),
      username: r.username,
      text: r.text,
      timestamp: Number(r.timestamp)
    }));
  }

  const rows = stmtGetRecentMsgs.all(limit);
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
