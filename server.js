const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Data file setup
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'complaints.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
}

function readComplaints() {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
}

function writeComplaints(complaints) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(complaints, null, 2));
}

// ============= PUBLIC API (for normal users) =============

// GET all complaints (NOT exposed to public - only for internal use)
// But we'll keep it for admin panel access via fetch

// POST new complaint (public form)
app.post('/api/complaints', (req, res) => {
    const { name, email, subject, message } = req.body;
    
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Name, email, and complaint message are required.' });
    }
    
    const complaints = readComplaints();
    const newComplaint = {
        id: Date.now().toString(),
        name,
        email,
        subject: subject || 'General',
        message,
        status: 'pending',
        createdAt: new Date().toISOString(),
        reply: null,
        repliedAt: null
    };
    
    complaints.unshift(newComplaint);
    writeComplaints(complaints);
    
    res.status(201).json({ success: true, id: newComplaint.id });
});

// ============= ADMIN API (protected by simple password in frontend) =============

// Get all complaints (for admin)
app.get('/api/admin/complaints', (req, res) => {
    // Optional: Add API key check here if you want more security
    const complaints = readComplaints();
    res.json(complaints);
});

// Reply to complaint (admin only)
app.post('/api/admin/complaints/:id/reply', (req, res) => {
    const { id } = req.params;
    const { replyMessage } = req.body;
    
    if (!replyMessage || replyMessage.trim() === '') {
        return res.status(400).json({ error: 'Reply message cannot be empty.' });
    }
    
    const complaints = readComplaints();
    const complaintIndex = complaints.findIndex(c => c.id === id);
    
    if (complaintIndex === -1) {
        return res.status(404).json({ error: 'Complaint not found.' });
    }
    
    complaints[complaintIndex].reply = replyMessage.trim();
    complaints[complaintIndex].status = 'replied';
    complaints[complaintIndex].repliedAt = new Date().toISOString();
    
    writeComplaints(complaints);
    res.json({ success: true, complaint: complaints[complaintIndex] });
});

// Delete complaint (admin only)
app.delete('/api/admin/complaints/:id', (req, res) => {
    const { id } = req.params;
    const complaints = readComplaints();
    const filtered = complaints.filter(c => c.id !== id);
    
    if (filtered.length === complaints.length) {
        return res.status(404).json({ error: 'Complaint not found.' });
    }
    
    writeComplaints(filtered);
    res.json({ success: true });
});

// Serve admin panel on a separate, non-linked route
app.get('/admin-panel', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Fortinet Server running at http://localhost:${PORT}`);
    console.log(`📝 Public form: http://localhost:${PORT}`);
    console.log(`🔐 Admin panel: http://localhost:${PORT}/admin-panel (NO public link!)`);
    console.log(`📁 Data stored in: ${DATA_FILE}`);
});
