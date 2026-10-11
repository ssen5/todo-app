const path = require('path');
const Database = require('better-sqlite3');

// Open the DB created by create_todo_db.py (keep todo.db next to this file)
const db = new Database(path.join(__dirname, 'todo.db'));

// SQLite ignores foreign keys unless this is on for every connection
db.pragma('foreign_keys = ON');

module.exports = db;