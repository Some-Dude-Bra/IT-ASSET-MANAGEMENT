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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── MULTER (asset photos — stored on disk) ───────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
const storage    = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => cb(null, `asset-${Date.now()}${path.extname(file.originalname)}`),
});
const fileFilter = (_req, file, cb) => {
  const ok = /jpeg|jpg|png|gif|webp/.test(path.extname(file.originalname).toLowerCase())
           && /jpeg|jpg|png|gif|webp/.test(file.mimetype);
  ok ? cb(null, true) : cb(new Error('Only image files allowed'));
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
    console.error('─── DB CONNECTION FAILED ───');
    console.error('Code   :', err.code);
    console.error('Message:', err.message);
    return;
  }
  console.log('✓ Connected to MySQL');
  initTables();
});

function q(sql, params, cb) { db.query(sql, params, cb || (() => {})); }
function runQ(sql, label)    { db.query(sql, err => { if (err) console.error(label + ':', err.message); else console.log('✓', label); }); }

function initTables() {
  // ── Users ──────────────────────────────────────────────────────────────────
  db.query(`
    CREATE TABLE IF NOT EXISTS Users (
      UserID    INT AUTO_INCREMENT PRIMARY KEY,
      username  VARCHAR(50)   NOT NULL UNIQUE,
      password  VARCHAR(255)  NOT NULL,
      fullName  VARCHAR(150)  NOT NULL,
      level     INT           DEFAULT 2,
      role      VARCHAR(50)   DEFAULT 'Employee',
      isBanned  TINYINT(1)    DEFAULT 0,
      banReason VARCHAR(500)  DEFAULT NULL,
      bannedAt  DATETIME      DEFAULT NULL,
      bannedBy  VARCHAR(50)   DEFAULT NULL,
      wallet    DECIMAL(10,2) DEFAULT 0.00,
      CreatedAt TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
    )
  `, tableErr => {
    if (tableErr) { console.error('Users table:', tableErr.message); return; }
    console.log('✓ Users table ready');
    // Safe column upgrades for existing tables
    ['ALTER TABLE Users ADD COLUMN IF NOT EXISTS isBanned  TINYINT(1)    DEFAULT 0',
     'ALTER TABLE Users ADD COLUMN IF NOT EXISTS banReason VARCHAR(500)  DEFAULT NULL',
     'ALTER TABLE Users ADD COLUMN IF NOT EXISTS bannedAt  DATETIME      DEFAULT NULL',
     'ALTER TABLE Users ADD COLUMN IF NOT EXISTS bannedBy  VARCHAR(50)   DEFAULT NULL',
     'ALTER TABLE Users ADD COLUMN IF NOT EXISTS wallet    DECIMAL(10,2) DEFAULT 0.00',
    ].forEach(sql => db.query(sql, () => {}));
    // Seed default users
    db.query('SELECT COUNT(*) AS cnt FROM Users', (e, rows) => {
      if (!e && rows[0].cnt === 0) {
        db.query('INSERT INTO Users (username,password,fullName,level,role) VALUES ?', [[
          ['peter',    'password','Peter Parker',    1,'Admin'],
          ['caroline', 'password','Caroline Reyes',  2,'Employee'],
          ['sebastian','password','Sebastian Cruz',  2,'Employee'],
          ['rheniel',  'password','Rheniel Santos',  2,'Employee'],
        ]], iErr => { if (iErr) console.error('Seed error:',iErr.message); else console.log('✓ Default users seeded'); });
      }
    });
  });

  // ── HardwareInventory extra columns ───────────────────────────────────────
  runQ('ALTER TABLE HardwareInventory ADD COLUMN IF NOT EXISTS PhotoPath VARCHAR(255) DEFAULT NULL', 'PhotoPath column');
  runQ('ALTER TABLE HardwareInventory ADD COLUMN IF NOT EXISTS DailyCost DECIMAL(10,2) DEFAULT 0.00', 'DailyCost column');
  runQ('ALTER TABLE HardwareInventory ADD COLUMN IF NOT EXISTS Description TEXT DEFAULT NULL', 'Description column');

  // ── Employee photos stored in DB ───────────────────────────────────────────
  runQ('ALTER TABLE Employees ADD COLUMN IF NOT EXISTS PhotoData LONGBLOB   DEFAULT NULL', 'Employee PhotoData');
  runQ('ALTER TABLE Employees ADD COLUMN IF NOT EXISTS PhotoMime VARCHAR(50) DEFAULT NULL', 'Employee PhotoMime');

  // ── BorrowLog table ────────────────────────────────────────────────────────
  runQ(`CREATE TABLE IF NOT EXISTS BorrowLog (
    LogID        INT AUTO_INCREMENT PRIMARY KEY,
    AssetID      INT         NOT NULL,
    BorrowedBy   VARCHAR(50) NOT NULL,
    BorrowedAt   DATETIME    DEFAULT CURRENT_TIMESTAMP,
    DueDate      DATE,
    ReturnedAt   DATETIME    DEFAULT NULL,
    ReturnedBy   VARCHAR(50) DEFAULT NULL,
    DailyCost    DECIMAL(10,2) DEFAULT 0.00,
    TotalCharged DECIMAL(10,2) DEFAULT 0.00,
    Status       VARCHAR(20) DEFAULT 'Active'
  )`, 'BorrowLog table');

  runQ('ALTER TABLE BorrowLog ADD COLUMN IF NOT EXISTS ReturnedBy VARCHAR(50) DEFAULT NULL', 'BorrowLog ReturnedBy');

  // ── WalletLog table ────────────────────────────────────────────────────────
  runQ(`CREATE TABLE IF NOT EXISTS WalletLog (
    TxID      INT AUTO_INCREMENT PRIMARY KEY,
    Username  VARCHAR(50)   NOT NULL,
    Amount    DECIMAL(10,2) NOT NULL,
    Type      VARCHAR(20)   NOT NULL,
    Note      VARCHAR(255),
    CreatedAt DATETIME      DEFAULT CURRENT_TIMESTAMP
  )`, 'WalletLog table');
}

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => res.send('Crispy Tech Lending Server is Running!'));

// ── AUTH ──────────────────────────────────────────────────────────────────────
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password required' });
  q('SELECT username,fullName,level,role,isBanned,banReason,bannedAt,wallet FROM Users WHERE username=? AND password=?',
    [username, password], (err, rows) => {
      if (err) { console.error('LOGIN:', err.message); return res.status(500).json({ message: err.message }); }
      if (!rows.length) return res.status(401).json({ message: 'Invalid credentials' });
      const u = rows[0];
      if (u.isBanned) return res.status(403).json({ message:'banned', banReason: u.banReason||'No reason given', bannedAt: u.bannedAt });
      res.json(u);
    });
});

app.post('/register', (req, res) => {
  const { username, password, fullName, level, role } = req.body;
  if (!username || !password || !fullName) return res.status(400).json({ message: 'username, password, fullName required' });
  q('SELECT username FROM Users WHERE username=?', [username], (cErr, rows) => {
    if (cErr) return res.status(500).json({ message: cErr.message });
    if (rows.length) return res.status(409).json({ message: 'Username already taken' });
    q('INSERT INTO Users (username,password,fullName,level,role) VALUES (?,?,?,?,?)',
      [username, password, fullName, level||2, role||'Employee'], (iErr) => {
        if (iErr) return res.status(500).json({ message: iErr.message });
        res.status(201).json({ message: 'Account created', username });
      });
  });
});

// ── BAN MANAGEMENT ────────────────────────────────────────────────────────────
app.get('/bans', (_req, res) => {
  q('SELECT username,fullName,banReason,bannedAt,bannedBy FROM Users WHERE isBanned=1 ORDER BY bannedAt DESC',
    [], (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json(rows);
    });
});

app.post('/ban', (req, res) => {
  const { username, reason, bannedBy } = req.body;
  if (!username) return res.status(400).json({ message: 'username required' });
  q('UPDATE Users SET isBanned=1, banReason=?, bannedAt=NOW(), bannedBy=? WHERE username=?',
    [reason||'No reason given', bannedBy||'Admin', username], (err) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json({ message: username + ' banned' });
    });
});

app.post('/unban', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ message: 'username required' });
  q('UPDATE Users SET isBanned=0, banReason=NULL, bannedAt=NULL, bannedBy=NULL WHERE username=?',
    [username], (err) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json({ message: username + ' unbanned' });
    });
});

// ── WALLET ────────────────────────────────────────────────────────────────────
app.get('/wallets', (_req, res) => {
  q('SELECT username,fullName,role,level,wallet FROM Users ORDER BY username', [], (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(rows);
  });
});

app.get('/wallet/:username', (req, res) => {
  q('SELECT wallet FROM Users WHERE username=?', [req.params.username], (err, rows) => {
    if (err || !rows.length) return res.status(404).json({ message: 'User not found' });
    res.json({ username: req.params.username, balance: rows[0].wallet });
  });
});

app.get('/wallet/:username/history', (req, res) => {
  q('SELECT TxID,Amount,Type,Note,CreatedAt FROM WalletLog WHERE Username=? ORDER BY CreatedAt DESC LIMIT 50',
    [req.params.username], (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json(rows);
    });
});

app.post('/wallet/add', (req, res) => {
  const { username, amount, note } = req.body;
  const amt = parseFloat(amount);
  if (!username || !amt || amt <= 0) return res.status(400).json({ message: 'username and positive amount required' });
  q('UPDATE Users SET wallet=wallet+? WHERE username=?', [amt, username], (err) => {
    if (err) return res.status(500).json({ message: err.message });
    q('INSERT INTO WalletLog (Username,Amount,Type,Note) VALUES (?,?,?,?)',
      [username, amt, 'credit', note||'Manual top-up'], () => {});
    q('SELECT wallet FROM Users WHERE username=?', [username], (e2, r2) => {
      res.json({ message: 'Funds added', newBalance: parseFloat(r2[0]?.wallet ?? 0) });
    });
  });
});

app.post('/wallet/deduct', (req, res) => {
  const { username, amount, note } = req.body;
  const amt = parseFloat(amount);
  if (!username || !amt || amt <= 0) return res.status(400).json({ message: 'username and positive amount required' });
  q('SELECT wallet FROM Users WHERE username=?', [username], (err, rows) => {
    if (err || !rows.length) return res.status(404).json({ message: 'User not found' });
    if (parseFloat(rows[0].wallet) < amt) return res.status(400).json({ message: 'Insufficient balance' });
    q('UPDATE Users SET wallet=wallet-? WHERE username=?', [amt, username], (err2) => {
      if (err2) return res.status(500).json({ message: err2.message });
      q('INSERT INTO WalletLog (Username,Amount,Type,Note) VALUES (?,?,?,?)',
        [username, amt, 'debit', note||'Manual deduction'], () => {});
      q('SELECT wallet FROM Users WHERE username=?', [username], (e3, r3) => {
        res.json({ message: 'Funds deducted', newBalance: parseFloat(r3[0]?.wallet ?? 0) });
      });
    });
  });
});

// ── ASSETS ────────────────────────────────────────────────────────────────────
app.get('/assets', (_req, res) => {
  q('SELECT AssetID,SerialNumber,Brand,Model,Status,PhotoPath,DailyCost,Description FROM HardwareInventory ORDER BY AssetID',
    [], (err, rows) => {
      if (err) { console.error('ASSETS:', err.message); return res.status(500).json({ message: err.message }); }
      res.json(rows);
    });
});

app.post('/assets', (req, res) => {
  const { brand, model, serialNumber, category, status, description, dailyCost } = req.body;
  if (!brand || !model || !serialNumber) return res.status(400).json({ message: 'brand, model, serialNumber required' });
  const catName = category || 'Other';
  q('SELECT CategoryID FROM AssetCategories WHERE CategoryName=?', [catName], (cErr, cats) => {
    if (cErr) return res.status(500).json({ message: cErr.message });
    const insertAsset = (catId) => {
      q('INSERT INTO HardwareInventory (SerialNumber,Brand,Model,Status,CategoryID,DailyCost,Description) VALUES (?,?,?,?,?,?,?)',
        [serialNumber, brand, model, status||'Available', catId, parseFloat(dailyCost)||0, description||null],
        (iErr, result) => {
          if (iErr) { console.error('ADD ASSET:', iErr.message); return res.status(500).json({ message: iErr.message }); }
          res.status(201).json({ message: 'Asset added', assetId: result.insertId });
        });
    };
    if (cats.length) { insertAsset(cats[0].CategoryID); }
    else { q('INSERT INTO AssetCategories (CategoryName) VALUES (?)', [catName], (iCatErr, cr) => {
      if (iCatErr) return res.status(500).json({ message: iCatErr.message });
      insertAsset(cr.insertId);
    }); }
  });
});

app.patch('/assets/:id/cost', (req, res) => {
  const assetId = parseInt(req.params.id, 10);
  const cost    = parseFloat(req.body.dailyCost) || 0;
  q('UPDATE HardwareInventory SET DailyCost=? WHERE AssetID=?', [cost, assetId], (err) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json({ message: 'Cost updated', dailyCost: cost });
  });
});

app.post('/assets/:id/photo', upload.single('photo'), (req, res) => {
  const assetId = parseInt(req.params.id, 10);
  if (!req.file) return res.status(400).json({ message: 'No file provided' });
  const photoPath = req.file.filename;
  q('SELECT PhotoPath FROM HardwareInventory WHERE AssetID=?', [assetId], (sErr, rows) => {
    if (!sErr && rows.length && rows[0].PhotoPath) {
      const old = path.join(UPLOAD_DIR, rows[0].PhotoPath);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    q('UPDATE HardwareInventory SET PhotoPath=?, UpdatedAt=NOW() WHERE AssetID=?', [photoPath, assetId], (uErr) => {
      if (uErr) return res.status(500).json({ message: uErr.message });
      res.json({ message: 'Photo uploaded', photoPath, url: `/uploads/${photoPath}` });
    });
  });
});

app.delete('/assets/:id/photo', (req, res) => {
  const assetId = parseInt(req.params.id, 10);
  q('SELECT PhotoPath FROM HardwareInventory WHERE AssetID=?', [assetId], (err, rows) => {
    if (err || !rows.length) return res.status(404).json({ message: 'Asset not found' });
    const old = rows[0].PhotoPath;
    if (old && fs.existsSync(path.join(UPLOAD_DIR, old))) fs.unlinkSync(path.join(UPLOAD_DIR, old));
    q('UPDATE HardwareInventory SET PhotoPath=NULL, UpdatedAt=NOW() WHERE AssetID=?', [assetId], (uErr) => {
      if (uErr) return res.status(500).json({ message: uErr.message });
      res.json({ message: 'Photo removed' });
    });
  });
});

// ── BORROW / RETURN ───────────────────────────────────────────────────────────
app.post('/borrow', (req, res) => {
  const { assetIds, borrowedBy, dueDate } = req.body;
  if (!assetIds?.length || !borrowedBy) return res.status(400).json({ message: 'assetIds and borrowedBy required' });
  let done = 0;
  const errors = [];
  assetIds.forEach(id => {
    q('SELECT DailyCost FROM HardwareInventory WHERE AssetID=?', [id], (err, rows) => {
      const cost = parseFloat(rows?.[0]?.DailyCost) || 0;
      q('INSERT INTO BorrowLog (AssetID,BorrowedBy,DueDate,DailyCost) VALUES (?,?,?,?)',
        [id, borrowedBy, dueDate||null, cost], (iErr) => {
          if (iErr) errors.push(iErr.message);
          q("UPDATE HardwareInventory SET Status='In Use', UpdatedAt=NOW() WHERE AssetID=?", [id], () => {});
          done++;
          if (done === assetIds.length) {
            if (errors.length) return res.status(500).json({ message: errors.join(', ') });
            res.json({ message: 'Assets borrowed successfully' });
          }
        });
    });
  });
});

// Preview return charge before confirming
app.get('/return/preview/:logId', (req, res) => {
  const logId = parseInt(req.params.logId, 10);
  q('SELECT bl.*, hi.Brand, hi.Model FROM BorrowLog bl JOIN HardwareInventory hi ON bl.AssetID=hi.AssetID WHERE bl.LogID=? AND bl.Status=?',
    [logId, 'Active'], (err, rows) => {
      if (err || !rows.length) return res.status(404).json({ message: 'Active borrow record not found' });
      const log       = rows[0];
      const borrowedAt = new Date(log.BorrowedAt);
      const now        = new Date();
      const days       = Math.max(1, Math.ceil((now - borrowedAt) / (1000 * 60 * 60 * 24)));
      const charge     = parseFloat((days * parseFloat(log.DailyCost)).toFixed(2));
      res.json({
        logId, assetId: log.AssetID, assetName: `${log.Brand} ${log.Model}`,
        borrowedBy: log.BorrowedBy, borrowedAt: log.BorrowedAt,
        dueDate: log.DueDate, dailyCost: parseFloat(log.DailyCost),
        days, estimatedCharge: charge,
      });
    });
});

// Confirm the return
app.post('/return/:logId', (req, res) => {
  const logId = parseInt(req.params.logId, 10);
  const { returnedBy } = req.body;
  q('SELECT * FROM BorrowLog WHERE LogID=? AND Status=?', [logId, 'Active'], (err, rows) => {
    if (err || !rows.length) return res.status(404).json({ message: 'Active borrow record not found' });
    const log        = rows[0];
    const borrowedAt = new Date(log.BorrowedAt);
    const now        = new Date();
    const days       = Math.max(1, Math.ceil((now - borrowedAt) / (1000 * 60 * 60 * 24)));
    const charge     = parseFloat((days * parseFloat(log.DailyCost)).toFixed(2));

    q('UPDATE BorrowLog SET ReturnedAt=NOW(), ReturnedBy=?, TotalCharged=?, Status=? WHERE LogID=?',
      [returnedBy||null, charge, 'Returned', logId], (uErr) => {
        if (uErr) return res.status(500).json({ message: uErr.message });
        // Deduct from wallet
        if (charge > 0) {
          q('UPDATE Users SET wallet=GREATEST(0, wallet-?) WHERE username=?', [charge, log.BorrowedBy], () => {});
          q('INSERT INTO WalletLog (Username,Amount,Type,Note) VALUES (?,?,?,?)',
            [log.BorrowedBy, charge, 'debit', `Return: Asset #${log.AssetID} (${days} day(s) × ₱${log.DailyCost}/day)`], () => {});
        }
        // Free the asset
        q("UPDATE HardwareInventory SET Status='Available', UpdatedAt=NOW() WHERE AssetID=?", [log.AssetID], () => {});
        res.json({ message: 'Asset returned', totalCharge: charge, days, borrowedBy: log.BorrowedBy });
      });
  });
});

// All active borrows
app.get('/borrows/active', (_req, res) => {
  q(`SELECT bl.LogID, bl.AssetID, bl.BorrowedBy, bl.BorrowedAt, bl.DueDate, bl.DailyCost,
            hi.Brand, hi.Model, hi.SerialNumber
     FROM BorrowLog bl
     JOIN HardwareInventory hi ON bl.AssetID=hi.AssetID
     WHERE bl.Status='Active'
     ORDER BY bl.BorrowedAt DESC`,
    [], (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json(rows);
    });
});

// Full borrow history
app.get('/borrows/history', (_req, res) => {
  q(`SELECT bl.LogID, bl.AssetID, bl.BorrowedBy, bl.BorrowedAt, bl.DueDate,
            bl.ReturnedAt, bl.ReturnedBy, bl.DailyCost, bl.TotalCharged, bl.Status,
            hi.Brand, hi.Model
     FROM BorrowLog bl
     JOIN HardwareInventory hi ON bl.AssetID=hi.AssetID
     ORDER BY bl.BorrowedAt DESC
     LIMIT 200`,
    [], (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json(rows);
    });
});

// ── EMPLOYEES ─────────────────────────────────────────────────────────────────
app.get('/employees', (_req, res) => {
  q('SELECT EmployeeID,FirstName,LastName,Department,Email FROM Employees', [], (err, results) => {
    if (err) { console.error('EMPLOYEES:', err.message); return res.status(500).json({ message: err.message }); }
    res.json(results);
  });
});

// Employee photo — served via API, NOT a public static URL (keeps photos private)
app.get('/employees/:id/photo', (req, res) => {
  const empId = parseInt(req.params.id, 10);
  q('SELECT PhotoData,PhotoMime FROM Employees WHERE EmployeeID=?', [empId], (err, rows) => {
    if (err || !rows.length || !rows[0].PhotoData) return res.status(404).json({ message: 'No photo' });
    res.set('Content-Type', rows[0].PhotoMime || 'image/jpeg');
    res.send(rows[0].PhotoData);
  });
});

app.post('/employees', (req, res) => {
  const { firstName, lastName, department, jobTitle, email, photoData, photoMime } = req.body;
  if (!firstName || !lastName) return res.status(400).json({ message: 'firstName and lastName required' });
  let photoBuffer = null;
  if (photoData) {
    const base64 = photoData.includes(',') ? photoData.split(',')[1] : photoData;
    photoBuffer = Buffer.from(base64, 'base64');
  }
  q('INSERT INTO Employees (FirstName,LastName,Department,Email,PhotoData,PhotoMime) VALUES (?,?,?,?,?,?)',
    [firstName, lastName, department||null, email||null, photoBuffer, photoMime||null],
    (err, result) => {
      if (err) { console.error('ADD EMPLOYEE:', err.message); return res.status(500).json({ message: err.message }); }
      res.status(201).json({ message: 'Employee added', employeeId: result.insertId });
    });
});

// ─── GLOBAL ERROR HANDLER ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('─── ERROR ──', req.method, req.originalUrl);
  console.error(err.message);
  res.status(500).json({ message: err.message || 'Internal server error' });
});

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(3000, () => console.log('Server running on http://localhost:3000'));
