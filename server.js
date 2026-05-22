// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize data file if missing
function initDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ complaints: [] }, null, 2));
  }
}
initDataFile();

function readData() {
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function newId() {
  return crypto.randomBytes(8).toString('hex');
}

// Create a new complaint
app.post('/api/complaints', (req, res) => {
  const { name, email, subject, message } = req.body || {};
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  const data = readData();
  const complaint = {
    id: newId(),
    createdAt: new Date().toISOString(),
    name,
    email,
    subject,
    message,
    status: 'open',
    replies: [] // { id, createdAt, adminName, message }
  };
  data.complaints.push(complaint);
  writeData(data);
  res.status(201).json({ id: complaint.id });
});

// List complaints (basic, could add filters later)
app.get('/api/complaints', (req, res) => {
  const data = readData();
  // Sort newest first
  const sorted = [...data.complaints].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(sorted);
});

// Get a single complaint
app.get('/api/complaints/:id', (req, res) => {
  const data = readData();
  const item = data.complaints.find(c => c.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

// Add a reply to a complaint
app.post('/api/complaints/:id/replies', (req, res) => {
  const { adminName, message, status } = req.body || {};
  if (!adminName || !message) {
    return res.status(400).json({ error: 'adminName and message are required.' });
  }
  const data = readData();
  const item = data.complaints.find(c => c.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  const reply = {
    id: newId(),
    createdAt: new Date().toISOString(),
    adminName,
    message
  };
  item.replies.push(reply);

  if (status && ['open', 'pending', 'resolved', 'closed'].includes(status)) {
    item.status = status;
  }

  writeData(data);
  res.status(201).json(reply);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
