const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'complaints.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
}

// Generate unique tracking ID
function generateTrackingId() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `FNT-${year}${month}${day}-${random}`;
}

function readComplaints() {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
}

function writeComplaints(complaints) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(complaints, null, 2));
}

// Submit complaint - returns tracking ID immediately
app.post('/api/complaints', (req, res) => {
    const { name, email, subject, message } = req.body;
    
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Name, email, and complaint are required.' });
    }
    
    const complaints = readComplaints();
    const trackingId = generateTrackingId();
    
    const newComplaint = {
        id: Date.now().toString(),
        trackingId: trackingId,
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
    
    // Return tracking ID directly - no email
    res.status(201).json({ 
        success: true, 
        trackingId: trackingId,
        message: 'Complaint submitted! Save your tracking ID.'
    });
});

// Track complaint by ID
app.get('/api/complaints/track/:trackingId', (req, res) => {
    const { trackingId } = req.params;
    const complaints = readComplaints();
    const complaint = complaints.find(c => c.trackingId === trackingId);
    
    if (!complaint) {
        return res.status(404).json({ error: 'Complaint not found.' });
    }
    
    res.json({
        trackingId: complaint.trackingId,
        name: complaint.name,
        subject: complaint.subject,
        message: complaint.message,
        status: complaint.status,
        createdAt: complaint.createdAt,
        reply: complaint.reply,
        repliedAt: complaint.repliedAt
    });
});

// Admin endpoints
app.get('/api/admin/complaints', (req, res) => {
    const complaints = readComplaints();
    res.json(complaints);
});

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

app.get('/admin-panel', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
    console.log(`\n✅ Server running at http://localhost:${PORT}`);
    console.log(`📝 Submit complaint: http://localhost:${PORT}`);
    console.log(`🔍 Track complaint: http://localhost:${PORT}/track.html`);
    console.log(`🔐 Admin panel: http://localhost:${PORT}/admin-panel`);
    console.log(`📁 Data: ${DATA_FILE}\n`);
});
