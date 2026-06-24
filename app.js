
  async function loadAssets() {
  try {

    const response = await fetch(
      'http://localhost:3000/assets'
    );

    assets = await response.json();

    assets = assets.map(a => ({
      id: a.AssetID,
      name: `${a.Brand} ${a.Model}`,
      status: a.Status.toLowerCase(),
      serial: a.SerialNumber,
      desc: `${a.Brand} ${a.Model}`,
      borrowedBy: null,
      returnDate: null
    }));

  } catch (err) {
    console.error(err);
    showNotif('Failed to load assets');
  }
}
// ─── STATE ───────────────────────────────────────────────────────────────────
let currentUser = null;
let selectedAssetId = null;
let cart = [];
let notifCount = 0;



let assets = [
  { id: 1001, name: 'Lenovo Thinkpad',    status: 'available',   serial: 'LNV-20240901', desc: 'Business laptop, Intel i7, 16GB RAM',     borrowedBy: null, returnDate: null },
  { id: 1002, name: 'Epson Printer',       status: 'unavailable', serial: 'EPS-20230815', desc: 'Color inkjet printer, A3 capable',         borrowedBy: 'Alex Warren', returnDate: '2026-07-10' },
  { id: 1003, name: 'Apple Macbook',       status: 'service',     serial: '789765467897654', desc: 'Apple MacBook Air 2018, 64GB core i7', borrowedBy: 'Alex Warren', returnDate: '2026-01-15' },
  { id: 1004, name: 'Cisco Switch 9100',   status: 'available',   serial: 'CSC-20220501', desc: '24-port managed network switch',          borrowedBy: null, returnDate: null },
  { id: 1005, name: 'Tapo Deco Router',    status: 'unavailable', serial: 'TPD-20231201', desc: 'Mesh Wi-Fi system, 6000 sq ft coverage',  borrowedBy: 'HR Dept', returnDate: '2026-06-30' },
  { id: 1006, name: 'Samsung Smart Fridge',status: 'available',   serial: 'SSF-20240301', desc: '21.5" touchscreen, 400L capacity',        borrowedBy: null, returnDate: null },
];

const DEPT_MEMBERS = {
  'IT Department':             [{ name: 'Rheniel', role: 'System Administrator', level: 5 }, { name: 'Sebastian', role: 'Network Engineer', level: 4 }],
  'Finance Department':        [{ name: 'Caroline', role: 'Finance Analyst', level: 3 }],
  'HR Department':             [{ name: 'Peter', role: 'HR Coordinator', level: 2 }],
  'Entertainment Department':  [{ name: 'Alex Warren', role: 'Musician', level: 2 }],
  'Research and Development':  [],
  'Security Department':       [],
  'Legal Department':          [],
  'Marketing Department':      [],
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

// ─── LOGIN ───────────────────────────────────────────────────────────────────
async function doLogin() {

const username =
  document.getElementById('login-user')
    .value.trim();

const password =
  document.getElementById('login-pass')
    .value;

const err =
  document.getElementById('login-error');

try {

  const response = await fetch(
    'http://localhost:3000/login',
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/json'
      },
      body: JSON.stringify({
        username,
        password
      })
    }
  );

  if (!response.ok) {
    err.textContent =
      '⚠ Invalid credentials';
    return;
  }

  const user =
    await response.json();

  currentUser = {
    username: user.username,
    fullName: user.fullName,
    level: user.level,
    role: user.role
  };

  await loadAssets();

  err.textContent = '';

  nav('dashboard');
  renderDashboard();

} catch (error) {

  console.error(error);

  err.textContent =
    'Server connection failed';

}

}
function logout() {
  currentUser = null;
  cart = [];
  notifCount = 0;
  nav('login');
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').textContent = '';
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function renderDashboard() {
  if (!currentUser) return;
  const lvl = currentUser.level;
  document.getElementById('dash-username').textContent = currentUser.fullName;
  document.getElementById('inv-username').textContent  = currentUser.fullName;

  const icons = [
    { emoji: '🖥', label: 'Asset Inventory', page: 'inventory',    minLevel: 2 },
    { emoji: '🔧', label: 'Maintenance Log', page: 'maintenance',   minLevel: 3 },
    { emoji: '🗂', label: 'Manage Assets',   page: 'manage-assets', minLevel: 4 },
    { emoji: '👥', label: 'Manage Employees',page: 'employees',     minLevel: 2 },
    { emoji: '🏢', label: 'Departments',     page: 'departments',   minLevel: 2 },
    { emoji: '⚙️', label: 'Settings',        page: 'settings',      minLevel: 2 },
  ];

  const grid = document.getElementById('dashboard-grid');
  // keep bg rings
  const rings = grid.querySelectorAll('.dash-bg-ring');
  grid.innerHTML = '';
  rings.forEach(r => grid.appendChild(r));

  icons.forEach(item => {
    if (lvl >= item.minLevel) {
      const btn = document.createElement('div');
      btn.className = 'dash-icon-btn';
      btn.innerHTML = `<div class="dash-circle">${item.emoji}</div><span class="dash-label">${item.label}</span>`;
      btn.onclick = () => nav(item.page);
      grid.appendChild(btn);
    }
  });

  updateAllUserLabels();
  updateAllNotifBadges();
}

function updateAllUserLabels() {
  document.querySelectorAll('.user-label').forEach(el => {
    if (currentUser) {
      el.textContent = currentUser.fullName;
    }
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
  const tbody = document.getElementById('inventory-tbody');
  const lvl = currentUser ? currentUser.level : 1;
  const canBorrow = lvl >= 3; // employees and above (lvl 3+) can borrow; students (lvl 2) cannot

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

  // set today+7 as default return date
  const d = new Date(); d.setDate(d.getDate()+7);
  document.getElementById('return-date').value = d.toISOString().slice(0,10);
}

function removeFromCart(id) {
  cart = cart.filter(c => c.id !== id);
  notifCount = Math.max(0, notifCount - 1);
  updateAllNotifBadges();
  renderCart();
}

function borrowCart() {
  if (cart.length === 0) { showNotif('Cart is empty'); return; }
  const rd = document.getElementById('return-date').value;
  if (!rd) { showNotif('Please set a return date'); return; }
  cart.forEach(item => {
    const asset = assets.find(a => a.id === item.id);
    if (asset) {
      asset.status = 'unavailable';
      asset.borrowedBy = currentUser.fullName;
      asset.returnDate = rd;
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
  document.getElementById('repair-serial').textContent = 'Serial Number: ' + asset.serial;
  if (asset.status === 'service') {
    document.getElementById('repair-issue1').textContent = 'Device reported issues';
    document.getElementById('repair-issue2').textContent = asset.borrowedBy ? asset.borrowedBy + ' reported this' : 'No additional notes';
    document.getElementById('repair-note1').textContent = 'Under inspection';
    document.getElementById('repair-note2').textContent = 'Repair in progress';
  }
  document.getElementById('repair-detail').style.display = 'block';
  document.getElementById('repair-detail').scrollIntoView({ behavior: 'smooth' });
}

function markAvailable() {
  const asset = assets.find(a => a.id === selectedAssetId);
  if (asset) {
    asset.status = 'available';
    asset.borrowedBy = null;
    asset.returnDate = null;
    showNotif(`✓ ${asset.name} status updated to Available`);
    document.getElementById('repair-detail').style.display = 'none';
    renderMaintenance();
  }
}

// ─── MANAGE ASSETS ───────────────────────────────────────────────────────────
function renderManageAssets() {
  const tbody = document.getElementById('manage-assets-tbody');
  const lvl = currentUser ? currentUser.level : 0;
  tbody.innerHTML = assets.map(a => `
    <tr>
      <td>${a.id}</td>
      <td>${a.name}</td>
      <td>${statusHtml(a.status)}</td>
      <td><button class="teal-btn" onclick="openAssetDetail(${a.id})">Monitor</button></td>
    </tr>
  `).join('');

  // Only admin (lvl 5) can add new assets
  document.getElementById('add-asset-section').style.display = lvl >= 5 ? 'block' : 'none';
}

function openAssetDetail(id) {
  selectedAssetId = id;
  const a = assets.find(x => x.id === id);
  const container = document.getElementById('asset-detail-content');
  const canEdit = currentUser && currentUser.level >= 5;
  container.innerHTML = `
    <div class="asset-detail-img">💻</div>
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
          <option value="available" ${a.status==='available'?'selected':''}>Available</option>
          <option value="unavailable" ${a.status==='unavailable'?'selected':''}>Not Available</option>
          <option value="service" ${a.status==='service'?'selected':''}>In Service</option>
        </select>
      </div>
      <button class="teal-btn" style="margin-top:8px; width:fit-content;" onclick="saveAssetStatus()">Save Changes</button>
      ` : ''}
    </div>
  `;
  nav('asset-detail');
}

function saveAssetStatus() {
  const sel = document.getElementById('edit-status').value;
  const a = assets.find(x => x.id === selectedAssetId);
  if (a) {
    a.status = sel;
    showNotif(`✓ ${a.name} status updated`);
  }
}

function addNewAsset() {
  const name = document.getElementById('new-device-name').value.trim();
  const serial = document.getElementById('new-serial').value.trim();
  const desc = document.getElementById('new-desc').value.trim();
  if (!name) { showNotif('Please enter a device name'); return; }
  const newId = Math.max(...assets.map(a => a.id)) + 1;
  assets.push({ id: newId, name, status: 'available', serial: serial || 'N/A', desc: desc || 'No description', borrowedBy: null, returnDate: null });
  document.getElementById('new-device-name').value = '';
  document.getElementById('new-serial').value = '';
  document.getElementById('new-model').value = '';
  document.getElementById('new-desc').value = '';
  showNotif(`✓ Asset "${name}" added (ID: ${newId})`);
  renderManageAssets();
}

// ─── EMPLOYEES ───────────────────────────────────────────────────────────────
function renderEmployees() {
  const lvl = currentUser ? currentUser.level : 0;
  document.getElementById('add-emp-section').style.display = lvl >= 5 ? 'block' : 'none';
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
  badge.textContent = name;
  badge.style.background = DEPT_COLORS[name] || color;

  const topbar = document.getElementById('dept-topbar');
  topbar.style.background = `linear-gradient(90deg, #000 0%, #0a0a20 40%, ${DEPT_COLORS[name] || color} 100%)`;

  const tbody = document.getElementById('dept-member-tbody');
  const members = DEPT_MEMBERS[name] || [];
  const roleClass = { 2: 'role-2', 3: 'role-3', 4: 'role-4', 5: 'role-5' };
  const roleName = { 2: 'Employee', 3: 'Maintenance', 4: 'Manager', 5: 'Admin' };

  tbody.innerHTML = members.length ? members.map(m => `
    <tr>
      <td>${m.name}</td>
      <td>${m.role}</td>
      <td><span class="role-badge ${roleClass[m.level] || 'role-2'}">${roleName[m.level] || 'Employee'}</span></td>
    </tr>
  `).join('') : `<tr><td colspan="3" style="color:var(--muted); padding:20px; text-align:center;">No members in this department</td></tr>`;

  // Apply dept color to header
  const th_color = DEPT_COLORS[name] || color;
  document.querySelectorAll('#dept-member-table th').forEach(th => {
    th.style.borderBottomColor = th_color;
    th.style.background = th_color + '22';
    th.style.color = '#fff';
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
