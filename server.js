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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── MULTER ──────────────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => cb(null, `asset-${Date.now()}${path.extname(file.originalname)}`),
});
const fileFilter = (_req, file, cb) => {
  const ok = /jpeg|jpg|png|gif|webp/.test(path.extname(file.originalname).toLowerCase())
           && /jpeg|jpg|png|gif|webp/.test(file.mimetype);
  ok ? cb(null, true) : cb(new Error('Only image files are allowed'));
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// ─── DATABASE ─────────────────────────────────────────────────────────────────
const db = mysql.createConnection({
  host:     'localhost',
  //port:     3306,
  user:     's25101264_ITASSEST_MANAGEMENT',
  password: '!23456789O',
  database: 's25101264_ITASSEST_MANAGEMENT',
});

db.connect(err => {
  if (err) {
    console.error('─── DB CONNECTION FAILED ───────────────────────');
    console.error('Code   :', err.code);
    console.error('Message:', err.message);
    console.error('────────────────────────────────────────────────');
    return;
  }
  console.log('✓ Connected to MySQL');

  // Create Users table if missing
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
    if (tableErr) { console.error('Users table error:', tableErr.message); return; }
    console.log('✓ Users table ready');
    db.query('SELECT COUNT(*) AS cnt FROM Users', (cErr, rows) => {
      if (!cErr && rows[0].cnt === 0) {
        const defaults = [
          ['peter',     'password', 'Peter Parker',     1, 'Admin'],
          ['caroline',  'password', 'Caroline Reyes',   2, 'Employee'],
          ['sebastian', 'password', 'Sebastian Cruz',   2, 'Employee'],
          ['rheniel',   'password', 'Rheniel Santos',   2, 'Employee'],
        ];
        db.query('INSERT INTO Users (username, password, fullName, level, role) VALUES ?', [defaults], iErr => {
          if (iErr) console.error('Seed users error:', iErr.message);
          else      console.log('✓ Default users seeded (password: "password")');
        });
      }
    });
  });

  // Add PhotoPath to HardwareInventory if missing
  db.query(`ALTER TABLE HardwareInventory ADD COLUMN IF NOT EXISTS PhotoPath VARCHAR(255) DEFAULT NULL`, aErr => {
    if (aErr && aErr.code !== 'ER_DUP_FIELDNAME') console.warn('PhotoPath note:', aErr.message);
    else console.log('✓ PhotoPath column ready');
  });
});

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => res.send('Crispy Tech Lending Server Running!'));

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password are required' });
  db.query(
    'SELECT username, fullName, level, role FROM Users WHERE username = ? AND password = ?',
    [username, password],
    (err, rows) => {
      if (err) { console.error('LOGIN ERROR:', err.message); return res.status(500).json({ message: err.message }); }
      if (!rows.length) return res.status(401).json({ message: 'Invalid credentials' });
      res.json(rows[0]);
    }
  );
});

app.post('/register', (req, res) => {
  const { username, password, fullName, level, role } = req.body;
  if (!username || !password || !fullName)
    return res.status(400).json({ message: 'username, password and fullName are required' });
  db.query('SELECT username FROM Users WHERE username = ?', [username], (cErr, rows) => {
    if (cErr) return res.status(500).json({ message: cErr.message });
    if (rows.length) return res.status(409).json({ message: 'Username already taken' });
    db.query(
      'INSERT INTO Users (username, password, fullName, level, role) VALUES (?, ?, ?, ?, ?)',
      [username, password, fullName, level || 2, role || 'Employee'],
      (iErr) => {
        if (iErr) return res.status(500).json({ message: iErr.message });
        res.status(201).json({ message: 'Account created', username });
      }
    );
  });
});

// ── Assets ────────────────────────────────────────────────────────────────────
app.get('/assets', (_req, res) => {
  db.query(
    'SELECT AssetID, SerialNumber, Brand, Model, Status, PhotoPath FROM HardwareInventory ORDER BY AssetID',
    (err, rows) => {
      if (err) { console.error('ASSETS ERROR:', err.message); return res.status(500).json({ message: err.message }); }
      res.json(rows);
    }
  );
});

// POST /assets — add a new asset to the database
app.post('/assets', (req, res) => {
  const { brand, model, serialNumber, category, status, description } = req.body;
  if (!brand || !model || !serialNumber)
    return res.status(400).json({ message: 'brand, model, and serialNumber are required' });

  // First get or create the CategoryID
  const catName = category || 'Other';
  db.query('SELECT CategoryID FROM AssetCategories WHERE CategoryName = ?', [catName], (cErr, cats) => {
    if (cErr) return res.status(500).json({ message: cErr.message });

    const insertAsset = (categoryId) => {
      const sql = `INSERT INTO HardwareInventory (SerialNumber, Brand, Model, Status, CategoryID) VALUES (?, ?, ?, ?, ?)`;
      db.query(sql, [serialNumber, brand, model, status || 'Available', categoryId], (iErr, result) => {
        if (iErr) { console.error('ADD ASSET ERROR:', iErr.message); return res.status(500).json({ message: iErr.message }); }
        res.status(201).json({ message: 'Asset added', assetId: result.insertId });
      });
    };

    if (cats.length) {
      insertAsset(cats[0].CategoryID);
    } else {
      db.query('INSERT INTO AssetCategories (CategoryName) VALUES (?)', [catName], (iCatErr, catResult) => {
        if (iCatErr) return res.status(500).json({ message: iCatErr.message });
        insertAsset(catResult.insertId);
      });
    }
  });
});

app.post('/assets/:id/photo', upload.single('photo'), (req, res) => {
  const assetId = parseInt(req.params.id, 10);
  if (!req.file) return res.status(400).json({ message: 'No image file provided' });
  const photoPath = req.file.filename;
  db.query('SELECT PhotoPath FROM HardwareInventory WHERE AssetID = ?', [assetId], (sErr, rows) => {
    if (!sErr && rows.length && rows[0].PhotoPath) {
      const old = path.join(UPLOAD_DIR, rows[0].PhotoPath);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    db.query('UPDATE HardwareInventory SET PhotoPath = ?, UpdatedAt = NOW() WHERE AssetID = ?', [photoPath, assetId], (uErr) => {
      if (uErr) return res.status(500).json({ message: uErr.message });
      res.json({ message: 'Photo uploaded', photoPath, url: `/uploads/${photoPath}` });
    });
  });
});

app.delete('/assets/:id/photo', (req, res) => {
  const assetId = parseInt(req.params.id, 10);
  db.query('SELECT PhotoPath FROM HardwareInventory WHERE AssetID = ?', [assetId], (err, rows) => {
    if (err || !rows.length) return res.status(404).json({ message: 'Asset not found' });
    const old = rows[0].PhotoPath;
    if (old && fs.existsSync(path.join(UPLOAD_DIR, old))) fs.unlinkSync(path.join(UPLOAD_DIR, old));
    db.query('UPDATE HardwareInventory SET PhotoPath = NULL, UpdatedAt = NOW() WHERE AssetID = ?', [assetId], (uErr) => {
      if (uErr) return res.status(500).json({ message: uErr.message });
      res.json({ message: 'Photo removed' });
    });
  });
});

// ── Employees ─────────────────────────────────────────────────────────────────
app.get('/employees', (_req, res) => {
  db.query('SELECT EmployeeID, FirstName, LastName, Department, Email FROM Employees', (err, results) => {
    if (err) { console.error('EMPLOYEES ERROR:', err.message); return res.status(500).json({ message: err.message }); }
    res.json(results);
  });
});

// POST /employees — add a new employee to the database
app.post('/employees', (req, res) => {
  const { firstName, lastName, department, jobTitle, email } = req.body;
  if (!firstName || !lastName) return res.status(400).json({ message: 'firstName and lastName are required' });
  db.query(
    'INSERT INTO Employees (FirstName, LastName, Department, Email) VALUES (?, ?, ?, ?)',
    [firstName, lastName, department || null, email || null],
    (err, result) => {
      if (err) { console.error('ADD EMPLOYEE ERROR:', err.message); return res.status(500).json({ message: err.message }); }
      res.status(201).json({ message: 'Employee added', employeeId: result.insertId });
    }
  );
});

// ─── GLOBAL ERROR HANDLER ────────────────────────────────────────────────────
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
