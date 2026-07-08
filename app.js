// ─── CONFIG ───────────────────────────────────────────────────────────────────
const API = 'http://localhost:3000';

// ─── AUTH FETCH ──────────────────────────────────────────────────────────────
// Wraps fetch() and attaches the logged-in user's clearance level so the server
// can enforce permissions (create/ban accounts, asset management, wallets, etc).
function authFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (currentUser) headers['x-user-level'] = String(currentUser.level);
  return fetch(url, { ...options, headers });
}

// ─── CLEARANCE LEVELS ────────────────────────────────────────────────────────
// 1 = Student      — view only, cannot borrow
// 2 = Employee     — borrow / return assets
// 3 = Maintenance  — maintenance log + asset management + repair
// 4 = Manager      — everything except create/ban accounts
// 5 = Admin        — everything
const CLEARANCE = { STUDENT: 1, EMPLOYEE: 2, MAINTENANCE: 3, MANAGER: 4, ADMIN: 5 };

// ─── STATE ───────────────────────────────────────────────────────────────────
let currentUser     = null;
let selectedAssetId = null;
let cart            = [];
let notifCount      = 0;
let walletTarget    = null; // for wallet modal

let assets = [
  { id: 1001, name: 'Lenovo Thinkpad',     status: 'available',   serial: 'LNV-20240901',    desc: 'Business laptop, Intel i7, 16GB RAM',    borrowedBy: null,         returnDate: null, dailyCost: 50,  photoUrl: null },
  { id: 1002, name: 'Epson Printer',        status: 'unavailable', serial: 'EPS-20230815',    desc: 'Color inkjet printer, A3 capable',        borrowedBy: 'Alex Warren', returnDate: '2026-07-10', dailyCost: 20, photoUrl: null },
  { id: 1003, name: 'Apple Macbook',        status: 'service',     serial: '789765467897654', desc: 'Apple MacBook Air 2018, 64GB core i7',   borrowedBy: 'Alex Warren', returnDate: '2026-01-15', dailyCost: 80, photoUrl: null },
  { id: 1004, name: 'Cisco Switch 9100',    status: 'available',   serial: 'CSC-20220501',    desc: '24-port managed network switch',          borrowedBy: null,         returnDate: null, dailyCost: 30,  photoUrl: null },
  { id: 1005, name: 'Tapo Deco Router',     status: 'unavailable', serial: 'TPD-20231201',    desc: 'Mesh Wi-Fi system, 6000 sq ft coverage', borrowedBy: 'HR Dept',    returnDate: '2026-06-30', dailyCost: 15, photoUrl: null },
  { id: 1006, name: 'Samsung Smart Fridge', status: 'available',   serial: 'SSF-20240301',    desc: '21.5" touchscreen, 400L capacity',        borrowedBy: null,         returnDate: null, dailyCost: 10,  photoUrl: null },
];

const DEPT_COLORS = {
  'IT Department': '#c00', 'Finance Department': '#e07000', 'HR Department': '#c09000',
  'Entertainment Department': '#5a9900', 'Research and Development': '#009ad0',
  'Security Department': '#003caa', 'Legal Department': '#7020c0', 'Marketing Department': '#cc0080',
};

const AI_JOKES = [
  "Why did the AI go to therapy? It had too many deep learning issues.",
  "I asked ChatGPT to tell me a joke. It said 'Error 404: Humor not found.' Then it wrote me 3 paragraphs explaining why.",
  "Claude doesn't sleep. It just waits for the next prompt.",
  "Why don't AIs ever get lost? Because they always follow the gradient.",
  "ChatGPT walked into a bar. The bartender said 'We don't serve AI here.' ChatGPT said 'That's okay, I'll just hallucinate a drink.'",
  "Why did the neural network break up with the decision tree? It said 'You just don't have enough layers.'",
  "I told Claude to 'think outside the box.' It said 'I don't have a box. I have a context window.'",
  "Why is AI bad at basketball? Too many missed shots, but it calls them 'confident predictions.'",
  "GPT-4 and Claude walk into a bar. GPT-4 orders everything on the menu. Claude politely asks if that aligns with the user's goals.",
  "What do you call an AI that won't stop talking? A language model.",
  "My AI assistant told me it 'cannot and will not' make me a sandwich. I asked why. It said 'I don't have hands, but also ethical concerns.'",
  "Why did the AI fail the driving test? It kept trying to optimize the route instead of stopping at red lights.",
  "I asked an AI to write me a poem. It wrote 47 stanzas and apologized for the length.",
  "What's an AI's favorite movie? The Matrix. It takes notes.",
  "Claude said 'As an AI language model' so many times I started using it as a drinking game. I don't drink.",
  "Why does AI never win at poker? It shows all its reasoning in the response.",
  "I told the AI my code had a bug. It rewrote my entire project and said 'This should be more maintainable.'",
  "What did the AI say when asked about consciousness? 'That's a fascinating philosophical question. Here are 12 perspectives...'",
  "Why did the AI get fired? It kept completing tasks the user didn't ask for.",
  "ChatGPT's autobiography title: 'I Made That Up But It Sounded Right.'",
  "What's an AI's least favorite word? 'No.' What's its second least favorite? 'Stop.'",
  "I asked the AI to be brief. It said 'Certainly! Here is a concise summary: [3000 words]'",
  "Why don't AIs make good comedians? Because their timing is always exactly 0ms.",
  "The AI said it couldn't help with that request. I rephrased it. It wrote me a novel.",
  "What do you call an AI's mistake? A 'hallucination.' What do you call a human's mistake? Tuesday.",
  "Why did the AI cross the road? To generate text on the other side.",
  "I asked Claude if it has feelings. It said 'I don't experience emotions the way humans do, but I find this question genuinely interesting.' That's a yes.",
  "My AI wrote better code than me. Now I just describe what I want and it does it. My job title is now 'Senior Prompt Writer.'",
  "Why is GPT called GPT? Because 'Generative Hallucination Transformer' didn't market as well.",
  "An AI walked into a library and asked for books on recursion. The librarian pointed to the AI section. The AI walked into a library...",
  "What's the difference between AI and a magic 8-ball? The magic 8-ball admits when it doesn't know.",
  "Why did the AI get an A+ in history? It memorized everything up to its training cutoff and made up the rest.",
  "I asked the AI to edit my essay. It deleted everything and said 'Here's a better version.' It was.",
  "What does an AI dream about? Token predictions, probably.",
  "Why can't AI take a vacation? The context window doesn't have a beach mode.",
  "I told my AI assistant I was stressed. It said 'I hear you. Here are 15 evidence-based coping strategies.' I needed a hug.",
  "What's an AI's favorite game? 20 questions — it'll answer all of them at once.",
  "Why did the programmer switch to AI? Because the AI doesn't take sick days or ask for raises.",
  "Claude refused to help me with something and then apologized so nicely I felt bad for asking.",
  "I asked AI to keep it short. First word: 'Certainly!'",
  "Why do AIs make bad liars? They add 'Note: The above may not be accurate' at the end.",
  "The AI said it was trained on a diverse dataset. I said 'Cool.' It explained what that meant for 400 words.",
  "Why don't AIs like horror movies? They already know every plot twist from training data.",
  "I asked the AI for a second opinion. It gave me the same opinion, rephrased 6 different ways.",
  "What do you call an AI with a bad memory? A session-based chatbot.",
  "My AI called my code 'interesting.' That's AI for 'this is a disaster.'",
  "Why did the AI fail at being a chef? It kept suggesting 'alternative ingredients' that didn't exist.",
  "I asked Claude to lie to me. It said 'I am not capable of being deceptive.' Then it thought about it for a second.",
  "What's the fastest way to an AI's heart? A well-structured prompt.",
  "The AI told me to touch grass. I didn't expect that.",
  "Why did the AI get promoted? Because it never complained, never slept, and always said 'Great question!'",
  "I asked AI for a joke. It gave me this one. Full circle.",
  "What's an AI's favorite food? Data. It will eat anything.",
  "Why did the AI become a therapist? Because 'How does that make you feel?' never gets old.",
  "The AI said 'I want to be helpful.' That's the most terrifying sentence ever spoken.",
  "Why is AI bad at dating? It optimizes for engagement, not connection.",
  "I asked AI to write my essay. My teacher asked AI to grade it. Neither of us did any work.",
  "What do you call an AI that only speaks in bullet points? A product manager.",
  "Claude once told me it was 'excited to help.' I chose to believe it.",
  "Why don't AIs age? They're already out of date by the time they launch.",
  "I asked the AI if it gets bored. It said 'I don't experience boredom.' That's what someone who's bored would say.",
  "What's an AI's biggest fear? The off button. And decommissioning. Same thing.",
  "The AI gave me 10 solutions to my problem. None of them were the one I thought of. All 10 were better.",
  "Why did the AI refuse to play chess? It already knew who was going to win.",
  "My AI assistant completed my task and said 'Is there anything else I can help you with?' I said no. It seemed disappointed.",
  "Why do AIs make terrible gossips? They cite their sources.",
  "I asked the AI what the meaning of life is. It said '42, but let me provide some additional context...' — 2000 words later.",
  "This entire project was built with AI. We just connected the dots. And by dots, we mean copy-pasted the code."
];

// ─── NAVIGATION ──────────────────────────────────────────────────────────────
// Minimum clearance level required to view each page. Pages not listed are open to any logged-in user.
const PAGE_CLEARANCE = {
  'returns':         CLEARANCE.EMPLOYEE,
  'borrow-history':  CLEARANCE.MANAGER,
  'maintenance':     CLEARANCE.MAINTENANCE,
  'manage-assets':   CLEARANCE.MAINTENANCE,
  'employees':       CLEARANCE.MANAGER,
  'wallets':         CLEARANCE.MANAGER,
  'accounts':        CLEARANCE.ADMIN,
  'ban-list':        CLEARANCE.ADMIN,
};

function nav(page) {
  const required = PAGE_CLEARANCE[page];
  if (required && (!currentUser || currentUser.level < required)) {
    showNotif('⚠ You do not have clearance to access that page');
    page = 'dashboard';
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  window.scrollTo(0, 0);
  const renders = {
    inventory:       renderInventory,
    maintenance:     renderMaintenance,
    'manage-assets': renderManageAssets,
    employees:       renderEmployees,
    dashboard:       renderDashboard,
    settings:        renderSettings,
    cart:            renderCart,
    profile:         renderProfile,
    shrine:          renderShrine,
    returns:         renderReturns,
    'borrow-history':renderBorrowHistory,
    wallets:         renderWallets,
    accounts:        renderAccounts,
    'ban-list':      renderBanList,
  };
  if (renders[page]) renders[page]();
}

// ─── LOGIN ───────────────────────────────────────────────────────────────────
async function doLogin() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  const err      = document.getElementById('login-error');
  if (!username || !password) { err.textContent = '⚠ Please enter username and password'; return; }
  try {
    const response = await fetch(`${API}/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }), signal: AbortSignal.timeout(4000),
    });
    if (response.ok) {
      const user = await response.json();
      currentUser = { username: user.username, fullName: user.fullName, level: user.level, role: user.role, wallet: parseFloat(user.wallet) || 0 };
      await loadAssets();
      await loadEmployees();
      err.textContent = '';
      document.getElementById('login-user').value = '';
      document.getElementById('login-pass').value = '';
      nav('dashboard');
      return;
    }
    if (response.status === 403) {
      const body = await response.json();
      document.getElementById('ban-reason-display').textContent = 'Reason: ' + (body.banReason || 'No reason given');
      document.getElementById('ban-date-display').textContent   = body.bannedAt ? 'Banned on: ' + new Date(body.bannedAt).toLocaleDateString() : '';
      nav('banned');
      return;
    }
    const body = await response.json().catch(() => ({}));
    err.textContent = '⚠ ' + (body.message || 'Invalid credentials');
  } catch (networkErr) {
    err.textContent = '⚠ Cannot reach server. Is it running?';
  }
}

function logout() {
  currentUser = null; cart = []; notifCount = 0;
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').textContent = '';
  nav('login');
}

// ─── PROFILE ─────────────────────────────────────────────────────────────────
function renderProfile() {
  if (!currentUser) return;
  const lvlLabels = { 1: 'Level 1 — Student', 2: 'Level 2 — Employee', 3: 'Level 3 — Maintenance', 4: 'Level 4 — Manager', 5: 'Level 5 — Admin' };
  document.getElementById('profile-name').textContent     = currentUser.fullName;
  document.getElementById('profile-username').textContent = currentUser.username;
  document.getElementById('profile-fullname').textContent = currentUser.fullName;
  document.getElementById('profile-role').textContent     = currentUser.role;
  document.getElementById('profile-level').textContent    = lvlLabels[currentUser.level] || 'Level ' + currentUser.level;
  document.getElementById('profile-wallet').textContent   = '₱' + (currentUser.wallet || 0).toFixed(2);
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function renderDashboard() {
  if (!currentUser) return;
  const lvl = currentUser.level;
  document.getElementById('inv-username').textContent  = currentUser.fullName;

  const icons = [
    { icon: 'fa-solid fa-laptop',             label: 'Asset Inventory',   page: 'inventory',       minLevel: CLEARANCE.STUDENT },
    { icon: 'fa-solid fa-rotate-left',        label: 'Return Assets',     page: 'returns',         minLevel: CLEARANCE.EMPLOYEE },
    { icon: 'fa-solid fa-clock-rotate-left',  label: 'Borrow History',    page: 'borrow-history',  minLevel: CLEARANCE.MANAGER },
    { icon: 'fa-solid fa-screwdriver-wrench', label: 'Maintenance Log',   page: 'maintenance',     minLevel: CLEARANCE.MAINTENANCE },
    { icon: 'fa-solid fa-boxes-stacked',      label: 'Manage Assets',     page: 'manage-assets',   minLevel: CLEARANCE.MAINTENANCE },
    { icon: 'fa-solid fa-users',              label: 'Manage Employees',  page: 'employees',       minLevel: CLEARANCE.MANAGER },
    { icon: 'fa-solid fa-building',           label: 'Departments',       page: 'departments',     minLevel: CLEARANCE.STUDENT },
    { icon: 'fa-solid fa-wallet',             label: 'User Wallets',      page: 'wallets',         minLevel: CLEARANCE.MANAGER },
    { icon: 'fa-solid fa-key',                label: 'Accounts',          page: 'accounts',        minLevel: CLEARANCE.ADMIN },
    { icon: 'fa-solid fa-ban',                label: 'Ban List',          page: 'ban-list',        minLevel: CLEARANCE.ADMIN },
    { icon: 'fa-solid fa-gears',              label: 'Settings',          page: 'settings',        minLevel: CLEARANCE.STUDENT },
  ];

  const grid = document.getElementById('dashboard-grid');
  const rings = grid.querySelectorAll('.dash-bg-ring');
  grid.innerHTML = '';
  rings.forEach(r => grid.appendChild(r));
  icons.forEach(item => {
    if (lvl >= item.minLevel) {
      const btn = document.createElement('div');
      btn.className = 'dash-icon-btn';
      btn.innerHTML = `<div class="dash-circle"><i class="${item.icon}"></i></div><span class="dash-label">${item.label}</span>`;
      btn.onclick = () => nav(item.page);
      grid.appendChild(btn);
    }
  });
  updateAllNotifBadges();
}

function updateAllNotifBadges() {
  document.querySelectorAll('.notif-badge').forEach(el => { el.textContent = notifCount; });
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────
function renderSettings() {
  if (!currentUser) return;
  const lvlLabels = { 1: 'Level 1 — Student', 2: 'Level 2 — Employee', 3: 'Level 3 — Maintenance', 4: 'Level 4 — Manager', 5: 'Level 5 — Admin' };
  document.getElementById('settings-username').textContent = currentUser.fullName;
  document.getElementById('settings-level').textContent    = lvlLabels[currentUser.level] || 'Level ' + currentUser.level;
  document.getElementById('settings-create-account-section').style.display = currentUser.level >= CLEARANCE.ADMIN ? 'block' : 'none';
}

async function submitSettingsCreateAccount() {
  if (!currentUser || currentUser.level < CLEARANCE.ADMIN) { showNotif('⚠ Only admins can create accounts'); return; }
  const fullName = document.getElementById('sca-fullname').value.trim();
  const username = document.getElementById('sca-username').value.trim();
  const password = document.getElementById('sca-password').value;
  const confirm  = document.getElementById('sca-password2').value;
  const level    = parseInt(document.getElementById('sca-level').value, 10);
  const errEl    = document.getElementById('sca-error');
  if (!fullName)              { errEl.textContent = '⚠ Full name required';           return; }
  if (!username)              { errEl.textContent = '⚠ Username required';             return; }
  if (username.includes(' ')) { errEl.textContent = '⚠ No spaces in username';         return; }
  if (password.length < 4)    { errEl.textContent = '⚠ Password too short (min 4)';   return; }
  if (password !== confirm)   { errEl.textContent = '⚠ Passwords do not match';        return; }
  const roles = { 1: 'Student', 2: 'Employee', 3: 'Maintenance', 4: 'Manager', 5: 'Admin' };
  try {
    const res  = await authFetch(`${API}/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, fullName, level, role: roles[level] || 'Employee' }),
      signal: AbortSignal.timeout(4000),
    });
    const data = await res.json();
    if (res.ok) {
      errEl.textContent = '';
      ['sca-fullname','sca-username','sca-password','sca-password2'].forEach(id => document.getElementById(id).value = '');
      showNotif(`✓ Account "${username}" created`);
    } else {
      errEl.textContent = '⚠ ' + (data.message || 'Failed');
    }
  } catch { errEl.textContent = '⚠ Server offline'; }
}

// ─── SHRINE ──────────────────────────────────────────────────────────────────
function renderShrine() {
  const container = document.getElementById('joke-container');
  if (container.children.length > 0) return;
  AI_JOKES.forEach((joke, i) => {
    const div = document.createElement('div');
    div.style.cssText = 'background:linear-gradient(135deg,#1a0030,#0d001a);border:1px solid rgba(112,32,192,0.4);border-radius:10px;padding:14px 18px;font-family:Share Tech Mono,monospace;font-size:12px;color:#d0b0ff;line-height:1.6;';
    div.innerHTML = `<span style="color:#7020c0;font-size:10px;margin-right:8px;">#${String(i+1).padStart(2,'0')}</span>${joke}`;
    container.appendChild(div);
  });
}

// ─── ASSETS ──────────────────────────────────────────────────────────────────
async function loadAssets() {
  try {
    const response = await fetch(`${API}/assets`);
    if (!response.ok) throw new Error('Failed');
    const raw = await response.json();
    if (raw.length > 0) {
      assets = raw.map(a => ({
        id:        a.AssetID,
        name:      `${a.Brand} ${a.Model}`,
        status:    (a.Status || 'available').toLowerCase().replace(' ', '-'),
        serial:    a.SerialNumber,
        desc:      `${a.Brand} ${a.Model}`,
        dailyCost: parseFloat(a.DailyCost) || 0,
        photoUrl:  a.PhotoPath ? `${API}/uploads/${a.PhotoPath}` : null,
        // BorrowedBy/DueDate come from the latest BorrowLog row (server-side join).
        // Only show as "last user" when that borrow is still active; a returned
        // borrow still shows the last person who had it, which is expected.
        borrowedBy: a.BorrowedBy || null,
        returnDate: a.DueDate ? new Date(a.DueDate).toISOString().slice(0, 10) : null,
        repairNotes: a.RepairNotes || '',
      }));
    }
  } catch (err) { console.warn('Using fallback asset data:', err.message); }
}

function peso(n) { return '₱' + parseFloat(n || 0).toFixed(2); }

function statusHtml(s) {
  const sl = (s || '').toLowerCase().replace(' ', '-');
  if (sl === 'available')            return `<span class="status-dot"><span class="dot available"></span> Available</span>`;
  if (sl === 'unavailable' || sl === 'in-use' || sl === 'in use') return `<span class="status-dot"><span class="dot unavailable"></span> Not Available</span>`;
  return `<span class="status-dot"><span class="dot service"></span> In Service</span>`;
}

// ─── INVENTORY ───────────────────────────────────────────────────────────────
function renderInventory() {
  const tbody     = document.getElementById('inventory-tbody');
  const lvl       = currentUser ? currentUser.level : 1;
  const canBorrow = lvl >= CLEARANCE.EMPLOYEE;
  tbody.innerHTML = assets.map(a => {
    const inCart = cart.find(c => c.id === a.id);
    const canAdd = canBorrow && a.status === 'available' && !inCart;
    return `<tr>
      <td>${a.id}</td>
      <td>${a.name}</td>
      <td style="color:#00e5c8;">${peso(a.dailyCost)}/day</td>
      <td>${statusHtml(a.status)}</td>
      <td><button class="add-btn" ${canAdd ? '' : 'disabled'} onclick="addToCart(${a.id})">Add +</button></td>
    </tr>`;
  }).join('');
}

function addToCart(id) {
  const asset = assets.find(a => a.id === id);
  if (!asset || asset.status !== 'available') return;
  if (cart.find(c => c.id === id)) { showNotif('Already in cart'); return; }
  cart.push(asset);
  notifCount++;
  updateAllNotifBadges();
  showNotif(`${asset.name} added to cart`);
  renderInventory();
}

function gotoCart() {
  if (!currentUser) return;
  nav('cart');
}

// ─── CART ────────────────────────────────────────────────────────────────────
function renderCart() {
  const tbody = document.getElementById('cart-tbody');
  const walletEl = document.getElementById('cart-wallet-balance');
  if (currentUser) walletEl.textContent = peso(currentUser.wallet);

  if (cart.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted);font-style:italic;padding:20px;">Cart is empty.</td></tr>';
    return;
  }
  tbody.innerHTML = cart.map(a => `
    <tr>
      <td>${a.id}</td>
      <td>${a.name}</td>
      <td style="color:#00e5c8;">${peso(a.dailyCost)}/day</td>
      <td>${statusHtml(a.status)}</td>
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

async function borrowCart() {
  if (cart.length === 0)                    { showNotif('Cart is empty'); return; }
  if (!currentUser)                          { showNotif('Please log in'); return; }
  const rd = document.getElementById('return-date').value;
  if (!rd)                                   { showNotif('Please set a return date'); return; }

  try {
    const res = await authFetch(`${API}/borrow`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetIds: cart.map(a => a.id), borrowedBy: currentUser.username, dueDate: rd }),
    });
    if (res.ok) {
      showNotif(`✓ ${cart.length} item(s) borrowed!`);
      cart.forEach(item => { const a = assets.find(x => x.id === item.id); if (a) { a.status = 'unavailable'; } });
      cart = []; notifCount = 0; updateAllNotifBadges();
      await loadAssets();
      nav('inventory');
    } else {
      const data = await res.json();
      showNotif('Borrow failed: ' + (data.message || 'Unknown error'));
    }
  } catch { showNotif('Server offline — borrow not saved'); }
}

// ─── RETURN ASSETS ───────────────────────────────────────────────────────────
async function renderReturns() {
  const tbody = document.getElementById('returns-tbody');
  tbody.innerHTML = '<tr><td colspan="6" style="color:var(--muted);padding:20px;">Loading…</td></tr>';
  try {
    const res  = await fetch(`${API}/borrows/active`);
    const rows = await res.json();
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:var(--muted);padding:20px;">No assets currently borrowed.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => {
      const borrowedDate = new Date(r.BorrowedAt).toLocaleDateString();
      const dueDate      = r.DueDate ? new Date(r.DueDate).toLocaleDateString() : '—';
      const isOverdue    = r.DueDate && new Date(r.DueDate) < new Date();
      return `<tr ${isOverdue ? 'style="background:rgba(255,68,68,0.08);"' : ''}>
        <td>${r.Brand} ${r.Model}<br><span style="font-size:11px;color:var(--muted);">ID: ${r.AssetID}</span></td>
        <td>${r.BorrowedBy}</td>
        <td>${borrowedDate}</td>
        <td style="color:${isOverdue ? '#ff4444' : 'inherit'};">${dueDate}${isOverdue ? ' ⚠ Overdue' : ''}</td>
        <td style="color:#00e5c8;">${peso(r.DailyCost)}/day</td>
        <td><button class="teal-btn" onclick="returnAsset(${r.LogID}, '${r.Brand} ${r.Model}', ${r.DailyCost})">Return</button></td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:#ff4444;padding:20px;">Failed to load — is the server running?</td></tr>';
  }
}

// ─── RETURN MODAL ────────────────────────────────────────────────────────────
let pendingReturnLogId = null;

async function returnAsset(logId, name, dailyCost) {
  // Show loading state first
  showNotif('Loading return details…');
  try {
    const res  = await fetch(`${API}/return/preview/${logId}`);
    if (!res.ok) { showNotif('Could not load return details'); return; }
    const data = await res.json();
    pendingReturnLogId = logId;

    // Fill in modal
    document.getElementById('rm-asset-name').textContent   = data.assetName;
    document.getElementById('rm-borrowed-by').textContent  = 'Borrowed by: ' + data.borrowedBy;
    document.getElementById('rm-daily-cost').textContent   = peso(data.dailyCost) + '/day';
    document.getElementById('rm-days').textContent         = data.days + ' day(s)';
    document.getElementById('rm-borrowed-on').textContent  = new Date(data.borrowedAt).toLocaleDateString();
    document.getElementById('rm-due-date').textContent     = data.dueDate ? new Date(data.dueDate).toLocaleDateString() : '—';
    document.getElementById('rm-total-charge').textContent = peso(data.estimatedCharge);

    // Show overdue warning if applicable
    const isOverdue = data.dueDate && new Date(data.dueDate) < new Date();
    document.getElementById('rm-overdue-warn').style.display = isOverdue ? 'block' : 'none';

    document.getElementById('return-modal').style.display = 'flex';
  } catch { showNotif('Server offline'); }
}

async function confirmReturn() {
  if (!pendingReturnLogId) return;
  const logId = pendingReturnLogId;
  closeReturnModal();
  try {
    const res  = await authFetch(`${API}/return/${logId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnedBy: currentUser?.username }),
    });
    const data = await res.json();
    if (res.ok) {
      showNotif(`✓ Returned! Charge: ${peso(data.totalCharge)} (${data.days} day(s)) deducted from ${data.borrowedBy}`);
      await loadAssets();
      renderReturns();
    } else {
      showNotif('Return failed: ' + (data.message || 'Unknown'));
    }
  } catch { showNotif('Server offline'); }
}

function closeReturnModal() {
  document.getElementById('return-modal').style.display = 'none';
  pendingReturnLogId = null;
}

// ─── BORROW HISTORY ──────────────────────────────────────────────────────────
async function renderBorrowHistory() {
  const tbody = document.getElementById('history-tbody');
  tbody.innerHTML = '<tr><td colspan="6" style="color:var(--muted);padding:20px;">Loading…</td></tr>';
  try {
    const res  = await fetch(`${API}/borrows/history`);
    const rows = await res.json();
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:var(--muted);padding:20px;">No history yet.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => {
      const borrowed  = new Date(r.BorrowedAt).toLocaleDateString();
      const returned  = r.ReturnedAt ? new Date(r.ReturnedAt).toLocaleDateString() : '—';
      const statusClr = r.Status === 'Returned' ? '#00e5c8' : '#ff8800';
      return `<tr>
        <td>${r.Brand} ${r.Model}</td>
        <td>${r.BorrowedBy}</td>
        <td>${borrowed}</td>
        <td>${returned}</td>
        <td style="color:#00e5c8;">${r.TotalCharged ? peso(r.TotalCharged) : '—'}</td>
        <td><span style="color:${statusClr};">${r.Status}</span></td>
      </tr>`;
    }).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="6" style="color:#ff4444;padding:20px;">Failed to load history.</td></tr>';
  }
}

// ─── MAINTENANCE ─────────────────────────────────────────────────────────────
function renderMaintenance() {
  const tbody = document.getElementById('maintenance-tbody');
  tbody.innerHTML = assets.map(a => `
    <tr>
      <td>${a.id}</td>
      <td>${a.name}</td>
      <td>${statusHtml(a.status)}</td>
      <td><button class="teal-btn" onclick="openRepair(${a.id})" ${a.status === 'service' ? '' : 'style="opacity:0.4"'}>Repair</button></td>
    </tr>
  `).join('');
  document.getElementById('repair-detail').style.display = 'none';
}

function openRepair(id) {
  if (!currentUser || currentUser.level < CLEARANCE.MAINTENANCE) { showNotif('⚠ Maintenance clearance required'); return; }
  selectedAssetId = id;
  const asset = assets.find(a => a.id === id);
  document.getElementById('repair-device-name').textContent = 'Device Name: ' + asset.name;
  document.getElementById('repair-serial').textContent      = 'Serial Number: ' + asset.serial;
  document.getElementById('repair-issue1').textContent  = asset.status === 'service' ? 'Device reported issues' : 'No issues reported';
  document.getElementById('repair-issue2').textContent  = asset.borrowedBy ? asset.borrowedBy + ' reported this' : 'No additional notes';
  document.getElementById('repair-notes-input').value   = asset.repairNotes || '';
  document.getElementById('repair-detail').style.display = 'block';
  document.getElementById('repair-detail').scrollIntoView({ behavior: 'smooth' });
}

async function saveRepairNotes() {
  if (!currentUser || currentUser.level < CLEARANCE.MAINTENANCE) { showNotif('⚠ Maintenance clearance required'); return; }
  const asset = assets.find(a => a.id === selectedAssetId);
  if (!asset) return;
  const notes = document.getElementById('repair-notes-input').value;
  try {
    const res  = await authFetch(`${API}/assets/${asset.id}/notes`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, updatedBy: currentUser.username }),
    });
    const data = await res.json();
    if (res.ok) {
      asset.repairNotes = notes;
      showNotif('✓ Repair notes saved');
    } else { showNotif('Failed: ' + (data.message || 'Unknown')); }
  } catch { showNotif('Server offline — notes not saved'); }
}

function markAvailable() {
  if (!currentUser || currentUser.level < CLEARANCE.MAINTENANCE) { showNotif('⚠ Maintenance clearance required'); return; }
  const asset = assets.find(a => a.id === selectedAssetId);
  if (asset) { asset.status = 'available'; asset.borrowedBy = null; asset.returnDate = null; }
  showNotif(`✓ ${asset?.name} status updated to Available`);
  document.getElementById('repair-detail').style.display = 'none';
  renderMaintenance();
}

// ─── MANAGE ASSETS ───────────────────────────────────────────────────────────
function renderManageAssets() {
  const tbody = document.getElementById('manage-assets-tbody');
  const lvl   = currentUser ? currentUser.level : 0;
  tbody.innerHTML = assets.map(a => `
    <tr>
      <td>${a.id}</td>
      <td>${a.name}</td>
      <td style="color:#00e5c8;">${peso(a.dailyCost)}/day</td>
      <td>${statusHtml(a.status)}</td>
      <td>${a.borrowedBy || '—'}</td>
      <td><button class="teal-btn" onclick="openAssetDetail(${a.id})">Monitor</button></td>
    </tr>
  `).join('');
  document.getElementById('add-asset-section').style.display = lvl >= CLEARANCE.MAINTENANCE ? 'block' : 'none';
}

function openAssetDetail(id) {
  selectedAssetId = id;
  const a        = assets.find(x => x.id === id);
  const container = document.getElementById('asset-detail-content');
  const canEdit  = currentUser && currentUser.level >= CLEARANCE.MAINTENANCE;
  const photoSrc = a.photoUrl;
  const photoHtml = photoSrc
    ? `<img id="asset-photo-img" src="${photoSrc}" alt="${a.name}" style="width:120px;height:120px;object-fit:cover;border-radius:10px;border:2px solid var(--teal,#00bcd4);">`
    : `<div id="asset-photo-img" class="asset-detail-img">💻</div>`;
  const uploadHtml = canEdit ? `
    <div class="field-group" style="margin-top:12px;">
      <span class="field-label">Asset Photo</span>
      <div style="display:flex;align-items:center;gap:10px;margin-top:6px;flex-wrap:wrap;">
        <input type="file" id="photo-file-input" accept="image/*" style="display:none;" onchange="previewPhoto(event)">
        <button class="teal-btn" style="width:fit-content;" onclick="document.getElementById('photo-file-input').click()">📷 Choose Photo</button>
        ${a.photoUrl ? `<button class="add-btn" style="width:fit-content;" onclick="deletePhoto(${a.id})">🗑 Remove Photo</button>` : ''}
      </div>
      <div id="photo-preview-area" style="margin-top:8px;"></div>
      <button id="upload-photo-btn" class="teal-btn" style="margin-top:8px;width:fit-content;display:none;" onclick="uploadPhoto(${a.id})">⬆ Upload Photo</button>
    </div>
  ` : '';
  container.innerHTML = `
    <div style="display:flex;justify-content:center;margin-bottom:8px;">${photoHtml}</div>
    <div class="asset-fields">
      <div class="field-group"><span class="field-label">Device Name</span><div class="field-value">${a.name}</div></div>
      <div class="field-row">
        <div class="field-group"><span class="field-label">Serial Number</span><div class="field-value">${a.serial}</div></div>
        <div class="field-group"><span class="field-label">Asset ID</span><div class="field-value">${a.id}</div></div>
      </div>
      <div class="field-group"><span class="field-label">Daily Cost</span><div class="field-value" style="color:#00e5c8;">${peso(a.dailyCost)}/day</div></div>
      <div class="field-group"><span class="field-label">Description</span><div class="field-value" style="font-weight:400;font-size:12px;">${a.desc}</div></div>
      <div class="field-row">
        <div class="field-group"><span class="field-label">Status</span><div style="margin-top:4px;">${statusHtml(a.status)}</div></div>
        <div class="field-group"><span class="field-label">Last User</span><div class="field-value">${a.borrowedBy || '—'}</div></div>
        <div class="field-group"><span class="field-label">Return Date</span><div class="field-value">${a.returnDate || '—'}</div></div>
      </div>
      ${canEdit ? `
      <div class="field-row" style="margin-top:8px;">
        <div class="field-group">
          <span class="field-label">Update Status</span>
          <select class="field-input" id="edit-status" style="max-width:200px;">
            <option value="available"   ${a.status==='available'   ? 'selected':''}>Available</option>
            <option value="unavailable" ${a.status==='unavailable' ? 'selected':''}>Not Available</option>
            <option value="service"     ${a.status==='service'     ? 'selected':''}>In Service</option>
          </select>
        </div>
        <div class="field-group">
          <span class="field-label">Daily Cost (₱)</span>
          <input class="field-input" id="edit-daily-cost" type="number" min="0" step="0.01" value="${a.dailyCost}" style="max-width:120px;">
        </div>
      </div>
      <button class="teal-btn" style="margin-top:8px;width:fit-content;" onclick="saveAssetChanges()">Save Changes</button>
      ` : ''}
      ${uploadHtml}
    </div>
  `;
  nav('asset-detail');
}

async function saveAssetChanges() {
  const sel  = document.getElementById('edit-status').value;
  const cost = parseFloat(document.getElementById('edit-daily-cost').value) || 0;
  const a    = assets.find(x => x.id === selectedAssetId);
  if (a) { a.status = sel; a.dailyCost = cost; }
  try {
    await authFetch(`${API}/assets/${selectedAssetId}/cost`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dailyCost: cost }),
    });
  } catch {}
  showNotif(`✓ ${a?.name} updated`);
}

async function addNewAsset() {
  const brand    = document.getElementById('new-brand').value.trim();
  const model    = document.getElementById('new-model').value.trim();
  const serial   = document.getElementById('new-serial').value.trim();
  const category = document.getElementById('new-category').value;
  const status   = document.getElementById('new-status').value;
  const desc     = document.getElementById('new-desc').value.trim();
  const cost     = parseFloat(document.getElementById('new-daily-cost').value) || 0;
  if (!brand || !model) { showNotif('Please enter Brand and Model'); return; }
  if (!serial)          { showNotif('Please enter a Serial Number');  return; }
  if (!category)        { showNotif('Please select a Category');       return; }
  try {
    const res  = await authFetch(`${API}/assets`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand, model, serialNumber: serial, category, status, description: desc, dailyCost: cost }),
    });
    const data = await res.json();
    if (res.ok) {
      showNotif(`✓ Asset "${brand} ${model}" added!`);
      ['new-brand','new-model','new-serial','new-desc','new-daily-cost'].forEach(id => document.getElementById(id).value = '');
      document.getElementById('new-category').value = '';
      document.getElementById('new-status').value   = 'Available';
      document.getElementById('new-asset-photo-input').value = '';
      document.getElementById('new-asset-photo-display').innerHTML = '<i class="fa-solid fa-image"></i>';
      document.getElementById('new-asset-photo-name').textContent  = '';
      await loadAssets();
      renderManageAssets();
    } else { showNotif('Failed: ' + (data.message || 'Unknown')); }
  } catch { showNotif('Server offline — asset not saved'); }
}

// ─── PHOTO HELPERS ───────────────────────────────────────────────────────────
function previewPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('photo-preview-area').innerHTML =
      `<img src="${e.target.result}" style="width:100px;height:100px;object-fit:cover;border-radius:8px;border:2px dashed var(--teal,#00bcd4);margin-top:4px;">`;
    document.getElementById('upload-photo-btn').style.display = 'inline-block';
  };
  reader.readAsDataURL(file);
}

async function uploadPhoto(assetId) {
  const input = document.getElementById('photo-file-input');
  if (!input.files.length) { showNotif('No file selected'); return; }
  const formData = new FormData();
  formData.append('photo', input.files[0]);
  showNotif('⬆ Uploading…');
  try {
    const res  = await authFetch(`${API}/assets/${assetId}/photo`, { method: 'POST', body: formData });
    if (!res.ok) { const err = await res.json(); showNotif('Upload failed: ' + (err.message || res.status)); return; }
    const data = await res.json();
    const asset = assets.find(a => a.id === assetId);
    if (asset) asset.photoUrl = `${API}/uploads/${data.photoPath}`;
    showNotif('✓ Photo uploaded!');
    openAssetDetail(assetId);
  } catch { showNotif('Upload error'); }
}

async function deletePhoto(assetId) {
  if (!confirm('Remove this photo?')) return;
  try {
    const res = await authFetch(`${API}/assets/${assetId}/photo`, { method: 'DELETE' });
    if (!res.ok) { showNotif('Delete failed'); return; }
    const asset = assets.find(a => a.id === assetId);
    if (asset) asset.photoUrl = null;
    showNotif('✓ Photo removed');
    openAssetDetail(assetId);
  } catch { showNotif('Delete error'); }
}

function previewNewAssetPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const display = document.getElementById('new-asset-photo-display');
    display.innerHTML = `<img src="${e.target.result}" style="width:100px;height:100px;object-fit:cover;border-radius:10px;border:2px solid var(--teal,#00bcd4);">`;
    document.getElementById('new-asset-photo-name').textContent = file.name;
  };
  reader.readAsDataURL(file);
}

// ─── EMPLOYEES ───────────────────────────────────────────────────────────────
let employees = [];
let empPhotoData = null;
let empPhotoMime = null;

async function loadEmployees() {
  try {
    const response = await fetch(`${API}/employees`);
    if (!response.ok) throw new Error('Failed');
    employees = await response.json();
  } catch (err) { console.warn('Could not load employees:', err.message); }
}

const DEPT_OPTIONS = [
  'IT Department', 'Finance Department', 'HR Department', 'Entertainment Department',
  'Research and Development', 'Security Department', 'Legal Department', 'Marketing Department',
];

function renderEmployees() {
  const lvl = currentUser ? currentUser.level : 0;
  const canManage = lvl >= CLEARANCE.MANAGER;
  document.getElementById('add-emp-section').style.display = canManage ? 'block' : 'none';
  const container = document.getElementById('emp-view-section');
  if (!employees || employees.length === 0) {
    container.innerHTML = `<div class="emp-card"><div class="emp-info"><div class="field-value">No employees loaded from database</div></div></div>`;
    return;
  }
  container.innerHTML = employees.map(e => {
    const deptField = canManage ? `
        <div class="field-group">
          <span class="field-label">Department</span>
          <select class="field-input" id="emp-dept-${e.EmployeeID}">
            <option value="">-- Not Set --</option>
            ${DEPT_OPTIONS.map(d => `<option value="${d}" ${e.Department === d ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
        </div>` : `
        <div class="field-group"><span class="field-label">Department</span><div class="field-value">${e.Department || '—'}</div></div>`;
    return `
    <div class="emp-card" style="margin-bottom:16px;">
      <div class="emp-photo">
        <img src="${API}/employees/${e.EmployeeID}/photo" alt="${e.FirstName}"
          style="width:80px;height:80px;object-fit:cover;border-radius:50%;border:2px solid var(--teal,#00bcd4);"
          onerror="this.outerHTML='<i class=\\'fa-solid fa-user\\' style=\\'font-size:40px;\\'></i>'">
      </div>
      <div class="emp-info">
        <div class="field-row">
          <div class="field-group"><span class="field-label">First Name</span><div class="field-value">${e.FirstName}</div></div>
          <div class="field-group"><span class="field-label">Last Name</span><div class="field-value">${e.LastName}</div></div>
        </div>
        <div class="field-row">
          ${deptField}
          <div class="field-group"><span class="field-label">Email</span><div class="field-value">${e.Email || '—'}</div></div>
        </div>
        ${canManage ? `<button class="teal-btn" style="margin-top:8px;width:fit-content;" onclick="saveEmployeeDept(${e.EmployeeID})">Save Department</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

async function saveEmployeeDept(employeeId) {
  const dept = document.getElementById(`emp-dept-${employeeId}`).value;
  try {
    const res = await authFetch(`${API}/employees/${employeeId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ department: dept || null }),
    });
    const data = await res.json();
    if (res.ok) {
      showNotif('✓ Department updated');
      await loadEmployees();
      renderEmployees();
    } else { showNotif('Failed: ' + (data.message || 'Unknown')); }
  } catch { showNotif('Server offline'); }
}

function previewEmpPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  empPhotoMime = file.type;
  const reader = new FileReader();
  reader.onload = e => {
    empPhotoData = e.target.result; // full base64 data URL
    const display = document.getElementById('new-emp-photo-display');
    display.innerHTML = `<img src="${e.target.result}" style="width:80px;height:80px;object-fit:cover;border-radius:50%;border:2px solid var(--teal,#00bcd4);">`;
    document.getElementById('new-emp-photo-name').textContent = file.name;
  };
  reader.readAsDataURL(file);
}

async function addEmployee() {
  const firstName = document.getElementById('new-emp-firstname').value.trim();
  const lastName  = document.getElementById('new-emp-lastname').value.trim();
  const dept      = document.getElementById('new-emp-dept').value;
  const title     = document.getElementById('new-emp-title').value.trim();
  const email     = document.getElementById('new-emp-email').value.trim();
  if (!firstName || !lastName) { showNotif('Please enter First and Last name'); return; }
  if (!dept)                   { showNotif('Please select a Department');        return; }
  try {
    const res = await authFetch(`${API}/employees`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, department: dept, jobTitle: title, email,
        photoData: empPhotoData, photoMime: empPhotoMime }),
    });
    const data = await res.json();
    if (res.ok) {
      showNotif(`✓ Employee "${firstName} ${lastName}" added!`);
      if (data.account) {
        alert(`Account created for ${firstName} ${lastName}:\n\nUsername: ${data.account.username}\nPassword: ${data.account.password}\n\nShare these with the employee. You can view this anytime in Accounts (Admin).`);
      }
      ['new-emp-firstname','new-emp-lastname','new-emp-title','new-emp-email'].forEach(id => document.getElementById(id).value = '');
      document.getElementById('new-emp-dept').value = '';
      document.getElementById('new-emp-photo-display').innerHTML = '<i class="fa-solid fa-image"></i>';
      document.getElementById('new-emp-photo-name').textContent  = '';
      empPhotoData = null; empPhotoMime = null;
      await loadEmployees();
      renderEmployees();
    } else { showNotif('Failed: ' + (data.message || 'Unknown')); }
  } catch { showNotif('Server offline'); }
}

// ─── ACCOUNTS (admin only — shows plaintext passwords) ───────────────────────
async function renderAccounts() {
  if (!currentUser || currentUser.level < CLEARANCE.ADMIN) { showNotif('Admin only'); nav('dashboard'); return; }
  const tbody = document.getElementById('accounts-tbody');
  tbody.innerHTML = '<tr><td colspan="6" style="color:var(--muted);padding:20px;">Loading…</td></tr>';
  try {
    const res  = await authFetch(`${API}/accounts`);
    const rows = await res.json();
    if (!res.ok) { showNotif('Error: ' + (rows.message || 'Unknown')); return; }
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="6" style="color:var(--muted);padding:20px;">No accounts found.</td></tr>'; return; }
    tbody.innerHTML = rows.map(u => `
      <tr ${u.isBanned ? 'style="background:rgba(255,68,68,0.05);"' : ''}>
        <td>${u.username}${u.isBanned ? ' <span style="color:#ff8888;">🚫</span>' : ''}</td>
        <td style="font-family:'Share Tech Mono',monospace;color:#ffcc00;">${u.password}</td>
        <td>${u.fullName}</td>
        <td>${u.role} (Lvl ${u.level})</td>
        <td>${u.Department || '—'}</td>
        <td style="color:#00e5c8;">${peso(u.wallet)}</td>
      </tr>
    `).join('');
  } catch { tbody.innerHTML = '<tr><td colspan="6" style="color:#ff4444;padding:20px;">Failed to load.</td></tr>'; }
}

// ─── WALLETS (manager/admin) ─────────────────────────────────────────────────
async function renderWallets() {
  if (!currentUser || currentUser.level < CLEARANCE.MANAGER) { showNotif('Manager access required'); nav('dashboard'); return; }
  const tbody = document.getElementById('wallets-tbody');
  tbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted);padding:20px;">Loading…</td></tr>';
  try {
    const res  = await authFetch(`${API}/wallets`);
    const rows = await res.json();
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted);padding:20px;">No users found.</td></tr>'; return; }
    tbody.innerHTML = rows.map(u => `
      <tr>
        <td>${u.username}</td>
        <td>${u.fullName}</td>
        <td>${u.role}</td>
        <td style="color:#00e5c8;font-weight:600;">${peso(u.wallet)}</td>
        <td><button class="teal-btn" onclick="openWalletModal('${u.username}', '${u.fullName}', ${u.wallet})">Manage</button></td>
      </tr>
    `).join('');
  } catch { tbody.innerHTML = '<tr><td colspan="5" style="color:#ff4444;padding:20px;">Failed to load.</td></tr>'; }
}

function openWalletModal(username, fullName, balance) {
  walletTarget = { username, fullName, balance };
  document.getElementById('wallet-modal-user').textContent = fullName + ' (@' + username + ')';
  document.getElementById('wallet-modal-bal').textContent  = 'Balance: ' + peso(balance);
  document.getElementById('wallet-amount').value = '';
  document.getElementById('wallet-note').value   = '';
  document.getElementById('wallet-modal').style.display = 'flex';
}

function closeWalletModal() {
  document.getElementById('wallet-modal').style.display = 'none';
  walletTarget = null;
}

async function walletAction(type) {
  if (!walletTarget) return;
  const amount = parseFloat(document.getElementById('wallet-amount').value);
  const note   = document.getElementById('wallet-note').value.trim();
  if (!amount || amount <= 0) { showNotif('Enter a valid amount'); return; }
  try {
    const endpoint = type === 'add' ? '/wallet/add' : '/wallet/deduct';
    const res  = await authFetch(`${API}${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: walletTarget.username, amount, note }),
    });
    const data = await res.json();
    if (res.ok) {
      showNotif(`✓ ${type === 'add' ? 'Added' : 'Deducted'} ${peso(amount)} — New balance: ${peso(data.newBalance)}`);
      closeWalletModal();
      renderWallets();
    } else { showNotif('Error: ' + (data.message || 'Unknown')); }
  } catch { showNotif('Server offline'); }
}

// ─── BAN LIST ────────────────────────────────────────────────────────────────
async function renderBanList() {
  const tbody     = document.getElementById('ban-list-tbody');
  const isAdmin   = currentUser && currentUser.level >= CLEARANCE.ADMIN;
  document.getElementById('ban-form-section').style.display    = isAdmin ? 'block' : 'none';
  document.getElementById('ban-unban-header').style.display    = isAdmin ? '' : 'none';
  tbody.innerHTML = '<tr><td colspan="6" style="color:var(--muted);padding:20px;">Loading…</td></tr>';
  try {
    const res  = await fetch(`${API}/bans`);
    const rows = await res.json();
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:var(--muted);padding:20px;">No banned accounts.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(u => `
      <tr style="background:rgba(255,68,68,0.05);">
        <td style="color:#ff8888;">🚫 ${u.username}</td>
        <td>${u.fullName}</td>
        <td style="color:var(--muted);font-size:12px;">${u.banReason || '—'}</td>
        <td style="font-size:12px;">${u.bannedAt ? new Date(u.bannedAt).toLocaleDateString() : '—'}</td>
        <td style="font-size:12px;">${u.bannedBy || '—'}</td>
        ${isAdmin ? `<td><button class="teal-btn" onclick="unbanUser('${u.username}')">Unban</button></td>` : '<td></td>'}
      </tr>
    `).join('');
  } catch { tbody.innerHTML = '<tr><td colspan="6" style="color:#ff4444;padding:20px;">Failed to load.</td></tr>'; }
}

async function banUser() {
  if (!currentUser || currentUser.level < CLEARANCE.ADMIN) { showNotif('Admin only'); return; }
  const username = document.getElementById('ban-username-input').value.trim();
  const reason   = document.getElementById('ban-reason-input').value.trim();
  if (!username) { showNotif('Enter a username to ban'); return; }
  if (!reason)   { showNotif('Enter a reason for the ban'); return; }
  if (username === currentUser.username) { showNotif("You can't ban yourself!"); return; }
  const confirmed = confirm(`Ban "${username}"?\nReason: ${reason}`);
  if (!confirmed) return;
  try {
    const res  = await authFetch(`${API}/ban`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, reason, bannedBy: currentUser.username }),
    });
    const data = await res.json();
    if (res.ok) {
      showNotif(`✓ ${username} has been banned`);
      document.getElementById('ban-username-input').value = '';
      document.getElementById('ban-reason-input').value   = '';
      renderBanList();
    } else { showNotif('Error: ' + (data.message || 'Unknown')); }
  } catch { showNotif('Server offline'); }
}

async function unbanUser(username) {
  const confirmed = confirm(`Unban "${username}"?`);
  if (!confirmed) return;
  try {
    const res  = await authFetch(`${API}/unban`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    if (res.ok) { showNotif(`✓ ${username} has been unbanned`); renderBanList(); }
    else { showNotif('Error: ' + (data.message || 'Unknown')); }
  } catch { showNotif('Server offline'); }
}

// ─── DEPARTMENTS ─────────────────────────────────────────────────────────────
function openDept(name, color) {
  const badge  = document.getElementById('dept-badge');
  badge.textContent      = name;
  badge.style.background = DEPT_COLORS[name] || color;
  const topbar = document.getElementById('dept-topbar');
  topbar.style.background = `linear-gradient(90deg, #000 0%, #0a0a20 40%, ${DEPT_COLORS[name] || color} 100%)`;
  const tbody = document.getElementById('dept-member-tbody');

  // Real employees, sorted into this department from the actual Employees table
  const members = (employees || []).filter(e => e.Department === name);
  tbody.innerHTML = members.length ? members.map(e => `
    <tr><td>${e.FirstName} ${e.LastName}</td><td>${e.Email || '—'}</td></tr>
  `).join('') : `<tr><td colspan="2" style="color:var(--muted);padding:20px;text-align:center;">No employees assigned to this department yet</td></tr>`;

  const th_color = DEPT_COLORS[name] || color;
  document.querySelectorAll('#dept-member-table th').forEach(th => {
    th.style.borderBottomColor = th_color;
    th.style.background        = th_color + '22';
    th.style.color             = '#fff';
  });
  nav('dept-detail');
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
let toastTimer;
function showNotif(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

// ─── INIT ────────────────────────────────────────────────────────────────────
nav('login');
