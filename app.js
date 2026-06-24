// ─── CONFIG ───────────────────────────────────────────────────────────────────
// Update this if your server runs on a different host or port
const API = 'http://localhost:3000';

// ─── ASSETS (loaded from server) ─────────────────────────────────────────────
async function loadAssets() {
  try {
    const response = await fetch(`${API}/assets`);
    if (!response.ok) throw new Error('Failed to fetch assets');

    const raw = await response.json();

    assets = raw.map(a => ({
      id:         a.AssetID,
      name:       `${a.Brand} ${a.Model}`,
      status:     a.Status.toLowerCase(),
      serial:     a.SerialNumber,
      desc:       `${a.Brand} ${a.Model}`,
      borrowedBy: null,
      returnDate: null,
      // Build full photo URL if one is stored; otherwise null
      photoUrl:   a.PhotoPath ? `${API}/uploads/${a.PhotoPath}` : null,
    }));

  } catch (err) {
    console.error(err);
    showNotif('Failed to load assets from server');
  }
}

// ─── STATE ───────────────────────────────────────────────────────────────────
let currentUser    = null;
let selectedAssetId = null;
let cart           = [];
let notifCount     = 0;

let assets = [
  { id: 1001, name: 'Lenovo Thinkpad',     status: 'available',   serial: 'LNV-20240901',   desc: 'Business laptop, Intel i7, 16GB RAM',     borrowedBy: null,         returnDate: null,         photoUrl: null },
  { id: 1002, name: 'Epson Printer',        status: 'unavailable', serial: 'EPS-20230815',   desc: 'Color inkjet printer, A3 capable',         borrowedBy: 'Alex Warren', returnDate: '2026-07-10', photoUrl: null },
  { id: 1003, name: 'Apple Macbook',        status: 'service',     serial: '789765467897654', desc: 'Apple MacBook Air 2018, 64GB core i7',    borrowedBy: 'Alex Warren', returnDate: '2026-01-15', photoUrl: null },
  { id: 1004, name: 'Cisco Switch 9100',    status: 'available',   serial: 'CSC-20220501',   desc: '24-port managed network switch',           borrowedBy: null,         returnDate: null,         photoUrl: null },
  { id: 1005, name: 'Tapo Deco Router',     status: 'unavailable', serial: 'TPD-20231201',   desc: 'Mesh Wi-Fi system, 6000 sq ft coverage',  borrowedBy: 'HR Dept',    returnDate: '2026-06-30', photoUrl: null },
  { id: 1006, name: 'Samsung Smart Fridge', status: 'available',   serial: 'SSF-20240301',   desc: '21.5" touchscreen, 400L capacity',         borrowedBy: null,         returnDate: null,         photoUrl: null },
];

const DEPT_MEMBERS = {
  'IT Department': [
    { name: 'Rheniel', role: 'System Administrator', level: 5, manager: null },
    { name: 'Sebastian', role: 'Network Engineer', level: 4, manager: 'Rheniel' }
  ],

  'Finance Department': [
    { name: 'Caroline', role: 'Finance Analyst', level: 3, manager: 'Sebastian' }
  ],

  'HR Department': [
    { name: 'Peter', role: 'HR Coordinator', level: 2, manager: 'Caroline' }
  ],

  'Entertainment Department': [
    { name: 'Alex Warren', role: 'Musician', level: 2, manager: 'Peter' }
  ],

  'Research and Development': [
    { name: 'Research Employee 1', role: 'Research Assistant', level: 2, manager: 'Rheniel' }
  ],

  'Security Department': [
    { name: 'Security Officer 1', role: 'Security Officer', level: 2, manager: 'Sebastian' }
  ],

  'Legal Department': [
    { name: 'Legal Assistant 1', role: 'Legal Assistant', level: 2, manager: 'Sebastian' }
  ],

  'Marketing Department': [
    { name: 'Marketing Staff 1', role: 'Marketing Associate', level: 2, manager: 'Sebastian' }
  ]
};

const DEPT_COLORS = {
  'IT Department': '#c00', 'Finance Department': '#e07000', 'HR Department': '#c09000',
  'Entertainment Department': '#5a9900', 'Research and Development': '#009ad0',
  'Security Department': '#003caa', 'Legal Department': '#7020c0', 'Marketing Department': '#cc0080',
};

// ─── NAVIGATION ──────────────────────────────────────────────────────────────
function nav(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  window.scrollTo(0, 0);
  if (page === 'inventory')     renderInventory();
  if (page === 'maintenance')   renderMaintenance();
  if (page === 'manage-assets') renderManageAssets();
  if (page === 'employees')     renderEmployees();
  if (page === 'dashboard')     renderDashboard();
  if (page === 'settings')      renderSettings();
  if (page === 'cart')          renderCart();
}

// ─── LOCAL ACCOUNTS (fallback when server is offline) ────────────────────────
// Seeded with the same users your server has, so offline mode matches.
const SEED_ACCOUNTS = [
  { username: 'rheniel',  password: 'password', fullName: 'Rheniel',  level: 5, role: 'System Administrator' },
  { username: 'sebastian',password: 'password', fullName: 'Sebastian',level: 4, role: 'Network Engineer' },
  { username: 'caroline', password: 'password', fullName: 'Caroline', level: 3, role: 'Finance Analyst' },
  { username: 'peter',    password: 'password', fullName: 'Peter',    level: 2, role: 'HR Coordinator' },
];

function getLocalAccounts() {
  try {
    return JSON.parse(localStorage.getItem('crispytech_accounts') || '[]');
  } catch { return []; }
}

function saveLocalAccounts(accounts) {
  localStorage.setItem('crispytech_accounts', JSON.stringify(accounts));
}

function findLocalUser(username, password) {
  const all = [...SEED_ACCOUNTS, ...getLocalAccounts()];
  return all.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password) || null;
}

// ─── LOGIN ───────────────────────────────────────────────────────────────────
async function doLogin() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  const err      = document.getElementById('login-error');

  if (!username || !password) {
    err.textContent = '⚠ Please enter username and password';
    return;
  }

  // ── Try the real server first ─────────────────────────────────────────────
  try {
    const response = await fetch(`${API}/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
      // Short timeout so offline feels fast, not frozen
      signal:  AbortSignal.timeout(3000),
    });

    if (response.ok) {
      const user = await response.json();
      currentUser = {
        username: user.username,
        fullName: user.fullName,
        level:    user.level,
        role:     user.role,
      };
     await loadAssets();
await loadEmployees();
      err.textContent = '';
      nav('dashboard');
      renderDashboard();
      return;
    }

    // Server is up but credentials are wrong — don't fall through to local
    err.textContent = '⚠ Invalid credentials';
    return;

  } catch (networkErr) {
    // Server unreachable — fall through to offline bypass below
    console.warn('Server offline, trying local accounts:', networkErr.message);
  }

  // ── Offline bypass — check local accounts ────────────────────────────────
  const localUser = findLocalUser(username, password);
  if (localUser) {
    currentUser = {
      username: localUser.username,
      fullName: localUser.fullName,
      level:    localUser.level,
      role:     localUser.role,
    };
    // assets stay as the hardcoded fallback array (loadAssets silently failed)
    err.textContent = '';
    showNotif('⚠ Offline mode — using local data');
    nav('dashboard');
    renderDashboard();
    return;
  }

  err.textContent = '⚠ Invalid credentials (server offline)';
}

// ─── CREATE ACCOUNT ──────────────────────────────────────────────────────────
function openCreateAccount() {
  ['ca-fullname','ca-username','ca-password','ca-password2'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('ca-level').value  = '2';
  document.getElementById('ca-error').textContent = '';
  const modal = document.getElementById('modal-create-account');
  modal.style.display = 'flex';
}

function closeCreateAccount() {
  document.getElementById('modal-create-account').style.display = 'none';
}

async function submitCreateAccount() {
  const fullName = document.getElementById('ca-fullname').value.trim();
  const username = document.getElementById('ca-username').value.trim();
  const password = document.getElementById('ca-password').value;
  const confirm  = document.getElementById('ca-password2').value;
  const level    = parseInt(document.getElementById('ca-level').value, 10);
  const caErr    = document.getElementById('ca-error');

  // Basic validation
  if (!fullName)             { caErr.textContent = '⚠ Full name is required';       return; }
  if (!username)             { caErr.textContent = '⚠ Username is required';         return; }
  if (username.includes(' ')){ caErr.textContent = '⚠ Username cannot have spaces';  return; }
  if (password.length < 4)   { caErr.textContent = '⚠ Password too short (min 4)';   return; }
  if (password !== confirm)  { caErr.textContent = '⚠ Passwords do not match';       return; }

  // Check for duplicate username locally
  const existing = [...SEED_ACCOUNTS, ...getLocalAccounts()];
  if (existing.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    caErr.textContent = '⚠ Username already taken';
    return;
  }

  const levelRoles = { 2: 'Employee', 3: 'Maintenance', 4: 'Manager', 5: 'Admin' };
  const newAccount = { username, password, fullName, level, role: levelRoles[level] || 'Employee' };

  // ── Try to register on the server ────────────────────────────────────────
  let serverOk = false;
  try {
    const res = await fetch(`${API}/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(newAccount),
      signal:  AbortSignal.timeout(3000),
    });
    serverOk = res.ok;
  } catch {
    // server offline — save locally only
  }

  // Always save locally so it survives offline sessions
  const locals = getLocalAccounts();
  locals.push(newAccount);
  saveLocalAccounts(locals);

  closeCreateAccount();
  showNotif(`✓ Account "${username}" created${serverOk ? '' : ' (offline — syncs when server is back)'}`);

  // Auto-fill the login form for convenience
  document.getElementById('login-user').value = username;
  document.getElementById('login-pass').value = password;
}

function logout() {
  currentUser = null;
  cart = [];
  notifCount = 0;
  nav('login');
  document.getElementById('login-user').value  = '';
  document.getElementById('login-pass').value  = '';
  document.getElementById('login-error').textContent = '';
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function renderDashboard() {
  if (!currentUser) return;
  const lvl = currentUser.level;
  document.getElementById('dash-username').textContent = currentUser.fullName;
  document.getElementById('inv-username').textContent  = currentUser.fullName;

  const icons = [
  { icon: 'fa-solid fa-laptop', label: 'Asset Inventory', page: 'inventory', minLevel: 2 },
  { icon: 'fa-solid fa-screwdriver-wrench', label: 'Maintenance Log', page: 'maintenance', minLevel: 3 },
  { icon: 'fa-solid fa-boxes-stacked', label: 'Manage Assets', page: 'manage-assets', minLevel: 4 },
  { icon: 'fa-solid fa-users', label: 'Manage Employees', page: 'employees', minLevel: 2 },
  { icon: 'fa-solid fa-building', label: 'Departments', page: 'departments', minLevel: 2 },
  { icon: 'fa-solid fa-gears', label: 'Settings', page: 'settings', minLevel: 2 }
];
  const grid = document.getElementById('dashboard-grid');
  const rings = grid.querySelectorAll('.dash-bg-ring');
  grid.innerHTML = '';
  rings.forEach(r => grid.appendChild(r));

  icons.forEach(item => {
    if (lvl >= item.minLevel) {
      const btn = document.createElement('div');
      btn.className = 'dash-icon-btn';
     btn.innerHTML =
`<div class="dash-circle">
    <i class="${item.icon}"></i>
</div>
<span class="dash-label">${item.label}</span>`;
      btn.onclick = () => nav(item.page);
      grid.appendChild(btn);
    }
  });

  updateAllUserLabels();
  updateAllNotifBadges();
}

function updateAllUserLabels() {
  document.querySelectorAll('.user-label').forEach(el => {
    if (currentUser) el.textContent = currentUser.fullName;
  });
}
function updateAllNotifBadges() {
  document.querySelectorAll('.notif-badge').forEach(el => {
    el.textContent = notifCount;
  });
}

// ─── INVENTORY ───────────────────────────────────────────────────────────────
function statusHtml(s) {
  if (s === 'available')   return `<span class="status-dot"><span class="dot available"></span> Available</span>`;
  if (s === 'unavailable') return `<span class="status-dot"><span class="dot unavailable"></span> Not Available</span>`;
  return `<span class="status-dot"><span class="dot service"></span> In Service</span>`;
}

function renderInventory() {
  const tbody    = document.getElementById('inventory-tbody');
  const lvl      = currentUser ? currentUser.level : 1;
  const canBorrow = lvl >= 3;

  tbody.innerHTML = assets.map(a => {
    const inCart = cart.find(c => c.id === a.id);
    const canAdd = canBorrow && a.status === 'available' && !inCart;
    return `<tr>
      <td>${a.id}</td>
      <td>${a.name}</td>
      <td>${statusHtml(a.status)}</td>
      <td>
        <button class="add-btn" ${canAdd ? '' : 'disabled'} onclick="addToCart(${a.id})">
          Add +
        </button>
      </td>
    </tr>`;
  }).join('');

  if (!canBorrow) {
    const note = document.createElement('p');
    note.style.cssText = 'font-size:12px; color:var(--muted); font-family:Share Tech Mono,monospace; margin-top:10px;';
    note.textContent = '⚠ Students cannot borrow assets. Contact your manager.';
    document.getElementById('inventory-tbody').parentElement.after(note);
  }
}

function addToCart(id) {
  const asset = assets.find(a => a.id === id);
  if (!asset || asset.status !== 'available') return;
  if (cart.find(c => c.id === id)) { showNotif('Already in cart'); return; }
  cart.push(asset);
  notifCount++;
  updateAllNotifBadges();
  showNotif(`${asset.name} added to lending cart`);
  renderInventory();
}

function gotoCart() {
  if (!currentUser) return;
  if (currentUser.level < 3) { showNotif('Students cannot borrow assets'); return; }
  nav('cart');
}

// ─── CART ────────────────────────────────────────────────────────────────────
function renderCart() {
  const tbody = document.getElementById('cart-tbody');
  if (cart.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted); font-style:italic; padding:20px;">Cart is empty. Add assets from inventory.</td></tr>';
    return;
  }
  tbody.innerHTML = cart.map(a => `
    <tr>
      <td>${a.id}</td>
      <td>${a.name}</td>
      <td>${statusHtml(a.status)}</td>
      <td><input type="date" class="field-input" style="width:150px; padding:6px 10px; font-size:12px;"></td>
      <td><button class="add-btn" onclick="removeFromCart(${a.id})">✕ Remove</button></td>
    </tr>
  `).join('');

  const d = new Date(); d.setDate(d.getDate() + 7);
  document.getElementById('return-date').value = d.toISOString().slice(0, 10);
}

function removeFromCart(id) {
  cart = cart.filter(c => c.id !== id);
  notifCount = Math.max(0, notifCount - 1);
  updateAllNotifBadges();
  renderCart();
}

function borrowCart() {
  if (cart.length === 0)                         { showNotif('Cart is empty'); return; }
  const rd = document.getElementById('return-date').value;
  if (!rd)                                        { showNotif('Please set a return date'); return; }

  cart.forEach(item => {
    const asset = assets.find(a => a.id === item.id);
    if (asset) {
      asset.status     = 'unavailable';
      asset.borrowedBy  = currentUser.fullName;
      asset.returnDate  = rd;
    }
  });

  showNotif(`✓ ${cart.length} item(s) borrowed successfully!`);
  cart = [];
  notifCount = 0;
  updateAllNotifBadges();
  nav('inventory');
}

// ─── MAINTENANCE ─────────────────────────────────────────────────────────────
function renderMaintenance() {
  const tbody = document.getElementById('maintenance-tbody');
  tbody.innerHTML = assets.map(a => `
    <tr>
      <td>${a.id}</td>
      <td>${a.name}</td>
      <td>${statusHtml(a.status)}</td>
      <td>
        <button class="teal-btn" onclick="openRepair(${a.id})" ${a.status === 'service' ? '' : 'style="opacity:0.4"'}>Repair</button>
      </td>
    </tr>
  `).join('');
  document.getElementById('repair-detail').style.display = 'none';
}

function openRepair(id) {
  selectedAssetId = id;
  const asset = assets.find(a => a.id === id);
  document.getElementById('repair-device-name').textContent = 'Device Name: ' + asset.name;
  document.getElementById('repair-serial').textContent      = 'Serial Number: ' + asset.serial;
  if (asset.status === 'service') {
    document.getElementById('repair-issue1').textContent = 'Device reported issues';
    document.getElementById('repair-issue2').textContent = asset.borrowedBy ? asset.borrowedBy + ' reported this' : 'No additional notes';
    document.getElementById('repair-note1').textContent  = 'Under inspection';
    document.getElementById('repair-note2').textContent  = 'Repair in progress';
  }
  document.getElementById('repair-detail').style.display = 'block';
  document.getElementById('repair-detail').scrollIntoView({ behavior: 'smooth' });
}

function markAvailable() {
  const asset = assets.find(a => a.id === selectedAssetId);
  if (asset) {
    asset.status     = 'available';
    asset.borrowedBy  = null;
    asset.returnDate  = null;
    showNotif(`✓ ${asset.name} status updated to Available`);
    document.getElementById('repair-detail').style.display = 'none';
    renderMaintenance();
  }
}

// ─── MANAGE ASSETS ───────────────────────────────────────────────────────────
function renderManageAssets() {
  const tbody = document.getElementById('manage-assets-tbody');
  const lvl   = currentUser ? currentUser.level : 0;
  tbody.innerHTML = assets.map(a => `
    <tr>
      <td>${a.id}</td>
      <td>${a.name}</td>
      <td>${statusHtml(a.status)}</td>
      <td><button class="teal-btn" onclick="openAssetDetail(${a.id})">Monitor</button></td>
    </tr>
  `).join('');

  document.getElementById('add-asset-section').style.display = lvl >= 5 ? 'block' : 'none';
}

function openAssetDetail(id) {
  selectedAssetId = id;
  const a       = assets.find(x => x.id === id);
  const container = document.getElementById('asset-detail-content');
  const canEdit = currentUser && currentUser.level >= 5;

  // Photo display: show existing photo or a placeholder emoji
  const photoSrc = a.photoUrl || null;
  const photoHtml = photoSrc
    ? `<img id="asset-photo-img" src="${photoSrc}" alt="${a.name}" style="width:120px; height:120px; object-fit:cover; border-radius:10px; border:2px solid var(--teal, #00bcd4);">`
    : `<div id="asset-photo-img" class="asset-detail-img">💻</div>`;

  // Photo upload controls (admin only)
  const uploadHtml = canEdit ? `
    <div class="field-group" style="margin-top:12px;">
      <span class="field-label">Asset Photo</span>
      <div style="display:flex; align-items:center; gap:10px; margin-top:6px; flex-wrap:wrap;">
        <input type="file" id="photo-file-input" accept="image/*"
          style="display:none;" onchange="previewPhoto(event)">
        <button class="teal-btn" style="width:fit-content;"
          onclick="document.getElementById('photo-file-input').click()">
          📷 Choose Photo
        </button>
        ${a.photoUrl ? `<button class="add-btn" style="width:fit-content;" onclick="deletePhoto(${a.id})">🗑 Remove Photo</button>` : ''}
      </div>
      <div id="photo-preview-area" style="margin-top:8px;"></div>
      <button id="upload-photo-btn" class="teal-btn"
        style="margin-top:8px; width:fit-content; display:none;"
        onclick="uploadPhoto(${a.id})">
        ⬆ Upload Photo
      </button>
    </div>
  ` : '';

  container.innerHTML = `
    <div style="display:flex; justify-content:center; margin-bottom:8px;">
      ${photoHtml}
    </div>
    <div class="asset-fields">
      <div class="field-group">
        <span class="field-label">Device Name</span>
        <div class="field-value">${a.name}</div>
      </div>
      <div class="field-row">
        <div class="field-group">
          <span class="field-label">Serial Number</span>
          <div class="field-value">${a.serial}</div>
        </div>
        <div class="field-group">
          <span class="field-label">Asset ID</span>
          <div class="field-value">${a.id}</div>
        </div>
      </div>
      <div class="field-group">
        <span class="field-label">Asset Description</span>
        <div class="field-value" style="font-weight:400; font-size:12px;">${a.desc}</div>
      </div>
      <div class="field-row">
        <div class="field-group">
          <span class="field-label">Status</span>
          <div style="margin-top:4px;">${statusHtml(a.status)}</div>
        </div>
        <div class="field-group">
          <span class="field-label">Last User</span>
          <div class="field-value">${a.borrowedBy || '—'}</div>
        </div>
        <div class="field-group">
          <span class="field-label">Return Date</span>
          <div class="field-value">${a.returnDate || '—'}</div>
        </div>
      </div>
      ${canEdit ? `
      <div class="field-group" style="margin-top:8px;">
        <span class="field-label">Update Status</span>
        <select class="field-input" id="edit-status" style="max-width:200px;">
          <option value="available"   ${a.status === 'available'   ? 'selected' : ''}>Available</option>
          <option value="unavailable" ${a.status === 'unavailable' ? 'selected' : ''}>Not Available</option>
          <option value="service"     ${a.status === 'service'     ? 'selected' : ''}>In Service</option>
        </select>
      </div>
      <button class="teal-btn" style="margin-top:8px; width:fit-content;" onclick="saveAssetStatus()">
        Save Changes
      </button>
      ` : ''}
      ${uploadHtml}
    </div>
  `;

  nav('asset-detail');
}

// ── Photo upload helpers ──────────────────────────────────────────────────────

// Show a local preview before actually uploading
function previewPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    const area = document.getElementById('photo-preview-area');
    area.innerHTML = `
      <img src="${e.target.result}" alt="Preview"
        style="width:100px; height:100px; object-fit:cover; border-radius:8px;
               border:2px dashed var(--teal, #00bcd4); margin-top:4px;">
      <p style="font-size:11px; color:var(--muted); margin:4px 0 0;">
        Preview — click Upload to save
      </p>`;
    document.getElementById('upload-photo-btn').style.display = 'inline-block';
  };
  reader.readAsDataURL(file);
}

// Send the chosen file to the server
async function uploadPhoto(assetId) {
  const input = document.getElementById('photo-file-input');
  if (!input.files.length) { showNotif('No file selected'); return; }

  const formData = new FormData();
  formData.append('photo', input.files[0]);

  showNotif('⬆ Uploading…');

  try {
    const res = await fetch(`${API}/assets/${assetId}/photo`, {
      method: 'POST',
      body:   formData,           // Don't set Content-Type; browser sets multipart boundary
    });

    if (!res.ok) {
      const err = await res.json();
      showNotif('Upload failed: ' + (err.message || res.status));
      return;
    }

    const data = await res.json();

    // Update local asset object so the UI reflects the new photo immediately
    const asset = assets.find(a => a.id === assetId);
    if (asset) asset.photoUrl = `${API}/uploads/${data.photoPath}`;

    showNotif('✓ Photo uploaded successfully!');
    openAssetDetail(assetId);   // Re-render detail with the real photo

  } catch (err) {
    console.error(err);
    showNotif('Upload error — is the server running?');
  }
}

// Delete the photo from server and clear locally
async function deletePhoto(assetId) {
  if (!confirm('Remove this photo?')) return;

  try {
    const res = await fetch(`${API}/assets/${assetId}/photo`, { method: 'DELETE' });
    if (!res.ok) { showNotif('Delete failed'); return; }

    const asset = assets.find(a => a.id === assetId);
    if (asset) asset.photoUrl = null;

    showNotif('✓ Photo removed');
    openAssetDetail(assetId);

  } catch (err) {
    console.error(err);
    showNotif('Delete error');
  }
}

// ── New-asset photo preview (before the asset is saved) ──────────────────────
function previewNewAssetPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    const display = document.getElementById('new-asset-photo-display');
    display.innerHTML = '';                       // clear emoji placeholder
    const img = document.createElement('img');
    img.src = e.target.result;
    img.alt = 'Asset preview';
    img.style.cssText = 'width:100px; height:100px; object-fit:cover; border-radius:10px; border:2px solid var(--teal,#00bcd4);';
    display.appendChild(img);

    document.getElementById('new-asset-photo-name').textContent = file.name;
  };
  reader.readAsDataURL(file);
}

// ── Employee photo preview ────────────────────────────────────────────────────
function previewEmpPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    const display = document.getElementById('new-emp-photo-display');
    display.innerHTML = '';
    const img = document.createElement('img');
    img.src = e.target.result;
    img.alt = 'Employee photo';
    img.style.cssText = 'width:80px; height:80px; object-fit:cover; border-radius:50%; border:2px solid var(--teal,#00bcd4);';
    display.appendChild(img);

    document.getElementById('new-emp-photo-name').textContent = file.name;
  };
  reader.readAsDataURL(file);
}

// ── Employee resume selection feedback ───────────────────────────────────────
function previewEmpResume(event) {
  const file = event.target.files[0];
  if (!file) return;
  document.getElementById('new-emp-resume-name').textContent = '📄 ' + file.name;
}

function saveAssetStatus() {
  const sel   = document.getElementById('edit-status').value;
  const a     = assets.find(x => x.id === selectedAssetId);
  if (a) {
    a.status = sel;
    showNotif(`✓ ${a.name} status updated`);
  }
}

function addNewAsset() {
  const name   = document.getElementById('new-device-name').value.trim();
  const serial = document.getElementById('new-serial').value.trim();
  const desc   = document.getElementById('new-desc').value.trim();
  if (!name) { showNotif('Please enter a device name'); return; }
  const newId = Math.max(...assets.map(a => a.id)) + 1;
  assets.push({ id: newId, name, status: 'available', serial: serial || 'N/A', desc: desc || 'No description', borrowedBy: null, returnDate: null, photoUrl: null });
  document.getElementById('new-device-name').value    = '';
  document.getElementById('new-serial').value          = '';
  document.getElementById('new-model').value           = '';
  document.getElementById('new-desc').value            = '';
  document.getElementById('new-asset-photo-input').value = '';
  document.getElementById('new-asset-photo-display').innerHTML = '🖼️';
  document.getElementById('new-asset-photo-name').textContent  = '';
  showNotif(`✓ Asset "${name}" added (ID: ${newId})`);
  renderManageAssets();
}

// ─── EMPLOYEES ───────────────────────────────────────────────────────────────
let employees = [];

async function loadEmployees() {
  try {
    const response = await fetch(`${API}/employees`);

    if (!response.ok)
      throw new Error('Failed to fetch employees');

    employees = await response.json();
  } catch (err) {
    console.error(err);
  }
}

function renderEmployees() {
  console.log(employees);

  const lvl = currentUser ? currentUser.level : 0;

  document.getElementById('add-emp-section').style.display =
    lvl >= 5 ? 'block' : 'none';

  const container = document.getElementById('emp-view-section');

  if (!employees || employees.length === 0) {
    container.innerHTML = `
      <div class="emp-card">
        <div class="emp-info">
          <div class="field-value">
            No employees loaded from database
          </div>
        </div>
      </div>
    `;
    return;
  }

  // existing map code here
}
function addEmployee() {
  const name = document.getElementById('new-emp-name').value.trim();
  if (!name) { showNotif('Please enter an employee name'); return; }
  showNotif(`✓ Employee "${name}" added successfully`);
  ['new-emp-name','new-emp-years','new-emp-dept','new-emp-title','new-emp-phone','new-emp-email'].forEach(id => {
    document.getElementById(id).value = '';
  });
}

// ─── DEPARTMENTS ─────────────────────────────────────────────────────────────
function openDept(name, color) {
  const badge = document.getElementById('dept-badge');
  badge.textContent    = name;
  badge.style.background = DEPT_COLORS[name] || color;

  const topbar = document.getElementById('dept-topbar');
  topbar.style.background = `linear-gradient(90deg, #000 0%, #0a0a20 40%, ${DEPT_COLORS[name] || color} 100%)`;

  const tbody    = document.getElementById('dept-member-tbody');
  const members  = DEPT_MEMBERS[name] || [];
  const roleClass = { 2: 'role-2', 3: 'role-3', 4: 'role-4', 5: 'role-5' };
  const roleName  = { 2: 'Employee', 3: 'Maintenance', 4: 'Manager', 5: 'Admin' };

  tbody.innerHTML = members.length ? members.map(m => `
    <tr>
      <td>${m.name}</td>
      <td>${m.role}</td>
      <td><span class="role-badge ${roleClass[m.level] || 'role-2'}">${roleName[m.level] || 'Employee'}</span></td>
    </tr>
  `).join('') : `<tr><td colspan="3" style="color:var(--muted); padding:20px; text-align:center;">No members in this department</td></tr>`;

  const th_color = DEPT_COLORS[name] || color;
  document.querySelectorAll('#dept-member-table th').forEach(th => {
    th.style.borderBottomColor = th_color;
    th.style.background        = th_color + '22';
    th.style.color             = '#fff';
  });

  nav('dept-detail');
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────
function renderSettings() {
  if (!currentUser) return;
  document.getElementById('settings-username').textContent = currentUser.fullName;
  const levelLabels = { 2: 'Level 2 — Student/Employee', 3: 'Level 3 — Maintenance', 4: 'Level 4 — Manager', 5: 'Level 5 — Admin' };
  document.getElementById('settings-level').textContent = levelLabels[currentUser.level] || currentUser.level;
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
let toastTimer;
function showNotif(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── INIT ────────────────────────────────────────────────────────────────────
nav('login');