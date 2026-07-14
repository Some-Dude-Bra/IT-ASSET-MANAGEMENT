// ─── DEPENDENCIES ────────────────────────────────────────────────────────────
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(express.static(__dirname));   // <-- Add this

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const mysql   = require('mysql2');
const cors    = require('cors');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');

// ─── PASSWORD HASHING HELPERS ─────────────────────────────────────────────────
// Passwords are never stored or compared as plaintext. bcrypt hashes always
// start with "$2" (e.g. "$2a$10$..."), so isHashed() lets us tell a hash apart
// from a legacy plaintext password left over from before hashing was added.
function isHashed(pw) { return typeof pw === 'string' && /^\$2[aby]?\$/.test(pw); }
function hashPassword(pw) { return bcrypt.hashSync(String(pw), 10); }


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
     'ALTER TABLE Users ADD COLUMN IF NOT EXISTS EmployeeID INT DEFAULT NULL',
     'ALTER TABLE Users ADD COLUMN IF NOT EXISTS PinHash VARCHAR(64) DEFAULT NULL',
     'ALTER TABLE Users ADD COLUMN IF NOT EXISTS PinSalt VARCHAR(32) DEFAULT NULL',
    ].forEach(sql => db.query(sql, () => {}));
    // Seed default demo users — clearance scale: 1=Student, 2=Employee, 3=Maintenance, 4=Manager, 5=Admin
    // Password for every seeded account is "password" (hashed below) — this is a demo/class project.
    const DEMO_USERS = [
      ['tony.stark',  'Tony Stark',  5, 'Admin'],
      ['bruce.wayne', 'Bruce Wayne', 4, 'Manager'],
      ['tim.drake',   'Tim Drake',   2, 'Employee'],
      ['jason.todd',  'Jason Todd',  3, 'Maintenance'],
    ];
    // Insert any demo account that's missing — this runs every startup, not just
    // on a brand-new DB, so upgrading an existing install (which already had its
    // own users) still ends up with working tony.stark / bruce.wayne / tim.drake
    // / jason.todd logins instead of "Invalid credentials".
    db.query('SELECT username FROM Users WHERE username IN (?)', [DEMO_USERS.map(u => u[0])], (dErr, existingRows) => {
      if (dErr) return console.error('Demo user check:', dErr.message);
      const existing = new Set(existingRows.map(r => r.username));
      const missing  = DEMO_USERS.filter(u => !existing.has(u[0]));
      if (missing.length) {
        const demoPw = hashPassword('password');
        db.query('INSERT INTO Users (username,password,fullName,level,role) VALUES ?',
          [missing.map(([username, fullName, level, role]) => [username, demoPw, fullName, level, role])],
          iErr => { if (iErr) console.error('Demo seed error:', iErr.message); else console.log(`✓ Seeded demo users: ${missing.map(u=>u[0]).join(', ')}`); });
      }
    });
    db.query('SELECT COUNT(*) AS cnt FROM Users', (e, rows) => {
      if (!e && rows[0].cnt > 0) {
        // One-time migration for installs seeded under the OLD scheme, where
        // level=1 + role='Admin' meant "Admin". Under the new 5-tier scale,
        // level 1 means "Student", so bump any such accounts up to level 5.
        db.query("UPDATE Users SET level=5 WHERE role='Admin' AND level=1",
          mErr => { if (mErr) console.error('Admin level migration:', mErr.message); });

        // One-time migration: hash any leftover plaintext passwords from before
        // bcrypt was added, so nothing in the DB stays readable as plaintext.
        db.query('SELECT UserID, password FROM Users', (pErr, pwRows) => {
          if (pErr) return console.error('Password migration lookup:', pErr.message);
          pwRows.filter(r => !isHashed(r.password)).forEach(r => {
            db.query('UPDATE Users SET password=? WHERE UserID=?', [hashPassword(r.password), r.UserID],
              uErr => { if (uErr) console.error('Password migration:', uErr.message); });
          });
        });
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

  // ── MaintenanceNotes table (one editable notes field per asset) ───────────
  runQ(`CREATE TABLE IF NOT EXISTS MaintenanceNotes (
    AssetID   INT PRIMARY KEY,
    Notes     TEXT,
    UpdatedBy VARCHAR(50) DEFAULT NULL,
    UpdatedAt DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`, 'MaintenanceNotes table');

  // ── AccountRequests table — lets a user ask Admin to delete or change their account ──
  runQ(`CREATE TABLE IF NOT EXISTS AccountRequests (
    RequestID   INT AUTO_INCREMENT PRIMARY KEY,
    username    VARCHAR(50) NOT NULL,
    type        ENUM('delete','change') NOT NULL,
    details     TEXT,
    status      ENUM('pending','approved','denied') NOT NULL DEFAULT 'pending',
    CreatedAt   DATETIME DEFAULT CURRENT_TIMESTAMP,
    ResolvedAt  DATETIME DEFAULT NULL,
    ResolvedBy  VARCHAR(50) DEFAULT NULL
  )`, 'AccountRequests table');

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

// ─── CLEARANCE LEVELS ────────────────────────────────────────────────────────
// 1 = Student   (view only, cannot borrow)
// 2 = Employee  (borrow / return)
// 3 = Maintenance (maintenance log + asset management + repair)
// 4 = Manager   (everything except create/ban accounts)
// 5 = Admin     (everything)
const CLEARANCE = { STUDENT: 1, EMPLOYEE: 2, MAINTENANCE: 3, MANAGER: 4, ADMIN: 5 };
const ROLE_NAMES = { 1: 'Student', 2: 'Employee', 3: 'Maintenance', 4: 'Manager', 5: 'Admin' };

// Simple header-based level gate. The frontend sends the acting user's level in
// the 'x-user-level' header (set automatically by app.js on every request once logged in).
function requireLevel(minLevel) {
  return (req, res, next) => {
    const lvl = parseInt(req.headers['x-user-level'], 10);
    if (!lvl || lvl < minLevel) {
      return res.status(403).json({ message: 'Insufficient clearance level for this action' });
    }
    next();
  };
}

// ─── ACCOUNT AUTO-GENERATION HELPERS ─────────────────────────────────────────
function slugify(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

function randomPassword(len = 8) {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// Finds a free username of the form first.last, first.last2, first.last3, ...
function findFreeUsername(firstName, lastName, cb) {
  const base = `${slugify(firstName)}.${slugify(lastName)}`;
  q('SELECT username FROM Users WHERE username LIKE ?', [`${base}%`], (err, rows) => {
    if (err) return cb(err);
    const taken = new Set(rows.map(r => r.username));
    if (!taken.has(base)) return cb(null, base);
    let n = 2;
    while (taken.has(`${base}${n}`)) n++;
    cb(null, `${base}${n}`);
  });
}

// ─── SECURITY PIN HELPERS (for gating plaintext password viewing) ───────────
function hashPin(pin, salt) {
  return crypto.createHash('sha256').update(String(pin) + salt).digest('hex');
}
function newSalt() { return crypto.randomBytes(16).toString('hex'); }

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => res.send('Crispy Tech Lending Server is Running!'));

// ── AUTH ──────────────────────────────────────────────────────────────────────
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password required' });
  q('SELECT username,password,fullName,level,role,isBanned,banReason,bannedAt,wallet FROM Users WHERE username=?',
    [username], (err, rows) => {
      if (err) { console.error('LOGIN:', err.message); return res.status(500).json({ message: err.message }); }
      if (!rows.length) return res.status(401).json({ message: 'Invalid credentials' });
      const u = rows[0];
      const ok = isHashed(u.password) ? bcrypt.compareSync(password, u.password) : password === u.password;
      if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
      if (u.isBanned) return res.status(403).json({ message:'banned', banReason: u.banReason||'No reason given', bannedAt: u.bannedAt });
      delete u.password;
      res.json(u);
    });
});

// Only Admin (level 5) may create accounts
app.post('/register', requireLevel(CLEARANCE.ADMIN), (req, res) => {
  const { username, password, fullName, level, role } = req.body;
  if (!username || !password || !fullName) return res.status(400).json({ message: 'username, password, fullName required' });
  const lvl = parseInt(level, 10) || CLEARANCE.EMPLOYEE;
  q('SELECT username FROM Users WHERE username=?', [username], (cErr, rows) => {
    if (cErr) return res.status(500).json({ message: cErr.message });
    if (rows.length) return res.status(409).json({ message: 'Username already taken' });
    q('INSERT INTO Users (username,password,fullName,level,role) VALUES (?,?,?,?,?)',
      [username, hashPassword(password), fullName, lvl, role || ROLE_NAMES[lvl] || 'Employee'], (iErr) => {
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

// Only Admin (level 5) may ban/unban accounts
app.post('/ban', requireLevel(CLEARANCE.ADMIN), (req, res) => {
  const { username, reason, bannedBy } = req.body;
  if (!username) return res.status(400).json({ message: 'username required' });
  q('UPDATE Users SET isBanned=1, banReason=?, bannedAt=NOW(), bannedBy=? WHERE username=?',
    [reason||'No reason given', bannedBy||'Admin', username], (err) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json({ message: username + ' banned' });
    });
});

app.post('/unban', requireLevel(CLEARANCE.ADMIN), (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ message: 'username required' });
  q('UPDATE Users SET isBanned=0, banReason=NULL, bannedAt=NULL, bannedBy=NULL WHERE username=?',
    [username], (err) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json({ message: username + ' unbanned' });
    });
});

// ── WALLET ────────────────────────────────────────────────────────────────────
app.get('/wallets', requireLevel(CLEARANCE.MANAGER), (_req, res) => {
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

app.post('/wallet/add', requireLevel(CLEARANCE.MANAGER), (req, res) => {
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

app.post('/wallet/deduct', requireLevel(CLEARANCE.MANAGER), (req, res) => {
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
  // Join in the most recent BorrowLog row per asset (via ROW_NUMBER) so "Last User" / Return Date aren't blank,
  // plus any saved MaintenanceNotes for the Repair screen.
  q(`SELECT hi.AssetID, hi.SerialNumber, hi.Brand, hi.Model, hi.Status, hi.PhotoPath, hi.DailyCost, hi.Description,
            lb.BorrowedBy, lb.DueDate, lb.Status AS BorrowStatus,
            mn.Notes AS RepairNotes
     FROM HardwareInventory hi
     LEFT JOIN (
       SELECT AssetID, BorrowedBy, DueDate, Status,
              ROW_NUMBER() OVER (PARTITION BY AssetID ORDER BY BorrowedAt DESC) AS rn
       FROM BorrowLog
     ) lb ON lb.AssetID = hi.AssetID AND lb.rn = 1
     LEFT JOIN MaintenanceNotes mn ON mn.AssetID = hi.AssetID
     ORDER BY hi.AssetID`,
    [], (err, rows) => {
      if (err) { console.error('ASSETS:', err.message); return res.status(500).json({ message: err.message }); }
      res.json(rows);
    });
});

// Save/update repair notes for an asset — Maintenance clearance (level 3) or above
app.patch('/assets/:id/notes', requireLevel(CLEARANCE.MAINTENANCE), (req, res) => {
  const assetId = parseInt(req.params.id, 10);
  const notes   = (req.body.notes || '').toString();
  const updatedBy = req.body.updatedBy || null;
  q(`INSERT INTO MaintenanceNotes (AssetID, Notes, UpdatedBy) VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE Notes=VALUES(Notes), UpdatedBy=VALUES(UpdatedBy)`,
    [assetId, notes, updatedBy], (err) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json({ message: 'Notes saved', notes });
    });
});

// Adding/editing assets requires Maintenance clearance (level 3) or above
app.post('/assets', requireLevel(CLEARANCE.MAINTENANCE), (req, res) => {
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

app.patch('/assets/:id/cost', requireLevel(CLEARANCE.MAINTENANCE), (req, res) => {
  const assetId = parseInt(req.params.id, 10);
  const cost    = parseFloat(req.body.dailyCost) || 0;
  q('UPDATE HardwareInventory SET DailyCost=? WHERE AssetID=?', [cost, assetId], (err) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json({ message: 'Cost updated', dailyCost: cost });
  });
});

// Update an asset's status (e.g. Maintenance marking a repaired device back to
// Available). Maps the frontend's three canonical keys to a stored Status
// string. This is the piece that was previously missing — the frontend only
// updated its own in-memory copy, so the old status came right back on the
// next reload from the DB.
const STATUS_MAP = { available: 'Available', unavailable: 'Unavailable', service: 'In Service' };
app.patch('/assets/:id/status', requireLevel(CLEARANCE.MAINTENANCE), (req, res) => {
  const assetId = parseInt(req.params.id, 10);
  const status  = STATUS_MAP[(req.body.status || '').toLowerCase()];
  if (!status) return res.status(400).json({ message: 'status must be one of: available, unavailable, service' });
  q('UPDATE HardwareInventory SET Status=?, UpdatedAt=NOW() WHERE AssetID=?', [status, assetId], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!result.affectedRows) return res.status(404).json({ message: 'Asset not found' });
    res.json({ message: 'Status updated', status });
  });
});

app.post('/assets/:id/photo', requireLevel(CLEARANCE.MAINTENANCE), upload.single('photo'), (req, res) => {
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

app.delete('/assets/:id/photo', requireLevel(CLEARANCE.MAINTENANCE), (req, res) => {
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
// Students (level 1) cannot borrow — Employee level or above required
app.post('/borrow', requireLevel(CLEARANCE.EMPLOYEE), (req, res) => {
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

// Only the person who borrowed an item may return it — no clearance level,
// including Admin, gets to return someone else's item.
function canActOnBorrow(req, borrowedBy) {
  const username = req.headers['x-username'];
  return !!username && username === borrowedBy;
}

// Preview return charge before confirming — same ownership rule as the actual return
app.get('/return/preview/:logId', requireLevel(CLEARANCE.EMPLOYEE), (req, res) => {
  const logId = parseInt(req.params.logId, 10);
  q('SELECT bl.*, hi.Brand, hi.Model FROM BorrowLog bl JOIN HardwareInventory hi ON bl.AssetID=hi.AssetID WHERE bl.LogID=? AND bl.Status=?',
    [logId, 'Active'], (err, rows) => {
      if (err || !rows.length) return res.status(404).json({ message: 'Active borrow record not found' });
      const log = rows[0];
      if (!canActOnBorrow(req, log.BorrowedBy)) {
        return res.status(403).json({ message: 'You can only return items you borrowed yourself' });
      }
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

// Confirm the return — Employee level or above required, and only for the
// item you personally borrowed. No clearance level can return on someone else's behalf.
app.post('/return/:logId', requireLevel(CLEARANCE.EMPLOYEE), (req, res) => {
  const logId = parseInt(req.params.logId, 10);
  const { returnedBy } = req.body;
  q('SELECT * FROM BorrowLog WHERE LogID=? AND Status=?', [logId, 'Active'], (err, rows) => {
    if (err || !rows.length) return res.status(404).json({ message: 'Active borrow record not found' });
    const log        = rows[0];
    if (!canActOnBorrow(req, log.BorrowedBy)) {
      return res.status(403).json({ message: 'You can only return items you borrowed yourself' });
    }
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

// ── ACCOUNT REQUESTS ──────────────────────────────────────────────────────────
// Any logged-in user can ask Admin to delete their account (e.g. leaving the
// company) or change something about it (e.g. department, name, access level).
app.post('/account-requests', (req, res) => {
  const { username, type, details } = req.body;
  if (!username || !type) return res.status(400).json({ message: 'username and type required' });
  if (!['delete', 'change'].includes(type)) return res.status(400).json({ message: 'type must be delete or change' });
  q('SELECT username FROM Users WHERE username=?', [username], (uErr, rows) => {
    if (uErr) return res.status(500).json({ message: uErr.message });
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    q('INSERT INTO AccountRequests (username,type,details) VALUES (?,?,?)',
      [username, type, details || ''], (iErr) => {
        if (iErr) return res.status(500).json({ message: iErr.message });
        res.status(201).json({ message: 'Request submitted to Admin' });
      });
  });
});

// Any user — check the status of their own requests (used for notifications)
app.get('/account-requests/mine/:username', (req, res) => {
  q('SELECT RequestID, type, details, status, CreatedAt, ResolvedAt FROM AccountRequests WHERE username=? ORDER BY CreatedAt DESC',
    [req.params.username], (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json(rows);
    });
});

// Admin only — view all requests, with the linked employee's info attached
// (so a "change" request can show a ready-to-edit employee form)
app.get('/account-requests', requireLevel(CLEARANCE.ADMIN), (_req, res) => {
  q(`SELECT ar.*, u.EmployeeID, u.level AS AccountLevel, u.role AS AccountRole,
            e.FirstName, e.LastName, e.Department, e.Email
     FROM AccountRequests ar
     LEFT JOIN Users u ON u.username = ar.username
     LEFT JOIN Employees e ON e.EmployeeID = u.EmployeeID
     ORDER BY (ar.status='pending') DESC, ar.CreatedAt DESC`,
    [], (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json(rows);
    });
});

// Admin only — approve or deny a request
app.patch('/account-requests/:id', requireLevel(CLEARANCE.ADMIN), (req, res) => {
  const reqId  = parseInt(req.params.id, 10);
  const { action, resolvedBy } = req.body; // action: 'approve' | 'deny'
  if (!['approve', 'deny'].includes(action)) return res.status(400).json({ message: 'action must be approve or deny' });

  q('SELECT * FROM AccountRequests WHERE RequestID=?', [reqId], (fErr, rows) => {
    if (fErr) return res.status(500).json({ message: fErr.message });
    if (!rows.length) return res.status(404).json({ message: 'Request not found' });
    const request = rows[0];
    if (request.status !== 'pending') return res.status(409).json({ message: 'Request already resolved' });

    const finish = () => {
      q('UPDATE AccountRequests SET status=?, ResolvedAt=NOW(), ResolvedBy=? WHERE RequestID=?',
        [action === 'approve' ? 'approved' : 'denied', resolvedBy || 'Admin', reqId], (uErr) => {
          if (uErr) return res.status(500).json({ message: uErr.message });
          res.json({ message: `Request ${action === 'approve' ? 'approved' : 'denied'}` });
        });
    };

    // Approving a delete request removes both the login account AND the linked
    // employee record — otherwise the person's name keeps showing up in Manage
    // Employees / Departments even though their account (and job) is gone.
    // Approving a change request just marks it resolved — the admin edits the
    // employee directly via the Change button, which opens Manage Employees.
    if (action === 'approve' && request.type === 'delete') {
      q('SELECT EmployeeID, fullName FROM Users WHERE username=?', [request.username], (lErr, uRows) => {
        if (lErr) return res.status(500).json({ message: lErr.message });
        const fullName = uRows[0]?.fullName || null;
        let employeeId = uRows[0]?.EmployeeID || null;

        const deleteUserThenEmployee = (empId) => {
          q('DELETE FROM Users WHERE username=?', [request.username], (dErr) => {
            if (dErr) return res.status(500).json({ message: dErr.message });
            if (empId) q('DELETE FROM Employees WHERE EmployeeID=?', [empId], () => finish());
            else finish();
          });
        };

        if (employeeId) {
          deleteUserThenEmployee(employeeId);
        } else if (fullName) {
          // Fallback for accounts created before the EmployeeID link existed:
          // match on "FirstName LastName" = fullName, but only if it's unambiguous.
          q(`SELECT EmployeeID FROM Employees WHERE CONCAT(FirstName,' ',LastName)=?`, [fullName], (mErr, mRows) => {
            const matchedId = (!mErr && mRows.length === 1) ? mRows[0].EmployeeID : null;
            deleteUserThenEmployee(matchedId);
          });
        } else {
          deleteUserThenEmployee(null);
        }
      });
    } else {
      finish();
    }
  });
});

// Direct delete — Admin only. Removes the Employees row outright (and any Users
// account still linked to it), regardless of whether it came through a request.
// This is the reliable path for purging test/dummy data or ex-staff records.
app.delete('/employees/:id', requireLevel(CLEARANCE.ADMIN), (req, res) => {
  const employeeId = parseInt(req.params.id, 10);
  q('DELETE FROM Users WHERE EmployeeID=?', [employeeId], (uErr) => {
    if (uErr) return res.status(500).json({ message: uErr.message });
    q('DELETE FROM Employees WHERE EmployeeID=?', [employeeId], (eErr, result) => {
      if (eErr) return res.status(500).json({ message: eErr.message });
      if (!result.affectedRows) return res.status(404).json({ message: 'Employee not found' });
      res.json({ message: 'Employee and any linked account deleted' });
    });
  });
});

// ── ACCOUNTS (Admin only — includes plaintext passwords) ─────────────────────
app.get('/accounts', requireLevel(CLEARANCE.ADMIN), (_req, res) => {
  // Passwords are withheld here by design — the frontend must call
  // POST /accounts/reveal with a verified PIN to actually see them.
  q(`SELECT u.UserID, u.username, u.fullName, u.level, u.role, u.isBanned, u.wallet,
            e.EmployeeID, e.Department,
            (u.PinHash IS NOT NULL) AS hasPin
     FROM Users u
     LEFT JOIN Employees e ON e.EmployeeID = u.EmployeeID
     ORDER BY u.username`,
    [], (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json(rows);
    });
});

// Admin sets/changes their own security PIN (required before passwords can be revealed).
// If a PIN already exists, the current one must be supplied to change it.
app.post('/accounts/set-pin', requireLevel(CLEARANCE.ADMIN), (req, res) => {
  const { username, pin, currentPin } = req.body;
  if (!username || !pin) return res.status(400).json({ message: 'username and pin required' });
  if (!/^\d{4,8}$/.test(String(pin))) return res.status(400).json({ message: 'PIN must be 4-8 digits' });

  q('SELECT PinHash, PinSalt FROM Users WHERE username=?', [username], (sErr, rows) => {
    if (sErr) return res.status(500).json({ message: sErr.message });
    if (!rows.length) return res.status(404).json({ message: 'Account not found' });
    const existing = rows[0];
    if (existing.PinHash) {
      if (!currentPin || hashPin(currentPin, existing.PinSalt) !== existing.PinHash) {
        return res.status(401).json({ message: 'Current PIN is incorrect' });
      }
    }
    const salt = newSalt();
    const hash = hashPin(pin, salt);
    q('UPDATE Users SET PinHash=?, PinSalt=? WHERE username=?', [hash, salt, username], (uErr) => {
      if (uErr) return res.status(500).json({ message: uErr.message });
      res.json({ message: 'PIN saved' });
    });
  });
});

// Reveal plaintext passwords — Admin only, and only with a correct PIN.
app.post('/accounts/reveal', requireLevel(CLEARANCE.ADMIN), (req, res) => {
  const { username, pin } = req.body;
  if (!username || !pin) return res.status(400).json({ message: 'username and pin required' });

  q('SELECT PinHash, PinSalt FROM Users WHERE username=?', [username], (sErr, rows) => {
    if (sErr) return res.status(500).json({ message: sErr.message });
    if (!rows.length) return res.status(404).json({ message: 'Account not found' });
    const admin = rows[0];
    if (!admin.PinHash) return res.status(400).json({ message: 'No PIN set yet — set one first' });
    if (hashPin(pin, admin.PinSalt) !== admin.PinHash) return res.status(401).json({ message: 'Incorrect PIN' });

    q(`SELECT username, password FROM Users ORDER BY username`, [], (pErr, pwRows) => {
      if (pErr) return res.status(500).json({ message: pErr.message });
      const map = {};
      pwRows.forEach(r => { map[r.username] = r.password; });
      res.json({ passwords: map });
    });
  });
});

// Admin only — one account + its linked employee record, for the Account Requests "Change" modal
app.get('/accounts/:username', requireLevel(CLEARANCE.ADMIN), (req, res) => {
  q(`SELECT u.UserID, u.username, u.fullName, u.level, u.role,
            e.EmployeeID, e.FirstName, e.LastName, e.Department, e.Email
     FROM Users u
     LEFT JOIN Employees e ON e.EmployeeID = u.EmployeeID
     WHERE u.username=?`,
    [req.params.username], (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      if (!rows.length) return res.status(404).json({ message: 'Account not found' });
      res.json(rows[0]);
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

// Update an existing employee (e.g. fix a missing/incorrect Department) — Manager level or above
// Admin only — update a Users row's clearance level/role (used by the Change-request modal)
app.patch('/accounts/:username', requireLevel(CLEARANCE.ADMIN), (req, res) => {
  const { level, role, fullName } = req.body;
  const fields = [];
  const vals   = [];
  if (level    !== undefined) { fields.push('level=?');    vals.push(Math.min(Math.max(parseInt(level, 10) || CLEARANCE.EMPLOYEE, CLEARANCE.STUDENT), CLEARANCE.ADMIN)); }
  if (role     !== undefined) { fields.push('role=?');     vals.push(role); }
  if (fullName !== undefined) { fields.push('fullName=?'); vals.push(fullName); }
  if (!fields.length) return res.status(400).json({ message: 'No fields to update' });
  vals.push(req.params.username);
  q(`UPDATE Users SET ${fields.join(', ')} WHERE username=?`, vals, (err) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json({ message: 'Account updated' });
  });
});

app.patch('/employees/:id', requireLevel(CLEARANCE.MANAGER), (req, res) => {
  const empId = parseInt(req.params.id, 10);
  const { firstName, lastName, department, email } = req.body;
  q('SELECT EmployeeID FROM Employees WHERE EmployeeID=?', [empId], (sErr, rows) => {
    if (sErr) return res.status(500).json({ message: sErr.message });
    if (!rows.length) return res.status(404).json({ message: 'Employee not found' });
    const fields = [];
    const vals   = [];
    if (firstName  !== undefined) { fields.push('FirstName=?');  vals.push(firstName); }
    if (lastName   !== undefined) { fields.push('LastName=?');   vals.push(lastName); }
    if (department !== undefined) { fields.push('Department=?'); vals.push(department); }
    if (email      !== undefined) { fields.push('Email=?');      vals.push(email); }
    if (!fields.length) return res.status(400).json({ message: 'No fields to update' });
    vals.push(empId);
    q(`UPDATE Employees SET ${fields.join(', ')}, UpdatedAt=NOW() WHERE EmployeeID=?`, vals, (uErr) => {
      if (uErr) return res.status(500).json({ message: uErr.message });
      res.json({ message: 'Employee updated' });
    });
  });
});

// Adding employees requires Manager clearance (level 4) or above.
// Every new employee automatically gets a linked login account (default clearance: Employee).
app.post('/employees', requireLevel(CLEARANCE.MANAGER), (req, res) => {
  const { firstName, lastName, department, jobTitle, email, photoData, photoMime } = req.body;
  if (!firstName || !lastName) return res.status(400).json({ message: 'firstName and lastName required' });

  // Clamp requested clearance level to a valid tier, and never let a creator grant
  // a level higher than their own (prevents a Manager from minting an Admin account).
  const creatorLevel = parseInt(req.headers['x-user-level'], 10) || CLEARANCE.EMPLOYEE;
  let requestedLevel = parseInt(req.body.level, 10) || CLEARANCE.EMPLOYEE;
  requestedLevel = Math.min(Math.max(requestedLevel, CLEARANCE.STUDENT), CLEARANCE.ADMIN);
  if (requestedLevel > creatorLevel) requestedLevel = creatorLevel;

  let photoBuffer = null;
  if (photoData) {
    const base64 = photoData.includes(',') ? photoData.split(',')[1] : photoData;
    photoBuffer = Buffer.from(base64, 'base64');
  }
  q('INSERT INTO Employees (FirstName,LastName,Department,Email,PhotoData,PhotoMime) VALUES (?,?,?,?,?,?)',
    [firstName, lastName, department||null, email||null, photoBuffer, photoMime||null],
    (err, result) => {
      if (err) { console.error('ADD EMPLOYEE:', err.message); return res.status(500).json({ message: err.message }); }
      const employeeId = result.insertId;

      findFreeUsername(firstName, lastName, (uErr, username) => {
        if (uErr) {
          console.error('USERNAME GEN:', uErr.message);
          return res.status(201).json({ message: 'Employee added, but account creation failed', employeeId });
        }
        const password = randomPassword();
        const role = ROLE_NAMES[requestedLevel] || 'Employee';
        q('INSERT INTO Users (username,password,fullName,level,role,EmployeeID) VALUES (?,?,?,?,?,?)',
          [username, password, `${firstName} ${lastName}`, requestedLevel, role, employeeId],
          (aErr) => {
            if (aErr) {
              console.error('AUTO ACCOUNT:', aErr.message);
              return res.status(201).json({ message: 'Employee added, but account creation failed', employeeId });
            }
            res.status(201).json({
              message: 'Employee added and account created',
              employeeId,
              account: { username, password, level: requestedLevel, role },
            });
          });
      });
    });
});

// ─── GLOBAL ERROR HANDLER ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('─── ERROR ──', req.method, req.originalUrl);
  console.error(err.message);
  res.status(500).json({ message: err.message || 'Internal server error' });
});

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 20240;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});