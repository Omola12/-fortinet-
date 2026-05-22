const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const nodemailer = require('nodemailer');

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

// Email configuration (using ethereal.email for testing - replace with real SMTP)
// For production, replace with your actual email service (Gmail, SendGrid, etc.)
const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
        user: 'your-test-email@ethereal.email', // Replace with your credentials
        pass: 'your-test-password'
    }
});

// Generate unique tracking ID
function generateTrackingId() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `FNT-${year}${month}${day}-${random}`;
}

// Send email notification
async function sendEmail(to, subject, htmlContent) {
    try {
        // For testing, just log the email
        console.log(`\n📧 EMAIL WOULD BE SENT TO: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Content: ${htmlContent.replace(/<[^>]*>/g, ' ').substring(0, 200)}...`);
        
        // Uncomment below for real email sending
        /*
        const info = await transporter.sendMail({
            from: '"Fortinet Support" <support@fortinet.com>',
            to: to,
            subject: subject,
            html: htmlContent
        });
        console.log('Email sent:', info.messageId);
        */
        return true;
    } catch (error) {
        console.error('Email error:', error);
        return false;
    }
}

function readComplaints() {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
}

function writeComplaints(complaints) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(complaints, null, 2));
}

// ============= PUBLIC API =============

// Submit new complaint
app.post('/api/complaints', async (req, res) => {
    const { name, email, subject, message } = req.body;
    
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Name, email, and complaint message are required.' });
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
    
    // Send email with tracking ID
    const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0f2c3b;">Fortinet Support - Complaint Received</h2>
            <p>Dear ${name},</p>
            <p>Thank you for contacting Fortinet support. Your complaint has been received and is being processed.</p>
            <div style="background: #f0f4fc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <strong>📋 Your Tracking ID:</strong>
                <h3 style="color: #1b4f6e; margin: 10px 0;">${trackingId}</h3>
                <p style="margin-top: 10px;">Use this ID to track your complaint status:</p>
                <a href="http://localhost:${PORT}/track.html" style="background: #0f2c3b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Track Your Complaint</a>
            </div>
            <p><strong>Complaint Summary:</strong></p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Message:</strong> ${message.substring(0, 200)}${message.length > 200 ? '...' : ''}</p>
            <hr style="margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">We aim to respond within 24-48 hours. Keep your tracking ID safe.</p>
        </div>
    `;
    
    await sendEmail(email, `Fortinet: Your complaint tracking ID - ${trackingId}`, emailHtml);
    
    res.status(201).json({ 
        success: true, 
        trackingId: trackingId,
        message: 'Complaint submitted! Check your email for tracking ID.'
    });
});

// Track complaint by ID
app.get('/api/complaints/track/:trackingId', (req, res) => {
    const { trackingId } = req.params;
    const complaints = readComplaints();
    const complaint = complaints.find(c => c.trackingId === trackingId);
    
    if (!complaint) {
        return res.status(404).json({ error: 'Complaint not found with this tracking ID.' });
    }
    
    // Return only necessary info for tracking
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

// ============= ADMIN API =============

app.get('/api/admin/complaints', (req, res) => {
    const complaints = readComplaints();
    res.json(complaints);
});

app.post('/api/admin/complaints/:id/reply', async (req, res) => {
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
    
    // Send email notification to customer
    const complaint = complaints[complaintIndex];
    const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0f2c3b;">Fortinet Support - Your complaint has been answered</h2>
            <p>Dear ${complaint.name},</p>
            <p>Great news! Our support team has responded to your complaint.</p>
            <div style="background: #e6f7ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <strong>📌 Reply from Fortinet Support:</strong>
                <p style="margin-top: 10px;">${replyMessage}</p>
            </div>
            <p><strong>Tracking ID:</strong> ${complaint.trackingId}</p>
            <p>You can view the full conversation anytime:</p>
            <a href="http://localhost:${PORT}/track.html" style="background: #0f2c3b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Your Complaint</a>
            <hr style="margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">Thank you for helping us improve Fortinet services.</p>
        </div>
    `;
    
    await sendEmail(complaint.email, `Fortinet: Response to your complaint (${complaint.trackingId})`, emailHtml);
    
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

// Serve admin panel
app.get('/admin-panel', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
    console.log(`\n✅ Fortinet Server running at http://localhost:${PORT}`);
    console.log(`📝 Submit complaint: http://localhost:${PORT}`);
    console.log(`🔍 Track complaint: http://localhost:${PORT}/track.html`);
    console.log(`🔐 Admin panel: http://localhost:${PORT}/admin-panel`);
    console.log(`📁 Data stored in: ${DATA_FILE}\n`);
});
