require('dotenv').config(); // loads PORT and HOST from the .env file
const express = require('express');
const db = require('./db');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const app = express();
app.use(express.json()); // lets us read JSON from req.body

// If a request has no body at all, use an empty object so nothing crashes
app.use((req, res, next) => {
  req.body = req.body || {};
  next();
});

// ---------- Sample endpoints ----------
app.get('/', (req, res) => {
  res.send('Hello World, First Time using AWS');
});

app.get('/health', (req, res) => {
  res.send('Health status is OK');
});

// ---------- Create account ----------
// body: { name, username, password }
app.post('/register', (req, res) => {
  const { name, username, password } = req.body;

  if (!name || !username || !password) {
    return res.status(400).json({ error: 'name, username and password are required' });
  }

  const existing = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ error: 'Username already taken' });
  }

  const result = db
    .prepare('INSERT INTO users (name, username, password) VALUES (?, ?, ?)')
    .run(name, username, password);

  res.json({ message: 'Account created', user_id: result.lastInsertRowid });
});

// ---------- Login ----------
// body: { username, password }
// Returns the user_id (you need it to create tasks).
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const user = db
    .prepare('SELECT * FROM users WHERE username = ? AND password = ?')
    .get(username, password);

  if (!user) {
    return res.status(401).json({ error: 'Wrong username or password' });
  }
  res.json({ message: 'Login successful', user_id: user.user_id, name: user.name });
});

// ---------- Create a task ----------
// body: { user_id, task_name, task_desc, start_date, end_date }
app.post('/tasks', (req, res) => {
  const { user_id, task_name, task_desc, start_date, end_date } = req.body;

  if (!user_id || !task_name) {
    return res.status(400).json({ error: 'user_id and task_name are required' });
  }

  // make sure this user exists, because every task belongs to a user
  const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(user_id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // if no start_date is sent, use today's date (YYYY-MM-DD)
  const start = start_date || new Date().toLocaleDateString('en-CA');

  const result = db
    .prepare(
      `INSERT INTO tasks (user_id, task_name, task_desc, start_date, end_date, status)
       VALUES (?, ?, ?, ?, ?, 'Pending')`
    )
    .run(user_id, task_name, task_desc ?? null, start, end_date ?? null);

  res.json({ message: 'Task created', task_id: result.lastInsertRowid });
});

// ---------- Get all tasks ----------
// GET /tasks             -> every task
// GET /tasks?user_id=1001 -> only the tasks of that user
app.get('/tasks', (req, res) => {
  const { user_id } = req.query;

  let tasks;
  if (user_id) {
    tasks = db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY task_id').all(user_id);
  } else {
    tasks = db.prepare('SELECT * FROM tasks ORDER BY task_id').all();
  }

  res.json(tasks);
});

// ---------- Get a task ----------
// Example: GET /tasks/5001
app.get('/tasks/:task_id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE task_id = ?').get(req.params.task_id);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(task);
});

// ---------- Update a task ----------
// body: { task_name, task_desc, start_date, end_date }
// Only send the fields you want to change.
app.put('/tasks/:task_id', (req, res) => {
  const { task_name, task_desc, start_date, end_date } = req.body;

  // COALESCE keeps the old value when the new one is null
  const result = db
    .prepare(
      `UPDATE tasks
       SET task_name  = COALESCE(?, task_name),
           task_desc  = COALESCE(?, task_desc),
           start_date = COALESCE(?, start_date),
           end_date   = COALESCE(?, end_date)
       WHERE task_id = ?`
    )
    .run(
      task_name ?? null,
      task_desc ?? null,
      start_date ?? null,
      end_date ?? null,
      req.params.task_id
    );

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json({ message: 'Task updated' });
});

// ---------- Update task status ----------
// body: { status }   status = Pending | Ongoing | Completed
app.patch('/tasks/:task_id/status', (req, res) => {
  const { status } = req.body;

  if (!['Pending', 'Ongoing', 'Completed'].includes(status)) {
    return res.status(400).json({ error: 'status must be Pending, Ongoing or Completed' });
  }

  const result = db
    .prepare('UPDATE tasks SET status = ? WHERE task_id = ?')
    .run(status, req.params.task_id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json({ message: 'Status updated' });
});

// ---------- Start the server ----------
app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});