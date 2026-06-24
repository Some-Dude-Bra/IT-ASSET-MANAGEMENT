const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// ✅ SIMPLE MYSQL CONNECTION
const db = mysql.createConnection({
    host: 'localhost',
    port:3306,
    user: 's25101264_ITASSEST_MANAGEMENT',              // OR your correct user
    password: '!23456789O', // FIX THIS
    database: 's25101264_ITASSEST_MANAGEMENT'
});

db.connect(err => {
    if (err) {
        console.error('DB CONNECTION ERROR:', err);
        return;
    }
    console.log('Connected to MySQL');
});

// ─── LOGIN (fake users for now) ───
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    const users = {
        peter: { password: 'password', fullName: 'Peter', level: 2, role: 'Employee' },
        caroline: { password: 'password', fullName: 'Caroline', level: 3, role: 'Maintenance' },
        sebastian: { password: 'password', fullName: 'Sebastian', level: 4, role: 'Manager' },
        rheniel: { password: 'password', fullName: 'Rheniel', level: 5, role: 'Admin' }
    };

    const user = users[username?.toLowerCase()];

    if (user && user.password === password) {
        res.json({
            username,
            fullName: user.fullName,
            level: user.level,
            role: user.role
        });
    } else {
        res.status(401).json({ error: 'Invalid login' });
    }
});

// ─── ASSETS ───
app.get('/assets', (req, res) => {
    const sql = `
        SELECT AssetID, Brand, Model, SerialNumber, Status
        FROM HardwareInventory
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json(err);
        }
        res.json(results);
    });
});

// ─── START SERVER ───
app.listen(3000, () => {
    console.log('Server running on port 3000');
});