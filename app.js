// ─── CONFIG ───────────────────────────────────────────────────────────────────
// Auto-detects local vs deployed — no need to change this manually
const API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:20240'
  : `${window.location.protocol}//${window.location.hostname}:20240`;

// ─── AUTH FETCH ──────────────────────────────────────────────────────────────
// Wraps fetch() and attaches the logged-in user's clearance level so the server
// can enforce permissions (create/ban accounts, asset management, wallets, etc).
function authFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (currentUser) {
    headers['x-user-level'] = String(currentUser.level);
    headers['x-username']   = currentUser.username;
  }
  return fetch(url, { ...options, headers });
}

// ─── CLEARANCE LEVELS ────────────────────────────────────────────────────────
// 1 = Student      — view only, cannot borrow
// 2 = Employee     — borrow / return assets
// 3 = Maintenance  — maintenance log + asset management + repair
// 4 = Manager      — everything except create/ban accounts
// 5 = Admin        — everything
const CLEARANCE = { STUDENT: 1, EMPLOYEE: 2, MAINTENANCE: 3, IT: 3, MANAGER: 4, ADMIN: 5 };

// ─── THEMES ──────────────────────────────────────────────────────────────────
// Themes are scoped PER USER (keyed by username), not to the machine/browser —
// each account remembers its own accent color and light/dark mode, so one
// person's choice never bleeds into someone else's session on a shared device.
const THEMES = {
  teal:    { label: 'Teal',                    teal: '#00e5c8', tealDark: '#00b89e', glow: 'rgba(0,229,200,0.25)' },
  purple:  { label: 'Purple',                  teal: '#b088ff', tealDark: '#8a5cf0', glow: 'rgba(176,136,255,0.25)' },
  blue:    { label: 'Blue',                     teal: '#4db8ff', tealDark: '#1f8fe0', glow: 'rgba(77,184,255,0.25)' },
  amber:   { label: 'Amber',                    teal: '#ffb347', tealDark: '#e08e1f', glow: 'rgba(255,179,71,0.25)' },
  ironman: { label: '🔴 Iron Man (Red/Gold)',   teal: '#ffd700', tealDark: '#a4132f', glow: 'rgba(255,215,0,0.3)' },
  batman:  { label: '🦇 Batman (Black/Yellow)', teal: '#ffe135', tealDark: '#000000', glow: 'rgba(255,225,53,0.3)', accentText: '#ffffff', boxBg: '#d4af37', boxText: '#000000' },
};
const THEME_ORDER = Object.keys(THEMES);

// A little Easter egg: tony.stark and bruce.wayne get their matching theme by
// default on their very first login — anyone can still cycle away from it
// (in Settings), and it never overrides a theme they've already picked.
const DEFAULT_THEME_BY_USER = { 'tony.stark': 'ironman', 'bruce.wayne': 'batman' };

const MODES = {
  dark: {
    label: '🌙 Dark Mode',
    bg: '#050a0a', bg2: '#0a1212', surface: '#0d1a1a', surface2: '#112020',
    text: '#e8f8f5', muted: '#7ab8b0',
    topbar1: '#000000', topbar2: '#0a2020',
    pageLogin1: '#003328', pageLogin2: '#000000',
    dashGrid1: '#001a18', dashGrid2: '#000000',
    pageContent1: '#001a18', pageContent2: '#000000',
  },
  light: {
    label: '☀️ Light Mode',
    bg: '#E5EEE4', bg2: '#E5EEE4', surface: '#E5EEE4', surface2: '#E5EEE4',
    text: '#0c1c1c', muted: '#4a6b66',
    topbar1: '#E5EEE4', topbar2: '#E5EEE4',
    pageLogin1: '#E5EEE4', pageLogin2: '#E5EEE4',
    dashGrid1: '#E5EEE4', dashGrid2: '#E5EEE4',
    pageContent1: '#E5EEE4', pageContent2: '#E5EEE4',
  },
};

// No user logged in yet (login screen) falls back to a neutral default rather
// than whatever the last logged-in user on this machine had picked.
let currentThemeName = 'teal';
let currentModeName  = 'dark';

function themeKey(username) { return `crispyTheme_${username}`; }
function modeKey(username)  { return `crispyMode_${username}`;  }

// Loads the given user's own saved theme/mode (or the defaults, if they've
// never set one) and applies it. Called on login and never shares state
// between different usernames on the same browser.
function loadUserTheme(username) {
  currentThemeName = (username && localStorage.getItem(themeKey(username))) || DEFAULT_THEME_BY_USER[username] || 'teal';
  currentModeName  = (username && localStorage.getItem(modeKey(username)))  || 'dark';
  applyTheme(currentThemeName, { persist: false });
  applyMode(currentModeName,   { persist: false });
}

function applyTheme(name, opts = {}) {
  if (!THEMES[name]) name = 'teal';
  currentThemeName = name;
  const t = THEMES[name];
  const root = document.documentElement.style;
  root.setProperty('--teal', t.teal);
  root.setProperty('--teal-dark', t.tealDark);
  root.setProperty('--teal-glow', t.glow);
  root.setProperty('--border', t.glow);
  root.setProperty('--accent-text', t.accentText || '#000000');
  root.setProperty('--box-bg', t.boxBg || 'var(--teal-dark)');
  root.setProperty('--box-text', t.boxText || 'var(--accent-text)');
  if (opts.persist !== false && currentUser) localStorage.setItem(themeKey(currentUser.username), name);
}

function applyMode(name, opts = {}) {
  if (!MODES[name]) name = 'dark';
  currentModeName = name;
  const m = MODES[name];
  const root = document.documentElement.style;
  root.setProperty('--bg', m.bg);
  root.setProperty('--bg2', m.bg2);
  root.setProperty('--surface', m.surface);
  root.setProperty('--surface2', m.surface2);
  root.setProperty('--text', m.text);
  root.setProperty('--muted', m.muted);
  root.setProperty('--topbar-1', m.topbar1);
  root.setProperty('--topbar-2', m.topbar2);
  root.setProperty('--page-login-1', m.pageLogin1);
  root.setProperty('--page-login-2', m.pageLogin2);
  root.setProperty('--dash-grid-1', m.dashGrid1);
  root.setProperty('--dash-grid-2', m.dashGrid2);
  root.setProperty('--page-content-1', m.pageContent1);
  root.setProperty('--page-content-2', m.pageContent2);
  document.documentElement.classList.toggle('light-mode', name === 'light');
  if (opts.persist !== false && currentUser) localStorage.setItem(modeKey(currentUser.username), name);
}

function cycleTheme() {
  const idx  = THEME_ORDER.indexOf(currentThemeName);
  const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
  applyTheme(next);
  const el = document.getElementById('settings-theme-value');
  if (el) el.textContent = THEMES[next].label;
  showNotif(`🎨 Theme: ${THEMES[next].label}`);
}

function cycleMode() {
  const next = currentModeName === 'dark' ? 'light' : 'dark';
  applyMode(next);
  const el = document.getElementById('settings-mode-value');
  if (el) el.textContent = MODES[next].label;
  showNotif(`${next === 'light' ? '☀️' : '🌙'} ${MODES[next].label}`);
}

// Neutral defaults for the login screen, before any user is loaded.
applyTheme(currentThemeName, { persist: false });
applyMode(currentModeName, { persist: false });

// ─── STATE ───────────────────────────────────────────────────────────────────
let currentUser     = null;
let selectedAssetId = null;
let cart            = [];
let notifCount      = 0;
let currentNotifications = [];
let notifInterval = null;
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
  'borrow-history':  CLEARANCE.ADMIN,
  'maintenance':     CLEARANCE.IT,
  'manage-assets':   CLEARANCE.IT,
  'employees':       CLEARANCE.ADMIN,
  'wallets':         CLEARANCE.EMPLOYEE,
  'accounts':        CLEARANCE.ADMIN,
  'account-requests':CLEARANCE.ADMIN,
  'ban-list':        CLEARANCE.ADMIN,
};

function nav(page) {
  const required = PAGE_CLEARANCE[page];
  if (required && (!currentUser || currentUser.level < required)) {
    showNotif('⚠ You do not have clearance to access that page');
    page = 'dashboard';
  }
  if (page !== 'accounts') { resetPasswordTarget = null; }
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
    'borrow-history':   renderBorrowHistory,
    'borrow-requests':  renderBorrowRequests,
    'my-requests':      renderMyRequests,
    wallets:         renderWallets,
    accounts:        renderAccounts,
    'account-requests': renderAccountRequests,
    'ban-list':      renderBanList,
  };
  if (renders[page]) renders[page]();
}

// ─── LOGIN ───────────────────────────────────────────────────────────────────
// Quick-fill helper for the demo-accounts panel on the login page.
function fillLogin(username) {
  document.getElementById('login-user').value = username;
  document.getElementById('login-pass').value = 'password';
  document.getElementById('login-pass').focus();
}

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
      loadUserTheme(currentUser.username);
      await loadAssets();
      await loadEmployees();
      await refreshNotifications();
      if (notifInterval) clearInterval(notifInterval);
      notifInterval = setInterval(refreshNotifications, 60000);
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
  currentNotifications = [];
  applyTheme('teal', { persist: false });
  applyMode('dark', { persist: false });
  if (notifInterval) { clearInterval(notifInterval); notifInterval = null; }
  document.getElementById('notif-panel').style.display = 'none';
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
    { icon: 'fa-solid fa-laptop',              label: 'Asset Inventory',   page: 'inventory',        minLevel: CLEARANCE.STUDENT },
    { icon: 'fa-solid fa-rotate-left',         label: 'Return Assets',     page: 'returns',          minLevel: CLEARANCE.EMPLOYEE },
    { icon: 'fa-solid fa-list-check',          label: 'My Requests',       page: 'my-requests',      minLevel: CLEARANCE.EMPLOYEE },
    { icon: 'fa-solid fa-clock-rotate-left',   label: 'Borrow History',    page: 'borrow-history',   minLevel: CLEARANCE.IT },
    { icon: 'fa-solid fa-inbox',               label: 'Requests',          page: 'borrow-requests',  minLevel: CLEARANCE.IT },
    { icon: 'fa-solid fa-screwdriver-wrench',  label: 'Maintenance Log',   page: 'maintenance',      minLevel: CLEARANCE.IT },
    { icon: 'fa-solid fa-boxes-stacked',       label: 'Manage Assets',     page: 'manage-assets',    minLevel: CLEARANCE.ADMIN },
    { icon: 'fa-solid fa-users',               label: 'Manage Employees',  page: 'employees',        minLevel: CLEARANCE.ADMIN },
    { icon: 'fa-solid fa-building',            label: 'Departments',       page: 'departments',      minLevel: CLEARANCE.STUDENT },
    { icon: 'fa-solid fa-wallet',              label: 'Wallet',            page: 'wallets',          minLevel: CLEARANCE.EMPLOYEE },
    { icon: 'fa-solid fa-key',                 label: 'Accounts',          page: 'accounts',         minLevel: CLEARANCE.ADMIN },
    { icon: 'fa-solid fa-file-circle-question',label: 'Account Requests',  page: 'account-requests', minLevel: CLEARANCE.IT },
    { icon: 'fa-solid fa-ban',                 label: 'Ban List',          page: 'ban-list',         minLevel: CLEARANCE.ADMIN },
    { icon: 'fa-solid fa-gears',               label: 'Settings',          page: 'settings',         minLevel: CLEARANCE.STUDENT },
  ];

  const grid = document.getElementById('dashboard-grid');
  const rings = grid.querySelectorAll('.dash-bg-ring');
  grid.innerHTML = '';
  rings.forEach(r => grid.appendChild(r));
  // Tim Drake gets his own personal joke button straight to the shrine 😄
  if (currentUser.username === 'tim.drake') {
    icons.push({ icon: 'fa-solid fa-face-laugh-squint', label: 'Joke', page: 'shrine', minLevel: CLEARANCE.STUDENT });
  }

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

let notifications    = []; // { id, icon, text, page, level }
let notifPollTimer    = null;

function updateAllNotifBadges() {
  const n = notifications.length;
  document.querySelectorAll('.notif-badge').forEach(el => {
    el.textContent = n;
    el.style.display = n > 0 ? 'inline-block' : 'none';
  });
}

// Pulls together everything the current user should be nudged about:
// - Employee+: their own borrowed assets that are due soon / overdue
// - Maintenance+: assets still sitting "In Service" waiting on a repair
// - Admin: pending account-deletion / change requests
// - Everyone: the resolved status of their own account requests
async function refreshNotifications() {
  if (!currentUser) return;
  const list = [];
  const lvl  = currentUser.level;

  try {
    if (lvl >= CLEARANCE.EMPLOYEE) {
      const res  = await fetch(`${API}/borrows/active`);
      const rows = await res.json();
      const mine = rows.filter(r => r.BorrowedBy === currentUser.username);
      const now  = new Date();
      mine.forEach(r => {
        if (!r.DueDate) return;
        const due = new Date(r.DueDate);
        const daysLeft = Math.ceil((due - now) / 86400000);
        if (daysLeft < 0) {
          list.push({ icon: '⚠', text: `${r.Brand} ${r.Model} is overdue for return (was due ${due.toLocaleDateString()})`, page: 'returns' });
        } else if (daysLeft <= 2) {
          list.push({ icon: '⏰', text: `${r.Brand} ${r.Model} return is due ${daysLeft === 0 ? 'today' : 'in ' + daysLeft + ' day(s)'}`, page: 'returns' });
        }
      });
    }
  } catch {}

  try {
    if (lvl >= CLEARANCE.IT) {
      await loadAssets();
      assets.filter(a => a.status === 'service').forEach(a => {
        list.push({ icon: '🔧', text: `${a.name} (ID ${a.id}) is still In Service — repair pending`, page: 'maintenance' });
      });
    }
  } catch {}

  try {
    if (lvl >= CLEARANCE.ADMIN) {
      const res  = await authFetch(`${API}/account-requests`);
      const rows = await res.json();
      rows.filter(r => r.status === 'pending').forEach(r => {
        list.push({ icon: '📥', text: `${r.username} requested to ${r.type === 'delete' ? 'delete' : 'change'} their account`, page: 'account-requests' });
      });
    } else {
      const res  = await fetch(`${API}/account-requests/mine/${currentUser.username}`);
      const rows = await res.json();
      rows.filter(r => r.status !== 'pending').forEach(r => {
        list.push({ icon: r.status === 'approved' ? '✅' : '❌', text: `Your ${r.type} request was ${r.status}`, page: 'profile' });
      });
    }
  } catch {}

  notifications = list;
  updateAllNotifBadges();
}

function toggleNotifPanel() {
  if (!notifications.length) { showNotif('No new notifications'); return; }
  const lines = notifications.map(n => `${n.icon} ${n.text}`).join('\n');
  alert(lines);
}

function startNotifPolling() {
  refreshNotifications();
  clearInterval(notifPollTimer);
  notifPollTimer = setInterval(refreshNotifications, 60000); // recheck every minute
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────
function renderSettings() {
  if (!currentUser) return;
  const lvlLabels = { 1: 'Level 1 — Student', 2: 'Level 2 — Employee', 3: 'Level 3 — Maintenance', 4: 'Level 4 — Manager', 5: 'Level 5 — Admin' };
  document.getElementById('settings-username').textContent = currentUser.fullName;
  document.getElementById('settings-level').textContent    = lvlLabels[currentUser.level] || 'Level ' + currentUser.level;
  document.getElementById('settings-theme-value').textContent = THEMES[currentThemeName].label;
  document.getElementById('settings-mode-value').textContent  = MODES[currentModeName].label;
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
    const response = await authFetch(`${API}/assets`);
    if (!response.ok) throw new Error('Failed');
    const raw = await response.json();
    if (raw.length > 0) {
      assets = raw.map(a => ({
        id:        a.AssetID,
        name:      `${a.Brand} ${a.Model}`,
        status:    a.Status === 'In Service' ? 'service' : (a.Status || 'available').toLowerCase().replace(' ', '-'),
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
  const tbody    = document.getElementById('cart-tbody');
  const walletEl = document.getElementById('cart-wallet-balance');
  const noticeEl = document.getElementById('cart-role-notice');
  if (currentUser) walletEl.textContent = peso(currentUser.wallet);

  // Show notice to employees that their borrow is a request
  if (noticeEl) noticeEl.style.display = (currentUser && currentUser.level < CLEARANCE.IT) ? 'block' : 'none';

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
  updateCartTotal();
}

function removeFromCart(id) {
  cart = cart.filter(c => c.id !== id);
  notifCount = Math.max(0, notifCount - 1);
  updateAllNotifBadges();
  renderCart();
}

async function borrowCart() {
  if (cart.length === 0)   { showNotif('Cart is empty'); return; }
  if (!currentUser)        { showNotif('Please log in'); return; }
  const rd = document.getElementById('return-date').value;
  if (!rd)                 { showNotif('Please set a return date'); return; }

  // Employees and Students submit a REQUEST — IT Dept and Admin borrow directly
  const isDirectBorrow = currentUser.level >= CLEARANCE.IT;

  try {
    const endpoint = isDirectBorrow ? `${API}/borrow` : `${API}/borrow-requests`;
    const body     = isDirectBorrow
      ? { assetIds: cart.map(a => a.id), borrowedBy: currentUser.username, dueDate: rd }
      : { assetIds: cart.map(a => a.id), requestedBy: currentUser.username, dueDate: rd };

    const res = await authFetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      if (isDirectBorrow) {
        showNotif(`✓ ${cart.length} item(s) borrowed successfully!`);
        cart.forEach(item => { const a = assets.find(x => x.id === item.id); if (a) a.status = 'unavailable'; });
      } else {
        showNotif(`📋 Borrow request submitted! Waiting for IT/Admin approval.`);
      }
      cart = []; notifCount = 0; updateAllNotifBadges();
      await loadAssets();
      nav('inventory');
    } else {
      showNotif('Failed: ' + (data.message || 'Unknown error'));
    }
  } catch { showNotif('Server offline — request not saved'); }
}

// ─── RETURN ASSETS ───────────────────────────────────────────────────────────
// Employees: see their own borrows + submit return requests
// IT/Admin:  see ALL active borrows + approve/deny return requests
async function renderReturns() {
  const isApprover = currentUser && currentUser.level >= CLEARANCE.IT;
  const tbody      = document.getElementById('returns-tbody');

  // Show/hide the pending return requests section (IT/Admin only)
  const pendingSection = document.getElementById('pending-return-requests-section');
  if (pendingSection) pendingSection.style.display = isApprover ? 'block' : 'none';

  tbody.innerHTML = '<tr><td colspan="6" style="color:var(--muted);padding:20px;">Loading…</td></tr>';

  try {
    const res  = await fetch(`${API}/borrows/active`);
    let   rows = await res.json();

    // Employees only see their own borrows
    if (!isApprover) rows = rows.filter(r => r.BorrowedBy === currentUser?.username);

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="color:var(--muted);padding:20px;">${isApprover ? 'No active borrows.' : 'You have no borrowed assets.'}</td></tr>`;
    } else {
      tbody.innerHTML = rows.map(r => {
        const borrowedDate = new Date(r.BorrowedAt).toLocaleDateString();
        const dueDate      = r.DueDate ? new Date(r.DueDate).toLocaleDateString() : '—';
        const isOverdue    = r.DueDate && new Date(r.DueDate) < new Date();
        const isOwn        = r.BorrowedBy === currentUser?.username;
        // IT/Admin always gets Approve Return — even for their own borrows
        // Employee only gets Request Return for their own borrows
        const actionBtn = isApprover
          ? `<button class="teal-btn" onclick="returnAsset(${r.LogID}, '${r.Brand} ${r.Model}', ${r.DailyCost})">Approve Return</button>`
          : isOwn
            ? `<button class="teal-btn" onclick="submitReturnRequest(${r.LogID}, '${r.Brand} ${r.Model}')">Request Return</button>`
            : '—';
        return `<tr ${isOverdue ? 'style="background:rgba(255,68,68,0.08);"' : ''}>
          <td>${r.Brand} ${r.Model}<br><span style="font-size:11px;color:var(--muted);">ID: ${r.AssetID}</span></td>
          <td>${r.BorrowedBy}</td>
          <td>${borrowedDate}</td>
          <td style="color:${isOverdue ? '#ff4444' : 'inherit'};">${dueDate}${isOverdue ? ' ⚠ Overdue' : ''}</td>
          <td style="color:#00e5c8;">${peso(r.DailyCost)}/day</td>
          <td>${actionBtn}</td>
        </tr>`;
      }).join('');
    }

    // If IT/Admin: also load pending return requests
    if (isApprover) await renderPendingReturnRequests();

  } catch {
    tbody.innerHTML = '<tr><td colspan="6" style="color:#ff4444;padding:20px;">Failed to load — is the server running?</td></tr>';
  }
}

// Employee submits a return request
async function submitReturnRequest(logId, assetName) {
  if (!confirm(`Request to return "${assetName}"?\n\nIT/Admin will review and approve the return.`)) return;
  try {
    const res  = await authFetch(`${API}/return-requests`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logId, requestedBy: currentUser.username }),
    });
    const data = await res.json();
    if (res.ok) { showNotif('📋 Return request submitted! Waiting for IT/Admin approval.'); renderReturns(); }
    else showNotif('Failed: ' + (data.message || 'Unknown'));
  } catch { showNotif('Server offline'); }
}

// IT/Admin sees and acts on pending return requests
async function renderPendingReturnRequests() {
  const container = document.getElementById('pending-return-requests-tbody');
  if (!container) return;
  try {
    const res  = await authFetch(`${API}/return-requests`);
    const rows = await res.json();
    const pending = rows.filter(r => r.Status === 'Pending');
    if (!pending.length) {
      container.innerHTML = '<tr><td colspan="6" style="color:var(--muted);padding:12px;">No pending return requests.</td></tr>';
      return;
    }
    container.innerHTML = pending.map(r => `
      <tr>
        <td>${r.Brand} ${r.Model}</td>
        <td>${r.RequestedBy}</td>
        <td>${new Date(r.CreatedAt).toLocaleDateString()}</td>
        <td style="color:#00e5c8;">${peso(r.DailyCost)}/day</td>
        <td>
          <button class="teal-btn" style="margin-right:6px;" onclick="reviewReturnRequest(${r.RequestID},'approve')">✓ Approve</button>
          <button class="add-btn" onclick="reviewReturnRequest(${r.RequestID},'deny')">✕ Deny</button>
        </td>
      </tr>`).join('');
  } catch { container.innerHTML = '<tr><td colspan="6" style="color:#ff4444;">Failed to load.</td></tr>'; }
}

async function reviewReturnRequest(requestId, action) {
  const denyReason = action === 'deny' ? prompt('Reason for denial:') : null;
  if (action === 'deny' && denyReason === null) return; // cancelled
  const note = action === 'approve' ? prompt('Optional note for the employee (leave blank for none):') : null;
  if (action === 'approve' && note === null) return; // cancelled
  try {
    const res  = await authFetch(`${API}/return-requests/${requestId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reviewedBy: currentUser.username, denyReason, note }),
    });
    const data = await res.json();
    if (res.ok) {
      showNotif(action === 'approve'
        ? `✓ Return approved! Charge: ${peso(data.totalCharge)} (${data.days} days)`
        : '✕ Return request denied');
      await loadAssets();
      renderReturns();
      refreshNotifications();
    } else showNotif('Failed: ' + (data.message || 'Unknown'));
  } catch { showNotif('Server offline'); }
}

// ─── RETURN MODAL ────────────────────────────────────────────────────────────
let pendingReturnLogId = null;

async function returnAsset(logId, name, dailyCost) {
  // Show loading state first
  showNotif('Loading return details…');
  try {
    const res  = await authFetch(`${API}/return/preview/${logId}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      showNotif(res.status === 403 ? '⚠ ' + (errData.message || 'Not your item to return') : 'Could not load return details');
      return;
    }
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
      refreshNotifications();
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
  const isAdmin = currentUser && currentUser.level >= CLEARANCE.IT;
  const titleEl = document.getElementById('borrow-history-title');
  if (titleEl) titleEl.textContent = isAdmin ? 'Borrow History (All Users)' : 'My Borrow History';

  const tbody = document.getElementById('history-tbody');
  tbody.innerHTML = '<tr><td colspan="6" style="color:var(--muted);padding:20px;">Loading…</td></tr>';
  try {
    const res  = await fetch(`${API}/borrows/history`);
    let   rows = await res.json();

    // Employees see only their own history
    if (!isAdmin) rows = rows.filter(r => r.BorrowedBy === currentUser?.username);

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="color:var(--muted);padding:20px;">${isAdmin ? 'No history yet.' : 'You have no borrow history yet.'}</td></tr>`;
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

// ─── BORROW REQUESTS (IT/Admin approves or denies) ───────────────────────────
async function renderBorrowRequests() {
  const pendingTbody = document.getElementById('borrow-req-pending-tbody');
  const allTbody     = document.getElementById('borrow-req-all-tbody');
  if (!pendingTbody) return;
  pendingTbody.innerHTML = '<tr><td colspan="6" style="color:var(--muted);padding:20px;">Loading…</td></tr>';
  allTbody.innerHTML     = '<tr><td colspan="6" style="color:var(--muted);padding:20px;">Loading…</td></tr>';
  const statusColor = { Pending:'#ff8800', Approved:'#00e5c8', Denied:'#ff4444' };

  try {
    const res  = await authFetch(`${API}/borrow-requests`);
    const rows = await res.json();
    const pending = rows.filter(r => r.Status === 'Pending');

    pendingTbody.innerHTML = pending.length
      ? pending.map(r => `
        <tr style="background:rgba(255,136,0,0.06);">
          <td>${r.Brand} ${r.Model}<br><span style="font-size:11px;color:var(--muted);">S/N: ${r.SerialNumber}</span></td>
          <td>${r.RequestedBy}</td>
          <td>${r.DueDate ? new Date(r.DueDate).toLocaleDateString() : '—'}</td>
          <td style="color:#00e5c8;">₱${parseFloat(r.DailyCost||0).toFixed(2)}/day</td>
          <td style="font-size:11px;color:var(--muted);">${new Date(r.CreatedAt).toLocaleString()}</td>
          <td>
            <button class="teal-btn" style="margin-right:6px;" onclick="reviewBorrowRequest(${r.RequestID},'approve')">✓ Approve</button>
            <button class="add-btn" onclick="reviewBorrowRequest(${r.RequestID},'deny')">✕ Deny</button>
          </td>
        </tr>`).join('')
      : '<tr><td colspan="6" style="color:var(--muted);padding:16px;">No pending borrow requests.</td></tr>';

    allTbody.innerHTML = rows.length
      ? rows.map(r => `
        <tr>
          <td>${r.Brand} ${r.Model}</td>
          <td>${r.RequestedBy}</td>
          <td>${r.DueDate ? new Date(r.DueDate).toLocaleDateString() : '—'}</td>
          <td style="color:${statusColor[r.Status]||'#fff'};">${r.Status}</td>
          <td>${r.ReviewedBy || '—'}</td>
          <td style="font-size:11px;color:${r.Status==='Denied'?'#ff8888':'var(--muted)'};">${r.DenyReason || '—'}</td>
        </tr>`).join('')
      : '<tr><td colspan="6" style="color:var(--muted);padding:16px;">No requests yet.</td></tr>';
  } catch {
    pendingTbody.innerHTML = '<tr><td colspan="6" style="color:#ff4444;padding:20px;">Failed to load.</td></tr>';
  }

  // Return requests — shown in the same unified Requests page
  const returnPendingTbody = document.getElementById('req-page-return-pending-tbody');
  const returnAllTbody     = document.getElementById('req-page-return-all-tbody');
  if (!returnPendingTbody) return;
  returnPendingTbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted);padding:20px;">Loading…</td></tr>';
  returnAllTbody.innerHTML     = '<tr><td colspan="5" style="color:var(--muted);padding:20px;">Loading…</td></tr>';

  try {
    const res  = await authFetch(`${API}/return-requests`);
    const rows = await res.json();
    const pending = rows.filter(r => r.Status === 'Pending');

    returnPendingTbody.innerHTML = pending.length
      ? pending.map(r => `
        <tr style="background:rgba(255,136,0,0.06);">
          <td>${r.Brand} ${r.Model}</td>
          <td>${r.RequestedBy}</td>
          <td>${new Date(r.CreatedAt).toLocaleDateString()}</td>
          <td style="color:#00e5c8;">${peso(r.DailyCost)}/day</td>
          <td>
            <button class="teal-btn" style="margin-right:6px;" onclick="reviewReturnRequest(${r.RequestID},'approve')">✓ Approve</button>
            <button class="add-btn" onclick="reviewReturnRequest(${r.RequestID},'deny')">✕ Deny</button>
          </td>
        </tr>`).join('')
      : '<tr><td colspan="5" style="color:var(--muted);padding:16px;">No pending return requests.</td></tr>';

    returnAllTbody.innerHTML = rows.length
      ? rows.map(r => `
        <tr>
          <td>${r.Brand} ${r.Model}</td>
          <td>${r.RequestedBy}</td>
          <td style="color:${statusColor[r.Status]||'#fff'};">${r.Status}</td>
          <td>${r.ReviewedBy || '—'}</td>
          <td style="font-size:11px;color:${r.Status==='Denied'?'#ff8888':'var(--muted)'};">${r.DenyReason || '—'}</td>
        </tr>`).join('')
      : '<tr><td colspan="5" style="color:var(--muted);padding:16px;">No requests yet.</td></tr>';

    // Keep the little badge/section on the Returns page in sync too, since it
    // shares the same underlying data and some approvers may still land there first.
    updateAllNotifBadges();
  } catch {
    returnPendingTbody.innerHTML = '<tr><td colspan="5" style="color:#ff4444;padding:20px;">Failed to load.</td></tr>';
  }
}

async function reviewBorrowRequest(requestId, action) {
  const denyReason = action === 'deny' ? prompt('Reason for denial:') : null;
  if (action === 'deny' && denyReason === null) return; // cancelled
  const note = action === 'approve' ? prompt('Optional note for the employee (leave blank for none):') : null;
  if (action === 'approve' && note === null) return; // cancelled
  try {
    const res  = await authFetch(`${API}/borrow-requests/${requestId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reviewedBy: currentUser.username, denyReason, note }),
    });
    const data = await res.json();
    if (res.ok) {
      showNotif(action === 'approve' ? '✓ Borrow approved — asset is now In Use' : '✕ Borrow request denied');
      await loadAssets();
      renderBorrowRequests();
      refreshNotifications();
    } else showNotif('Failed: ' + (data.message || 'Unknown'));
  } catch { showNotif('Server offline'); }
}

// ─── MY REQUESTS (Employee sees own borrow + return requests) ─────────────────
async function renderMyRequests() {
  const borrowTbody = document.getElementById('my-borrow-req-tbody');
  const returnTbody = document.getElementById('my-return-req-tbody');
  if (!borrowTbody) return;
  borrowTbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted);padding:16px;">Loading…</td></tr>';
  returnTbody.innerHTML = '<tr><td colspan="4" style="color:var(--muted);padding:16px;">Loading…</td></tr>';
  const statusColor = { Pending:'#ff8800', Approved:'#00e5c8', Denied:'#ff4444' };
  try {
    const [brRes, rrRes] = await Promise.all([
      fetch(`${API}/borrow-requests/mine/${currentUser.username}`),
      fetch(`${API}/return-requests/mine/${currentUser.username}`),
    ]);
    const borrowReqs = await brRes.json();
    const returnReqs = await rrRes.json();
    borrowTbody.innerHTML = borrowReqs.length
      ? borrowReqs.map(r => `
        <tr>
          <td>${r.Brand} ${r.Model}</td>
          <td>${r.DueDate ? new Date(r.DueDate).toLocaleDateString() : '—'}</td>
          <td style="font-size:11px;color:var(--muted);">${new Date(r.CreatedAt).toLocaleString()}</td>
          <td style="color:${statusColor[r.Status]||'#fff'};">${r.Status}</td>
          <td style="font-size:11px;color:${r.Status==='Denied'?'#ff8888':'var(--muted)'};">${r.DenyReason || '—'}</td>
        </tr>`).join('')
      : '<tr><td colspan="5" style="color:var(--muted);padding:12px;">No borrow requests yet.</td></tr>';
    returnTbody.innerHTML = returnReqs.length
      ? returnReqs.map(r => `
        <tr>
          <td>${r.Brand} ${r.Model}</td>
          <td style="font-size:11px;color:var(--muted);">${new Date(r.CreatedAt).toLocaleString()}</td>
          <td style="color:${statusColor[r.Status]||'#fff'};">${r.Status}</td>
          <td style="font-size:11px;color:${r.Status==='Denied'?'#ff8888':'var(--muted)'};">${r.DenyReason || '—'}</td>
        </tr>`).join('')
      : '<tr><td colspan="4" style="color:var(--muted);padding:12px;">No return requests yet.</td></tr>';
  } catch {
    borrowTbody.innerHTML = '<tr><td colspan="5" style="color:#ff4444;">Failed to load.</td></tr>';
  }
}

// ─── CART TOTAL CALCULATOR ────────────────────────────────────────────────────
function updateCartTotal() {
  const rd      = document.getElementById('return-date').value;
  const daysEl  = document.getElementById('cart-days');
  const totalEl = document.getElementById('cart-total');
  if (!rd || !daysEl || !totalEl) return;
  const today = new Date(); today.setHours(0,0,0,0);
  const due   = new Date(rd);
  const days  = Math.max(1, Math.ceil((due - today) / (1000 * 60 * 60 * 24)));
  const total = cart.reduce((sum, a) => sum + (parseFloat(a.dailyCost) || 0) * days, 0);
  daysEl.textContent  = days + ' day(s)';
  totalEl.textContent = peso(total);
}

// ─── MAINTENANCE ─────────────────────────────────────────────────────────────
function renderMaintenance() {
  const tbody     = document.getElementById('maintenance-tbody');
  const inService = assets.filter(a => a.status === 'service');
  tbody.innerHTML = inService.length
    ? inService.map(a => `
      <tr>
        <td>${a.id}</td>
        <td>${a.name}</td>
        <td>${statusHtml(a.status)}</td>
        <td><button class="teal-btn" onclick="openRepair(${a.id})">View / Log</button></td>
      </tr>`).join('')
    : `<tr><td colspan="4" style="color:var(--muted);padding:20px;text-align:center;">No assets currently in service.</td></tr>`;

  // Also show all assets for logging purposes (even if not in service)
  const allTbody = document.getElementById('maintenance-all-tbody');
  if (allTbody) {
    allTbody.innerHTML = assets.filter(a => a.status !== 'service').map(a => `
      <tr>
        <td>${a.id}</td>
        <td>${a.name}</td>
        <td>${statusHtml(a.status)}</td>
        <td><button class="add-btn" style="font-size:11px;" onclick="openRepair(${a.id})">Add Log</button></td>
      </tr>`).join('');
  }
  document.getElementById('repair-detail').style.display = 'none';
}

async function openRepair(id) {
  if (!currentUser || currentUser.level < CLEARANCE.IT) { showNotif('⚠ IT Department clearance required'); return; }
  selectedAssetId = id;
  const asset = assets.find(a => a.id === id);
  document.getElementById('repair-device-name').textContent = 'Device: ' + asset.name;
  document.getElementById('repair-serial').textContent      = 'Serial: ' + asset.serial;
  document.getElementById('repair-issue1').textContent      = asset.status === 'service' ? '⚠ Device is currently In Service' : 'ℹ Device is not in service';
  document.getElementById('repair-issue2').textContent      = asset.borrowedBy ? 'Reported by: ' + asset.borrowedBy : 'No reporter info';
  document.getElementById('repair-notes-input').value       = '';
  document.getElementById('repair-detail').style.display    = 'block';
  document.getElementById('repair-detail').scrollIntoView({ behavior: 'smooth' });

  // Load maintenance log history for this asset
  await loadMaintenanceLogs(id);
}

async function loadMaintenanceLogs(assetId) {
  const logContainer = document.getElementById('maintenance-log-entries');
  if (!logContainer) return;
  logContainer.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px 0;">Loading logs…</div>';
  try {
    const res  = await authFetch(`${API}/assets/${assetId}/maintenance-logs`);
    const rows = await res.json();
    if (!rows.length) {
      logContainer.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px 0;">No maintenance logs yet for this asset.</div>';
      return;
    }
    logContainer.innerHTML = rows.map(entry => {
      const typeColor = entry.EntryType === 'system' ? '#ff8800' : entry.EntryType === 'resolved' ? '#00e5c8' : '#b0b0b0';
      const typeLabel = entry.EntryType === 'system' ? '⚙ SYSTEM' : entry.EntryType === 'resolved' ? '✓ RESOLVED' : '📝 NOTE';
      return `
        <div style="border-left:3px solid ${typeColor};padding:8px 12px;margin-bottom:8px;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="font-size:10px;color:${typeColor};font-family:'Orbitron',monospace;letter-spacing:1px;">${typeLabel}</span>
            <span style="font-size:10px;color:var(--muted);">${new Date(entry.CreatedAt).toLocaleString()} · ${entry.LoggedBy}</span>
          </div>
          <div style="font-family:'Share Tech Mono',monospace;font-size:12px;color:var(--text);">${entry.Note}</div>
        </div>`;
    }).join('');
  } catch { logContainer.innerHTML = '<div style="color:#ff4444;font-size:12px;">Failed to load logs.</div>'; }
}

async function saveRepairNotes() {
  if (!currentUser || currentUser.level < CLEARANCE.IT) { showNotif('⚠ IT Department clearance required'); return; }
  const asset = assets.find(a => a.id === selectedAssetId);
  if (!asset) return;
  const note = document.getElementById('repair-notes-input').value.trim();
  if (!note) { showNotif('Please enter a note'); return; }
  try {
    const res  = await authFetch(`${API}/assets/${asset.id}/maintenance-logs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note, entryType: 'note', loggedBy: currentUser.username }),
    });
    const data = await res.json();
    if (res.ok) {
      document.getElementById('repair-notes-input').value = '';
      showNotif('✓ Maintenance log entry saved');
      await loadMaintenanceLogs(selectedAssetId);
    } else { showNotif('Failed: ' + (data.message || 'Unknown')); }
  } catch { showNotif('Server offline — log not saved'); }
}

async function markAvailable() {
  if (!currentUser || currentUser.level < CLEARANCE.IT) { showNotif('⚠ IT Department clearance required'); return; }
  const asset = assets.find(a => a.id === selectedAssetId);
  if (!asset) return;
  try {
    const res  = await authFetch(`${API}/assets/${asset.id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'available' }),
    });
    const data = await res.json();
    if (!res.ok) { showNotif('Failed: ' + (data.message || 'Unknown')); return; }
    // Also log the resolution
    await authFetch(`${API}/assets/${asset.id}/maintenance-logs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'Device marked as Available — maintenance resolved.', entryType: 'resolved', loggedBy: currentUser.username }),
    });
    asset.status = 'available';
    showNotif(`✓ ${asset.name} marked Available — resolution logged`);
    document.getElementById('repair-detail').style.display = 'none';
    await loadAssets();
    renderMaintenance();
    refreshNotifications();
  } catch { showNotif('Server offline — status not saved'); }
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
  document.getElementById('add-asset-section').style.display = lvl >= CLEARANCE.IT ? 'block' : 'none';
}

function openAssetDetail(id) {
  selectedAssetId = id;
  const a        = assets.find(x => x.id === id);
  const container = document.getElementById('asset-detail-content');
  const canEdit  = currentUser && currentUser.level >= CLEARANCE.IT;
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
  if (!a) return;
  try {
    const [statusRes, costRes] = await Promise.all([
      authFetch(`${API}/assets/${selectedAssetId}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: sel }),
      }),
      authFetch(`${API}/assets/${selectedAssetId}/cost`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyCost: cost }),
      }),
    ]);
    if (!statusRes.ok) { const d = await statusRes.json(); showNotif('Status update failed: ' + (d.message || 'Unknown')); return; }
    if (!costRes.ok)   { const d = await costRes.json();   showNotif('Cost update failed: ' + (d.message || 'Unknown'));   return; }
    a.status = sel; a.dailyCost = cost;
    showNotif(`✓ ${a.name} updated`);
    await loadAssets();
    openAssetDetail(selectedAssetId);
    refreshNotifications();
  } catch { showNotif('Server offline — changes not saved'); }
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
  const canManage = lvl >= CLEARANCE.ADMIN;
  const canDelete = lvl >= CLEARANCE.ADMIN;
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
        <div style="display:flex;gap:8px;margin-top:8px;">
          ${canManage ? `<button class="teal-btn" onclick="saveEmployeeDept(${e.EmployeeID})">Save Department</button>` : ''}
          ${canDelete ? `<button class="add-btn" style="background:#3a0000;border-color:#ff4444;color:#ff8888;" onclick="deleteEmployee(${e.EmployeeID}, '${e.FirstName} ${e.LastName}')">🗑 Delete</button>` : ''}
        </div>
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

// Admin only — permanently removes the employee record and any linked login
// account. This is the reliable path for purging test/dummy data or ex-staff,
// independent of the Account Requests flow (which only handles linked accounts).
async function deleteEmployee(employeeId, name) {
  if (!currentUser || currentUser.level < CLEARANCE.ADMIN) { showNotif('Admin only'); return; }
  if (!confirm(`Permanently delete "${name}" and any linked login account? This cannot be undone.`)) return;
  try {
    const res  = await authFetch(`${API}/employees/${employeeId}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      showNotif(`✓ "${name}" deleted from the system`);
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
  const level     = parseInt(document.getElementById('new-emp-level').value, 10) || CLEARANCE.EMPLOYEE;
  if (!firstName || !lastName) { showNotif('Please enter First and Last name'); return; }
  if (!dept)                   { showNotif('Please select a Department');        return; }
  try {
    const res = await authFetch(`${API}/employees`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, department: dept, jobTitle: title, email, level,
        photoData: empPhotoData, photoMime: empPhotoMime }),
    });
    const data = await res.json();
    if (res.ok) {
      showNotif(`✓ Employee "${firstName} ${lastName}" added!`);
      if (data.account) {
        alert(`Account created for ${firstName} ${lastName}:\n\nUsername: ${data.account.username}\nPassword: ${data.account.password}\nClearance: ${data.account.role} (Level ${data.account.level})\n\nShare these with the employee. You can view this anytime in Accounts (Admin).`);
      }
      ['new-emp-firstname','new-emp-lastname','new-emp-title','new-emp-email'].forEach(id => document.getElementById(id).value = '');
      document.getElementById('new-emp-dept').value  = '';
      document.getElementById('new-emp-level').value = '2';
      document.getElementById('new-emp-photo-display').innerHTML = '<i class="fa-solid fa-image"></i>';
      document.getElementById('new-emp-photo-name').textContent  = '';
      empPhotoData = null; empPhotoMime = null;
      await loadEmployees();
      renderEmployees();
    } else { showNotif('Failed: ' + (data.message || 'Unknown')); }
  } catch { showNotif('Server offline'); }
}

// ─── CHANGE REQUEST MODAL (Admin edits the requester's info directly) ───────
let changeReqState = { requestId: null, username: null, employeeId: null };

async function openChangeRequestModal(requestId, username) {
  try {
    const res = await authFetch(`${API}/accounts/${encodeURIComponent(username)}`);
    const acc = await res.json();
    if (!res.ok) { showNotif('Failed: ' + (acc.message || 'Account not found')); return; }
    changeReqState = { requestId, username, employeeId: acc.EmployeeID || null };
    document.getElementById('cr-username').textContent  = `${username} — ${acc.fullName || ''}`;
    document.getElementById('cr-firstname').value = acc.FirstName || '';
    document.getElementById('cr-lastname').value  = acc.LastName || '';
    document.getElementById('cr-dept').value      = acc.Department || '';
    document.getElementById('cr-email').value     = acc.Email || '';
    document.getElementById('cr-level').value     = String(acc.level || 2);
    document.getElementById('change-req-modal').style.display = 'flex';
  } catch { showNotif('Server offline'); }
}

function closeChangeRequestModal() {
  document.getElementById('change-req-modal').style.display = 'none';
}

async function saveChangeRequest() {
  const { requestId, username, employeeId } = changeReqState;
  if (!username) return;
  const firstName = document.getElementById('cr-firstname').value.trim();
  const lastName  = document.getElementById('cr-lastname').value.trim();
  const dept      = document.getElementById('cr-dept').value;
  const email     = document.getElementById('cr-email').value.trim();
  const level     = parseInt(document.getElementById('cr-level').value, 10);
  const roles     = { 1: 'Student', 2: 'Employee', 3: 'Maintenance', 4: 'Manager', 5: 'Admin' };

  try {
    if (employeeId) {
      const empRes = await authFetch(`${API}/employees/${employeeId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, department: dept || null, email: email || null }),
      });
      if (!empRes.ok) { const d = await empRes.json(); showNotif('Failed: ' + (d.message || 'Unknown')); return; }
    }
    const accRes  = await authFetch(`${API}/accounts/${encodeURIComponent(username)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, role: roles[level] || 'Employee', fullName: `${firstName} ${lastName}`.trim() || undefined }),
    });
    const accData = await accRes.json();
    if (!accRes.ok) { showNotif('Failed: ' + (accData.message || 'Unknown')); return; }

    // Mark the request itself resolved (approved) now that the change is applied
    const reqRes = await authFetch(`${API}/account-requests/${requestId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', resolvedBy: currentUser.username }),
    });
    if (reqRes.ok) {
      showNotif(accData.usernameChanged
        ? `✓ Account updated — username changed to "${accData.username}"`
        : '✓ Account updated and request resolved');
      closeChangeRequestModal();
      renderAccountRequests();
      refreshNotifications();
    } else {
      showNotif('Account updated, but request status failed to update');
    }
  } catch { showNotif('Server offline'); }
}

// ─── ACCOUNT REQUESTS (any user submits; Admin resolves) ────────────────────
function openAccountRequestModal() {
  document.getElementById('acct-req-type').value    = 'delete';
  document.getElementById('acct-req-details').value = '';
  document.getElementById('account-request-modal').style.display = 'flex';
}
function closeAccountRequestModal() {
  document.getElementById('account-request-modal').style.display = 'none';
}
async function submitAccountRequest() {
  if (!currentUser) return;
  const type    = document.getElementById('acct-req-type').value;
  const details = document.getElementById('acct-req-details').value.trim();
  try {
    const res  = await authFetch(`${API}/account-requests`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser.username, type, details }),
    });
    const data = await res.json();
    if (res.ok) {
      showNotif('✓ Request submitted to Admin');
      closeAccountRequestModal();
    } else { showNotif('Failed: ' + (data.message || 'Unknown')); }
  } catch { showNotif('Server offline'); }
}

async function renderAccountRequests() {
  if (!currentUser || currentUser.level < CLEARANCE.ADMIN) { showNotif('Admin only'); nav('dashboard'); return; }
  const tbody = document.getElementById('account-requests-tbody');
  tbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted);padding:20px;">Loading…</td></tr>';
  try {
    const res  = await authFetch(`${API}/account-requests`);
    const rows = await res.json();
    if (!res.ok) { showNotif('Error: ' + (rows.message || 'Unknown')); return; }
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted);padding:20px;">No requests.</td></tr>'; return; }
    tbody.innerHTML = rows.map(r => {
      const statusColor = r.status === 'pending' ? '#ffcc00' : r.status === 'approved' ? '#00e5c8' : '#ff4444';
      let actions;
      if (r.status === 'pending' && r.type === 'change') {
        actions = `
        <button class="teal-btn" onclick="openChangeRequestModal(${r.RequestID}, '${r.username}')">Change</button>
        <button class="add-btn" style="background:#3a0000;border-color:#ff4444;color:#ff8888;" onclick="resolveAccountRequest(${r.RequestID},'deny')">Deny</button>`;
      } else if (r.status === 'pending') {
        actions = `
        <button class="teal-btn" onclick="resolveAccountRequest(${r.RequestID},'approve')">Approve</button>
        <button class="add-btn" style="background:#3a0000;border-color:#ff4444;color:#ff8888;" onclick="resolveAccountRequest(${r.RequestID},'deny')">Deny</button>`;
      } else {
        actions = `<span style="color:var(--muted);font-size:11px;">Resolved by ${r.ResolvedBy || '—'}</span>`;
      }
      return `
      <tr>
        <td>${r.username}</td>
        <td style="text-transform:capitalize;">${r.type}</td>
        <td style="max-width:280px;white-space:pre-wrap;">${r.details || '—'}</td>
        <td style="color:${statusColor};text-transform:capitalize;">${r.status}</td>
        <td style="display:flex;gap:6px;">${actions}</td>
      </tr>`;
    }).join('');
  } catch { tbody.innerHTML = '<tr><td colspan="5" style="color:#ff4444;padding:20px;">Failed to load.</td></tr>'; }
}

async function resolveAccountRequest(requestId, action) {
  if (action === 'approve' && !confirm('Are you sure? Approving a delete request permanently removes that login account.')) return;
  try {
    const res  = await authFetch(`${API}/account-requests/${requestId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, resolvedBy: currentUser.username }),
    });
    const data = await res.json();
    if (res.ok) { showNotif(`✓ Request ${action === 'approve' ? 'approved' : 'denied'}`); renderAccountRequests(); refreshNotifications(); }
    else { showNotif('Failed: ' + (data.message || 'Unknown')); }
  } catch { showNotif('Server offline'); }
}

// ─── ACCOUNTS (admin only — passwords are hashed, never shown) ──────────────
let accountsData     = [];
let resetPasswordTarget = null; // username currently pending a PIN-gated reset

async function renderAccounts() {
  if (!currentUser || currentUser.level < CLEARANCE.ADMIN) { showNotif('Admin only'); nav('dashboard'); return; }
  resetPasswordTarget = null;
  const tbody = document.getElementById('accounts-tbody');
  tbody.innerHTML = '<tr><td colspan="6" style="color:var(--muted);padding:20px;">Loading…</td></tr>';
  try {
    const res  = await authFetch(`${API}/accounts`);
    const rows = await res.json();
    if (!res.ok) { showNotif('Error: ' + (rows.message || 'Unknown')); return; }
    accountsData = rows;
    renderAccountsTable();
  } catch { tbody.innerHTML = '<tr><td colspan="6" style="color:#ff4444;padding:20px;">Failed to load.</td></tr>'; }
}

function renderAccountsTable() {
  const tbody = document.getElementById('accounts-tbody');
  if (!accountsData.length) { tbody.innerHTML = '<tr><td colspan="7" style="color:var(--muted);padding:20px;">No accounts found.</td></tr>'; return; }
  tbody.innerHTML = accountsData.map(u => `
      <tr ${u.isBanned ? 'style="background:rgba(255,68,68,0.05);"' : ''}>
        <td>${u.username}${u.isBanned ? ' <span style="color:#ff8888;">🚫</span>' : ''}</td>
        <td style="font-family:'Share Tech Mono',monospace;"><span style="color:var(--muted);letter-spacing:2px;">•••••••• (hashed)</span></td>
        <td>${u.fullName}</td>
        <td>${u.role} (Lvl ${u.level})</td>
        <td>${u.Department || '—'}</td>
        <td style="color:#00e5c8;">${peso(u.wallet)}</td>
        <td><button class="teal-btn" onclick="startResetPassword('${u.username}')">Reset</button></td>
      </tr>`).join('');
}

// Kicks off a PIN-gated password reset for one account. Passwords are hashed
// server-side, so there's nothing to "reveal" — this issues a fresh one-time
// password instead, same as when a new employee account is auto-created.
function startResetPassword(username) {
  resetPasswordTarget = username;
  const me = accountsData.find(u => u.username === currentUser.username);
  if (me && !me.hasPin) {
    openSetPinModal();
  } else {
    openVerifyPinModal();
  }
}

// ─── SET PIN MODAL ───────────────────────────────────────────────────────────
function openSetPinModal() {
  document.getElementById('set-pin-current').value = '';
  document.getElementById('set-pin-new').value      = '';
  document.getElementById('set-pin-confirm').value  = '';
  document.getElementById('set-pin-error').textContent = '';
  const me = accountsData.find(u => u.username === currentUser.username);
  document.getElementById('set-pin-current-row').style.display = (me && me.hasPin) ? 'flex' : 'none';
  document.getElementById('set-pin-modal').style.display = 'flex';
}
function closeSetPinModal() { document.getElementById('set-pin-modal').style.display = 'none'; }

async function submitSetPin() {
  const currentPin = document.getElementById('set-pin-current').value.trim();
  const newPin     = document.getElementById('set-pin-new').value.trim();
  const confirmPin = document.getElementById('set-pin-confirm').value.trim();
  const errEl      = document.getElementById('set-pin-error');
  if (!/^\d{4,8}$/.test(newPin)) { errEl.textContent = '⚠ PIN must be 4-8 digits'; return; }
  if (newPin !== confirmPin)     { errEl.textContent = '⚠ PINs do not match';       return; }
  try {
    const res  = await authFetch(`${API}/accounts/set-pin`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser.username, pin: newPin, currentPin: currentPin || undefined }),
    });
    const data = await res.json();
    if (res.ok) {
      showNotif('✓ PIN saved');
      closeSetPinModal();
      await renderAccounts();
    } else { errEl.textContent = '⚠ ' + (data.message || 'Failed'); }
  } catch { errEl.textContent = '⚠ Server offline'; }
}

// ─── VERIFY PIN MODAL (to reset a password) ─────────────────────────────────
function openVerifyPinModal() {
  document.getElementById('verify-pin-input').value = '';
  document.getElementById('verify-pin-error').textContent = '';
  const targetEl = document.getElementById('verify-pin-target');
  if (targetEl) targetEl.textContent = resetPasswordTarget ? `Resetting password for: ${resetPasswordTarget}` : '';
  document.getElementById('verify-pin-modal').style.display = 'flex';
}
function closeVerifyPinModal() { document.getElementById('verify-pin-modal').style.display = 'none'; }

async function submitVerifyPin() {
  const pin   = document.getElementById('verify-pin-input').value.trim();
  const errEl = document.getElementById('verify-pin-error');
  if (!pin)               { errEl.textContent = '⚠ Enter your PIN'; return; }
  if (!resetPasswordTarget) { errEl.textContent = '⚠ No account selected'; return; }
  try {
    const res  = await authFetch(`${API}/accounts/reset-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUsername: currentUser.username, username: resetPasswordTarget, pin }),
    });
    const data = await res.json();
    if (res.ok) {
      closeVerifyPinModal();
      alert(`New password for ${data.username}:\n\n${data.password}\n\nShare this with them — it won't be shown again.`);
      resetPasswordTarget = null;
    } else { errEl.textContent = '⚠ ' + (data.message || 'Incorrect PIN'); }
  } catch { errEl.textContent = '⚠ Server offline'; }
}

async function renderWallets() {
  if (!currentUser) return;
  const isAdmin    = currentUser.level >= CLEARANCE.ADMIN;
  const tbody      = document.getElementById('wallets-tbody');
  const manageHdr  = document.getElementById('wallets-manage-header');
  const titleEl    = document.getElementById('wallets-page-title');
  const subtitleEl = document.getElementById('wallets-page-subtitle');

  if (manageHdr)  manageHdr.style.display  = isAdmin ? '' : 'none';
  if (titleEl)    titleEl.textContent       = isAdmin ? 'User Wallets' : 'My Wallet';
  if (subtitleEl) subtitleEl.textContent    = isAdmin
    ? 'Manage funds for any user account.'
    : 'Your current balance. Use Cash In / Cash Out to add or withdraw funds.';

  tbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted);padding:20px;">Loading…</td></tr>';

  if (isAdmin) {
    try {
      const res  = await authFetch(`${API}/wallets`);
      const rows = await res.json();
      if (!rows.length) { tbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted);padding:20px;">No users found.</td></tr>'; return; }
      tbody.innerHTML = rows.map(u => `
        <tr>
          <td>${u.username}</td>
          <td>${u.fullName}</td>
          <td>${ROLE_LABELS[u.level] || u.role}</td>
          <td style="color:#00e5c8;font-weight:600;">${peso(u.wallet)}</td>
          <td><button class="teal-btn" onclick="openWalletModal('${u.username}', '${u.fullName}', ${u.wallet})">Manage</button></td>
        </tr>`).join('');
    } catch { tbody.innerHTML = '<tr><td colspan="5" style="color:#ff4444;padding:20px;">Failed to load.</td></tr>'; }
  } else {
    try {
      const res  = await authFetch(`${API}/wallet/${currentUser.username}`);
      const data = await res.json();
      const bal  = parseFloat(data.balance ?? currentUser.wallet ?? 0);
      currentUser.wallet = bal;
      tbody.innerHTML = `
        <tr>
          <td>${currentUser.username}</td>
          <td>${currentUser.fullName}</td>
          <td>${ROLE_LABELS[currentUser.level] || currentUser.role}</td>
          <td style="color:#00e5c8;font-weight:600;font-size:20px;">${peso(bal)}</td>
          <td></td>
        </tr>`;
      const profWallet = document.getElementById('profile-wallet');
      if (profWallet) profWallet.textContent = peso(bal);
    } catch { tbody.innerHTML = '<tr><td colspan="5" style="color:#ff4444;padding:20px;">Failed to load wallet.</td></tr>'; }
  }
}

function openWalletModal(username, fullName, balance) {
  walletTarget = { username, fullName, balance };
  document.getElementById('wallet-modal-user').textContent = fullName + ' (@' + username + ')';
  document.getElementById('wallet-modal-bal').textContent  = 'Balance: ' + peso(balance);
  document.getElementById('wallet-amount').value   = '';
  document.getElementById('wallet-note').value     = '';
  document.getElementById('wallet-method').value   = 'bank';
  document.getElementById('wallet-modal').style.display = 'flex';
}

function closeWalletModal() {
  document.getElementById('wallet-modal').style.display = 'none';
  walletTarget = null;
}

// Admin-side add/deduct (manual adjustment)
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

// ─── SELF-SERVICE WALLET (Cash In / Cash Out) ─────────────────────────────────
const PAYMENT_METHODS = [
  { value: 'bank_metrobank',  label: 'Metrobank' },
  { value: 'bank_bdo',        label: 'BDO' },
  { value: 'bank_bpi',        label: 'BPI' },
  { value: 'bank_landbank',   label: 'Landbank' },
  { value: 'bank_unionbank',  label: 'UnionBank' },
  { value: 'ewallet_gcash',   label: 'GCash' },
  { value: 'ewallet_maya',    label: 'Maya' },
  { value: 'ewallet_shopeepay', label: 'ShopeePay' },
  { value: 'ewallet_grabpay', label: 'GrabPay' },
];

function openCashModal(type) {
  // type = 'in' or 'out'
  document.getElementById('cash-modal-title').textContent  = type === 'in' ? '💳 Cash In' : '💸 Cash Out';
  document.getElementById('cash-modal-type').value         = type;
  document.getElementById('cash-modal-amount').value       = '';
  document.getElementById('cash-modal-error').textContent  = '';
  document.getElementById('cash-modal-balance').textContent = 'Current balance: ' + peso(currentUser?.wallet ?? 0);

  // Populate payment methods
  const methodSelect = document.getElementById('cash-modal-method');
  methodSelect.innerHTML = PAYMENT_METHODS.map(m =>
    `<option value="${m.value}">${m.value.startsWith('bank') ? '🏦 ' : '📱 '}${m.label}</option>`
  ).join('');

  document.getElementById('cash-modal').style.display = 'flex';
}

function closeCashModal() {
  document.getElementById('cash-modal').style.display = 'none';
}

async function submitCash() {
  const type   = document.getElementById('cash-modal-type').value;
  const amount = parseFloat(document.getElementById('cash-modal-amount').value);
  const method = document.getElementById('cash-modal-method').value;
  const errEl  = document.getElementById('cash-modal-error');

  if (!amount || amount <= 0)  { errEl.textContent = '⚠ Enter a valid amount'; return; }
  if (amount > 50000)          { errEl.textContent = '⚠ Maximum single transaction: ₱50,000'; return; }

  const endpoint = type === 'in' ? '/wallet/cashin' : '/wallet/cashout';
  const methodLabel = PAYMENT_METHODS.find(m => m.value === method)?.label || method;

  try {
    const res  = await authFetch(`${API}${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: currentUser.username, amount, method,
        note: `${type === 'in' ? 'Cash in' : 'Cash out'} via ${methodLabel}`,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      currentUser.wallet = data.newBalance;
      showNotif(`✓ ${type === 'in' ? 'Cash in' : 'Cash out'} of ${peso(amount)} via ${methodLabel} — Balance: ${peso(data.newBalance)}`);
      closeCashModal();
      renderWallets(); // refresh the wallet page
    } else { errEl.textContent = '⚠ ' + (data.message || 'Failed'); }
  } catch { errEl.textContent = '⚠ Server offline'; }
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
  const modeVars = getComputedStyle(document.documentElement);
  const t1 = modeVars.getPropertyValue('--topbar-1').trim() || '#000';
  const t2 = modeVars.getPropertyValue('--topbar-2').trim() || '#0a0a20';
  topbar.style.background = `linear-gradient(90deg, ${t1} 0%, ${t2} 40%, ${DEPT_COLORS[name] || color} 100%)`;
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

// Drives the red banner at the top of the dashboard, above the icon buttons,
// for anything due today or already overdue — separate from (and louder than)
// the regular bell notification, since this is meant to be impossible to miss.
function updateDueTodayBanner(dueItems) {
  const banner = document.getElementById('due-today-banner');
  const textEl = document.getElementById('due-today-text');
  if (!banner || !textEl) return;
  if (!dueItems.length) { banner.style.display = 'none'; return; }

  const overdue = dueItems.filter(r => r.overdue);
  const dueToday = dueItems.filter(r => !r.overdue);
  let msg;
  if (overdue.length && dueToday.length) {
    msg = `You have ${dueToday.length} asset(s) due today and ${overdue.length} overdue — please return them.`;
  } else if (overdue.length) {
    msg = `You have ${overdue.length} overdue asset(s) — please return ${overdue.length > 1 ? 'them' : 'it'} now.`;
  } else {
    msg = `You have ${dueToday.length} asset(s) due for return today — please return ${dueToday.length > 1 ? 'them' : 'it'}.`;
  }
  textEl.textContent = msg;
  banner.style.display = 'flex';
}

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
// Pulls together everything the current user should be alerted about:
//  • their own borrowed assets that are due soon / overdue for return
//  • (Maintenance+) assets sitting in "In Service" awaiting repair
//  • (Admin) pending account requests
//  • (everyone else) their own account requests that Admin just resolved
async function refreshNotifications() {
  if (!currentUser) { currentNotifications = []; updateAllNotifBadges(); updateDueTodayBanner([]); return; }
  const items = [];
  const now = new Date();

  // Returns due / overdue — only the ones borrowed by the logged-in user
  const dueTodayOrOverdue = [];
  try {
    const res = await fetch(`${API}/borrows/active`);
    if (res.ok) {
      const rows = await res.json();
      rows.filter(r => r.BorrowedBy === currentUser.username && r.DueDate).forEach(r => {
        const due = new Date(r.DueDate);
        const daysLeft = Math.ceil((due - now) / 86400000);
        if (daysLeft < 0) {
          items.push({ icon: '⚠', text: `${r.Brand} ${r.Model} is OVERDUE for return (was due ${due.toLocaleDateString()})`, page: 'returns' });
          dueTodayOrOverdue.push({ ...r, overdue: true });
        } else if (daysLeft <= 2) {
          items.push({ icon: '⏰', text: `${r.Brand} ${r.Model} return is due ${due.toLocaleDateString()}`, page: 'returns' });
          if (daysLeft === 0) dueTodayOrOverdue.push({ ...r, overdue: false });
        }
      });
    }
  } catch { /* server offline — skip silently */ }
  updateDueTodayBanner(dueTodayOrOverdue);

  // Assets awaiting repair (Maintenance clearance or above)
  if (currentUser.level >= CLEARANCE.IT) {
    const pending = (assets || []).filter(a => a.status === 'service');
    if (pending.length) {
      items.push({ icon: '🛠', text: `${pending.length} asset${pending.length > 1 ? 's' : ''} awaiting repair`, page: 'maintenance' });
    }
  }

  // Account requests
  if (currentUser.level >= CLEARANCE.ADMIN) {
    try {
      const res = await authFetch(`${API}/account-requests`);
      if (res.ok) {
        const rows = await res.json();
        const pendingCount = rows.filter(r => r.status === 'pending').length;
        if (pendingCount) items.push({ icon: '📥', text: `${pendingCount} pending account request${pendingCount > 1 ? 's' : ''} to review`, page: 'account-requests' });
      }
    } catch { /* server offline */ }
  } else {
    try {
      const res = await fetch(`${API}/account-requests/mine/${encodeURIComponent(currentUser.username)}`);
      if (res.ok) {
        const rows = await res.json();
        const seenKey  = `reqSeen_${currentUser.username}`;
        const lastSeen = localStorage.getItem(seenKey) || '1970-01-01T00:00:00.000Z';
        rows.filter(r => r.status !== 'pending' && r.ResolvedAt && r.ResolvedAt > lastSeen).forEach(r => {
          items.push({
            icon: r.status === 'approved' ? '✅' : '❌',
            text: `Your ${r.type} request was ${r.status}`,
            page: 'profile',
          });
        });
      }
    } catch { /* server offline */ }
  }

  currentNotifications = items;
  updateAllNotifBadges();
  renderNotifPanel();
}

function updateAllNotifBadges() {
  const count = currentNotifications.length;
  document.querySelectorAll('.notif-badge').forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? 'flex' : 'none';
  });
}

function renderNotifPanel() {
  const list = document.getElementById('notif-panel-list');
  if (!list) return;
  if (!currentNotifications.length) {
    list.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted);font-family:'Share Tech Mono',monospace;font-size:12px;">No new notifications</div>`;
    return;
  }
  list.innerHTML = currentNotifications.map(n => `
    <div onclick="handleNotifClick('${n.page}')" style="display:flex;gap:10px;align-items:flex-start;padding:12px 10px;border-radius:8px;cursor:pointer;font-family:'Share Tech Mono',monospace;font-size:12px;color:#e0fff8;" onmouseover="this.style.background='rgba(0,229,200,0.08)'" onmouseout="this.style.background='transparent'">
      <span style="font-size:16px;">${n.icon}</span>
      <span style="flex:1;line-height:1.4;">${n.text}</span>
    </div>
  `).join('');
}

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  const isOpen = panel.style.display === 'block';
  if (isOpen) { panel.style.display = 'none'; return; }
  refreshNotifications();
  panel.style.display = 'block';
  // Mark any account-request updates as "seen" now that the panel was opened
  if (currentUser && currentUser.level < CLEARANCE.ADMIN) {
    localStorage.setItem(`reqSeen_${currentUser.username}`, new Date().toISOString());
  }
}

function handleNotifClick(page) {
  document.getElementById('notif-panel').style.display = 'none';
  if (page) nav(page);
}

document.addEventListener('click', (e) => {
  const panel = document.getElementById('notif-panel');
  if (!panel || panel.style.display !== 'block') return;
  if (panel.contains(e.target) || e.target.closest('.notif-btn')) return;
  panel.style.display = 'none';
});

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