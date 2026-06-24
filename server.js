// ─── DEPENDENCIES ────────────────────────────────────────────────────────────
const express = require('express');
const mysql   = require('mysql2');
const cors    = require('cors');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const app = express();

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve uploaded photos as static files at /uploads/<filename>
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── MULTER (photo upload) ────────────────────────────────────────────────────
// Ensure the uploads folder exists
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    // e.g.  asset-1001-1718200000000.jpg
    const unique = `asset-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, unique);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const ok = allowed.test(path.extname(file.originalname).toLowerCase())
           && allowed.test(file.mimetype);
  ok ? cb(null, true) : cb(new Error('Only image files are allowed'));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // 5 MB

// ─── DATABASE ─────────────────────────────────────────────────────────────────
const db = mysql.createConnection({
  host:     'localhost',
  port:     3306,
  user:     's25101264_ITASSEST_MANAGEMENT',
  password: '!23456789O',
  database: 's25101264_ITASSEST_MANAGEMENT',
});

db.connect(err => {
  if (err) { console.error('DB connection error:', err); return; }
  console.log('Connected to MySQL');

  // Auto-add PhotoPath column if it doesn't exist yet
  db.query(`
    ALTER TABLE HardwareInventory
    ADD COLUMN IF NOT EXISTS PhotoPath VARCHAR(255) DEFAULT NULL
  `, alterErr => {
    if (alterErr) {
      // Some MySQL versions don't support IF NOT EXISTS on ALTER — ignore duplicate column error
      if (alterErr.code !== 'ER_DUP_FIELDNAME') console.warn('PhotoPath column note:', alterErr.message);
    } else {
      console.log('PhotoPath column ready');
    }
  });
});

// ─── ROUTES ──────────────────────────────────────────────────────────────────

// Health check
app.get('/', (_req, res) => res.send('Crispy Tech Lending Server Running!'));

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const sql = `
    SELECT username, fullName, level, role
    FROM Users
    WHERE username = ? AND password = ?
  `;

  db.query(sql, [username, password], (err, rows) => {
    if (err)           return res.status(500).json({ message: 'Server error' });
    if (!rows.length)  return res.status(401).json({ message: 'Invalid credentials' });
    res.json(rows[0]);
  });
});

// Register new user
app.post('/register', (req, res) => {
  const { username, password, fullName, level, role } = req.body;

  if (!username || !password || !fullName) {
    return res.status(400).json({ message: 'username, password and fullName are required' });
  }

  // Check for duplicate username first
  db.query('SELECT username FROM Users WHERE username = ?', [username], (checkErr, rows) => {
    if (checkErr) return res.status(500).json({ message: 'Server error' });
    if (rows.length) return res.status(409).json({ message: 'Username already taken' });

    const sql = `
      INSERT INTO Users (username, password, fullName, level, role)
      VALUES (?, ?, ?, ?, ?)
    `;
    db.query(sql, [username, password, fullName, level || 2, role || 'Employee'], (insertErr) => {
      if (insertErr) return res.status(500).json({ message: 'Failed to create account' });
      res.status(201).json({ message: 'Account created', username });
    });
  });
});

// ── Assets ────────────────────────────────────────────────────────────────────
// GET /assets — fetch all assets including photo path
app.get('/assets', (_req, res) => {
  const sql = `
    SELECT
      AssetID,
      SerialNumber,
      Brand,
      Model,
      Status,
      PhotoPath
    FROM HardwareInventory
    ORDER BY AssetID
  `;
  db.query(sql, (err, rows) => {
    if (err) { console.error(err); return res.status(500).json({ message: 'Server error' }); }
    res.json(rows);
  });
});

// POST /assets/:id/photo — upload or replace photo for an asset
app.post('/assets/:id/photo', upload.single('photo'), (req, res) => {
  const assetId = parseInt(req.params.id, 10);

  if (!req.file) return res.status(400).json({ message: 'No image file provided' });

  // Store just the filename; the frontend builds the full URL
  const photoPath = req.file.filename;

  // If there was an old photo, delete it from disk
  const selectSql = 'SELECT PhotoPath FROM HardwareInventory WHERE AssetID = ?';
  db.query(selectSql, [assetId], (selectErr, rows) => {
    if (!selectErr && rows.length && rows[0].PhotoPath) {
      const oldFile = path.join(UPLOAD_DIR, rows[0].PhotoPath);
      if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
    }

    // Save new filename to DB
    const updateSql = 'UPDATE HardwareInventory SET PhotoPath = ?, UpdatedAt = NOW() WHERE AssetID = ?';
    db.query(updateSql, [photoPath, assetId], (updateErr) => {
      if (updateErr) { console.error(updateErr); return res.status(500).json({ message: 'DB update failed' }); }
      res.json({ message: 'Photo uploaded', photoPath, url: `/uploads/${photoPath}` });
    });
  });
});

// DELETE /assets/:id/photo — remove photo
app.delete('/assets/:id/photo', (req, res) => {
  const assetId = parseInt(req.params.id, 10);

  db.query('SELECT PhotoPath FROM HardwareInventory WHERE AssetID = ?', [assetId], (err, rows) => {
    if (err || !rows.length) return res.status(404).json({ message: 'Asset not found' });
    const old = rows[0].PhotoPath;
    if (old) {
      const oldFile = path.join(UPLOAD_DIR, old);
      if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
    }
    db.query('UPDATE HardwareInventory SET PhotoPath = NULL, UpdatedAt = NOW() WHERE AssetID = ?', [assetId], (updateErr) => {
      if (updateErr) return res.status(500).json({ message: 'DB update failed' });
      res.json({ message: 'Photo removed' });
    });
  });
});
app.get('/employees', (req, res) => {
    const sql = `
        SELECT
            EmployeeID,
            FirstName,
            LastName,
            Department,
            Email
        FROM Employees
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json(err);
        }

        res.json(results);
    });
});

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(3000, () => console.log('Server running on http://localhost:3000'));