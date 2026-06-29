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
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
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

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// ─── DATABASE ─────────────────────────────────────────────────────────────────
const db = mysql.createConnection({
  host:     'localhost',
  port:     3306,
  user:     's25101264_ITASSEST_MANAGEMENT',
  password: '!23456789O',
  database: 's25101264_ITASSEST_MANAGEMENT',
});

db.connect(err => {
  if (err) {
    console.error('─── DB CONNECTION FAILED ───────────────────────');
    console.error('Error code   :', err.code);
    console.error('Error message:', err.message);
    console.error('Check: Is MySQL running? Are your credentials correct?');
    console.error('────────────────────────────────────────────────');
    return;
  }
  console.log('✓ Connected to MySQL');

  // Create Users table if it doesn't exist yet
  db.query(`
    CREATE TABLE IF NOT EXISTS Users (
      UserID   INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50)  NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      fullName VARCHAR(150) NOT NULL,
      level    INT          DEFAULT 2,
      role     VARCHAR(50)  DEFAULT 'Employee',
      CreatedAt TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
    )
  `, tableErr => {
    if (tableErr) {
      console.error('Could not create Users table:', tableErr.message);
    } else {
      console.log('✓ Users table ready');

      // Insert default admin account if table is empty
      db.query('SELECT COUNT(*) AS cnt FROM Users', (countErr, rows) => {
        if (!countErr && rows[0].cnt === 0) {
          const defaultUsers = [
            ['peter',     'password', 'Peter Parker',     1, 'Admin'],
            ['caroline',  'password', 'Caroline Reyes',   2, 'Employee'],
            ['sebastian', 'password', 'Sebastian Cruz',   2, 'Employee'],
            ['rheniel',   'password', 'Rheniel Santos',   2, 'Employee'],
          ];
          const sql = 'INSERT INTO Users (username, password, fullName, level, role) VALUES ?';
          db.query(sql, [defaultUsers], insertErr => {
            if (insertErr) console.error('Could not seed users:', insertErr.message);
            else console.log('✓ Default users seeded (password: "password")');
          });
        }
      });
    }
  });

  // Auto-add PhotoPath column to HardwareInventory if missing
  db.query(`
    ALTER TABLE HardwareInventory
    ADD COLUMN IF NOT EXISTS PhotoPath VARCHAR(255) DEFAULT NULL
  `, alterErr => {
    if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
      console.warn('PhotoPath column note:', alterErr.message);
    } else {
      console.log('✓ PhotoPath column ready');
    }
  });
});

// ─── ROUTES ──────────────────────────────────────────────────────────────────

// Health check
app.get('/', (_req, res) => res.send('Crispy Tech Lending Server Running!'));

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  const sql = `
    SELECT username, fullName, level, role
    FROM Users
    WHERE username = ? AND password = ?
  `;

  db.query(sql, [username, password], (err, rows) => {
    if (err) {
      console.error('LOGIN DB ERROR:', err.message);
      return res.status(500).json({ message: 'Database error during login: ' + err.message });
    }
    if (!rows.length) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    res.json(rows[0]);
  });
});

// Register new user
app.post('/register', (req, res) => {
  const { username, password, fullName, level, role } = req.body;

  if (!username || !password || !fullName) {
    return res.status(400).json({ message: 'username, password and fullName are required' });
  }

  db.query('SELECT username FROM Users WHERE username = ?', [username], (checkErr, rows) => {
    if (checkErr) {
      console.error('REGISTER CHECK ERROR:', checkErr.message);
      return res.status(500).json({ message: 'Server error: ' + checkErr.message });
    }
    if (rows.length) return res.status(409).json({ message: 'Username already taken' });

    const sql = `
      INSERT INTO Users (username, password, fullName, level, role)
      VALUES (?, ?, ?, ?, ?)
    `;
    db.query(sql, [username, password, fullName, level || 2, role || 'Employee'], (insertErr) => {
      if (insertErr) {
        console.error('REGISTER INSERT ERROR:', insertErr.message);
        return res.status(500).json({ message: 'Failed to create account: ' + insertErr.message });
      }
      res.status(201).json({ message: 'Account created', username });
    });
  });
});

// ── Assets ────────────────────────────────────────────────────────────────────
app.get('/assets', (_req, res) => {
  const sql = `
    SELECT AssetID, SerialNumber, Brand, Model, Status, PhotoPath
    FROM HardwareInventory
    ORDER BY AssetID
  `;
  db.query(sql, (err, rows) => {
    if (err) {
      console.error('ASSETS FETCH ERROR:', err.message);
      return res.status(500).json({ message: 'Failed to fetch assets: ' + err.message });
    }
    res.json(rows);
  });
});

// POST /assets/:id/photo — upload or replace photo
app.post('/assets/:id/photo', upload.single('photo'), (req, res) => {
  const assetId = parseInt(req.params.id, 10);
  if (!req.file) return res.status(400).json({ message: 'No image file provided' });

  const photoPath = req.file.filename;

  db.query('SELECT PhotoPath FROM HardwareInventory WHERE AssetID = ?', [assetId], (selectErr, rows) => {
    if (!selectErr && rows.length && rows[0].PhotoPath) {
      const oldFile = path.join(UPLOAD_DIR, rows[0].PhotoPath);
      if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
    }

    const updateSql = 'UPDATE HardwareInventory SET PhotoPath = ?, UpdatedAt = NOW() WHERE AssetID = ?';
    db.query(updateSql, [photoPath, assetId], (updateErr) => {
      if (updateErr) {
        console.error('PHOTO UPDATE ERROR:', updateErr.message);
        return res.status(500).json({ message: 'DB update failed: ' + updateErr.message });
      }
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

// ── Employees ─────────────────────────────────────────────────────────────────
app.get('/employees', (_req, res) => {
  const sql = `
    SELECT EmployeeID, FirstName, LastName, Department, Email
    FROM Employees
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error('EMPLOYEES FETCH ERROR:', err.message);
      return res.status(500).json({ message: 'Failed to fetch employees: ' + err.message });
    }
    res.json(results);
  });
});

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('─── UNHANDLED ERROR ───────────────────────────');
  console.error('Route :', req.method, req.originalUrl);
  console.error('Error :', err.message);
  console.error('Stack :', err.stack);
  console.error('───────────────────────────────────────────────');
  res.status(500).json({ message: err.message || 'Internal server error' });
});

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(3000, () => console.log('Server running on http://localhost:3000'));