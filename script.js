/* ════════════════════════════════════════════════════════════════
   GameChanger — HR Calabarzon
   script.js — all behavior lives here.

   HOW THE 3 FILES CONNECT
   ────────────────────────
   index.html  <link rel="stylesheet" href="style.css">   (styling)
   index.html  <script src="script.js"></script>          (this file)
   Every onclick="..." attribute in index.html calls a function
   defined in this file. Every id="..." referenced below with
   document.getElementById(...) must exist in index.html.

   ════════════════════════════════════════════════════════════════
   🔌 BACKEND / DATABASE INTEGRATION — READ ME FIRST
   ════════════════════════════════════════════════════════════════
   This file currently runs entirely on DUMMY DATA (the objects/arrays
   in the "DUMMY DATA" section below) so the whole app works offline,
   with no server. To connect a real backend + database:

   1. Create an API layer (e.g. a small Express/Django/Laravel app,
      or Firebase/Supabase) that exposes REST or GraphQL endpoints.
   2. Replace the dummy arrays with fetch() calls to that API.
      Search this file for "BACKEND HOOK" — every one marks an
      exact spot where a fetch() call should replace dummy logic.
   3. Typical endpoints this UI would need:
        POST   /api/auth/login              { credential, password }
        POST   /api/auth/logout
        GET    /api/members                 (paginated list)
        POST   /api/members                 (add member)
        GET    /api/members/:id
        GET    /api/sessions                (upcoming/past/draft)
        POST   /api/sessions                (create session)
        PUT    /api/sessions/:id            (edit session)
        DELETE /api/sessions/:id            (cancel session)
        POST   /api/sessions/:id/attendance-csv   (multipart upload)
        POST   /api/sessions/:id/certificates     (generate certs)
        GET    /api/members/:id/certificates
        GET    /api/payments
        POST   /api/payments/:id/mark-paid
        POST   /api/payments/:id/waive
        POST   /api/chatbot                 { message, role }
        GET    /api/stats/overview          (member/province counts)
   4. A minimal fetch() example (see also apiRequest() helper below):

        async function apiLogin(credential, password) {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential, password })
          });
          if (!res.ok) throw new Error('Login failed');
          return res.json(); // { token, role, user }
        }

   5. Swap localStorage-free in-memory arrays (membersData,
      sessionsData, paymentsData, certData) for data fetched on
      page load, and re-render the relevant table/grid after every
      create/update/delete instead of mutating the array directly.
   ════════════════════════════════════════════════════════════════ */


// ════════════════════════════════════════════════
// GENERIC API HELPER (currently unused by default —
// wire it up once a real backend exists)
// ════════════════════════════════════════════════
const API_BASE_URL = '/api'; // BACKEND HOOK: point this at your real API host

async function apiRequest(path, options = {}) {
  // BACKEND HOOK: this is the single place to add auth headers,
  // e.g. 'Authorization': `Bearer ${authToken}`
  const res = await fetch(API_BASE_URL + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) throw new Error(`API error ${res.status} on ${path}`);
  return res.json();
}


// ════════════════════════════════════════════════
// DUMMY DATA
// Replace each of these with data loaded from your
// backend (see BACKEND HOOK comments near each use).
// ════════════════════════════════════════════════

// Login credentials for the demo. In production, authentication
// happens on the server — never ship real passwords to the client.
const DUMMY_USERS = {
  members: [
    { credential: 'maria@hrcalabarzon.ph', password: 'password123', id: 'HRC-2024-0847', name: 'Maria Santos', initials: 'MS' }
  ],
  admins: [
    { credential: 'ADM-2025-0001', password: 'password123', id: 'ADM-2025-0001', name: 'Juan Dela Cruz', initials: 'JD' }
  ]
};

const statsData = { members: '17k+', provinces: 5, tracks: 7 };

// BACKEND HOOK: GET /api/members?page=1&pageSize=20
let membersData = [
  { name:'Maria Santos', initials:'MS', color:'blue', id:'HRC-2024-0847', province:'Cavite', expertise:'Recruitment', expertiseBadge:'bg-t', level:'Entry', levelBadge:'bg-y', attendance:72, certs:4, status:'Active' },
  { name:'Jose Padilla', initials:'JP', color:'green', id:'HRC-2024-0612', province:'Laguna', expertise:'Compliance', expertiseBadge:'bg-b', level:'Mid', levelBadge:'bg-b', attendance:88, certs:9, status:'Active' },
  { name:'Ana Lim', initials:'AL', color:'red', id:'HRC-2023-0204', province:'Batangas', expertise:'L&D', expertiseBadge:'bg-p', level:'Senior', levelBadge:'bg-r', attendance:95, certs:18, status:'Active' },
  { name:'Rico Cruz', initials:'RC', color:'yellow', id:'HRC-2024-1102', province:'Rizal', expertise:'HRIS', expertiseBadge:'bg-t', level:'Entry', levelBadge:'bg-y', attendance:60, certs:2, status:'Inactive' }
];

// BACKEND HOOK: GET /api/members/:id/certificates
const certData = [
  { title:'Digital Onboarding for HR Practitioners', short:'Digital Onboarding', date:'April 2, 2025', dateShort:'Apr 2, 2025', acc:'PHRCI Accredited', accShort:'PHRCI', bg:'linear-gradient(135deg,#1565C0,#0D47A1)', seal:'🏆' },
  { title:'DOLE Compliance Workshop 2025', short:'DOLE Compliance', date:'March 10, 2025', dateShort:'Mar 10, 2025', acc:'DOLE Accredited', accShort:'DOLE', bg:'linear-gradient(135deg,#B71C1C,#E53935)', seal:'🏅' },
  { title:'HR Tech Tools Demo Day', short:'HR Tech Tools', date:'February 22, 2025', dateShort:'Feb 22, 2025', acc:'TESDA Recognized', accShort:'TESDA', bg:'linear-gradient(135deg,#1B5E20,#2E7D32)', seal:'🎓' },
  { title:'Recruitment Basics Mastery 2024', short:'Recruitment Mastery', date:'December 5, 2024', dateShort:'Dec 5, 2024', acc:'PHRCI Accredited', accShort:'PHRCI', bg:'linear-gradient(135deg,#4A148C,#6A1B9A)', seal:'⭐' }
];

// BACKEND HOOK: GET /api/sessions?status=upcoming|past|draft
let sessionsData = { upcoming: 2, past: 22, draft: 1 };

// ════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════
let currentRole = 'member'; // auto-detected from credential format
let botOpen = false;
let countdown = 2*3600 + 34*60 + 15;
let loggedInUser = null;

// ════════════════════════════════════════════════
// TOAST — lightweight non-blocking notifications
// (used instead of alert() throughout this file)
// ════════════════════════════════════════════════
function showToast(msg, type = 'info', duration = 3200) {
  const wrap = document.getElementById('toast-wrap');
  if (!wrap) { console.log(`[${type}] ${msg}`); return; }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ════════════════════════════════════════════════
// LOGIN — smart credential detection
// Admin ID format:  ADM-YYYY-NNNN  (e.g. ADM-2025-0001)
// Member format:    email address  (e.g. name@domain.com)
// ════════════════════════════════════════════════
function isAdminId(val) {
  return /^ADM-\d{4}-\d{4}$/i.test(val.trim());
}

function detectCredential(val) {
  const credInput = document.getElementById('l-cred');
  const hintBox   = document.getElementById('cred-hint-box');
  const credLabel = document.getElementById('cred-label');
  const credHint  = document.getElementById('cred-hint');
  const passInput = document.getElementById('l-pass');
  const btn       = document.getElementById('login-btn');

  if (isAdminId(val)) {
    currentRole = 'admin';
    credInput.className = 'fi admin-mode';
    passInput.className = 'fi admin-mode';
    credLabel.textContent = 'Admin ID';
    credHint.innerHTML = '<span style="color:var(--red);font-weight:600;">🛡 Admin account detected</span> — format: ADM-YYYY-NNNN';
    hintBox.className = 'cred-hint-box admin-hint';
    hintBox.innerHTML = '<strong style="color:var(--red-d);">🛡 Admin Login</strong> — your Admin ID was recognized.<br><span style="color:var(--t2);">This will log you into the Admin Dashboard. If this is a mistake, clear the field and enter your email.</span>';
    btn.className = 'login-btn-base login-btn-admin';
    btn.textContent = 'Sign In to Admin Panel →';
  } else {
    currentRole = 'member';
    credInput.className = 'fi member-mode';
    passInput.className = 'fi member-mode';
    credLabel.textContent = 'Email Address';
    credHint.innerHTML = 'Enter your registered email address to sign in.';
    hintBox.className = 'cred-hint-box';
    hintBox.innerHTML = '<strong>Member login</strong> — use your registered email address.<br><span style="color:var(--t3);">e.g. yourname@hrcalabarzon.ph</span>';
    btn.className = 'login-btn-base login-btn-member';
    btn.textContent = 'Sign In →';
  }
}

function doLogin() {
  const cred = document.getElementById('l-cred').value.trim();
  const p    = document.getElementById('l-pass').value;
  const err  = document.getElementById('login-err');

  err.style.display = 'none';

  if (!cred || !p) {
    showLoginErr('Please enter your ' + (currentRole === 'admin' ? 'Admin ID' : 'email address') + ' and password.');
    return;
  }
  if (currentRole === 'member' && !cred.includes('@')) {
    showLoginErr('Please enter a valid email address. Admin IDs use the format ADM-YYYY-NNNN.');
    return;
  }
  if (currentRole === 'admin' && !isAdminId(cred)) {
    showLoginErr('Admin ID format is invalid. Expected format: ADM-YYYY-NNNN (e.g. ADM-2025-0001).');
    return;
  }

  const btn = document.getElementById('login-btn');
  const origText = btn.textContent;
  btn.textContent = 'Signing in...'; btn.disabled = true;

  // ──────────────────────────────────────────────
  // BACKEND HOOK: replace this whole block with a real login call:
  //
  //   apiRequest('/auth/login', {
  //     method: 'POST',
  //     body: JSON.stringify({ credential: cred, password: p })
  //   }).then(data => {
  //     authToken = data.token;      // store the session token
  //     loggedInUser = data.user;
  //     currentRole = data.role;     // 'member' | 'admin'
  //     enterApp();
  //   }).catch(() => showLoginErr('Invalid credentials.'));
  //
  // For now we just check the DUMMY_USERS table above.
  // ──────────────────────────────────────────────
  setTimeout(() => {
    btn.textContent = origText; btn.disabled = false;

    const pool = currentRole === 'admin' ? DUMMY_USERS.admins : DUMMY_USERS.members;
    const match = pool.find(u => u.credential.toLowerCase() === cred.toLowerCase() && u.password === p);

    if (!match) {
      showLoginErr('Incorrect credentials. Try the demo login shown below the form.');
      return;
    }

    loggedInUser = match;
    enterApp();
  }, 800);
}

function enterApp() {
  document.getElementById('login-page').style.display = 'none';
  if (currentRole === 'admin') {
    document.getElementById('admin-app').style.display = 'flex';
    document.getElementById('a-date').textContent = todayStr();
    setupAdminBot();
    renderMembersTable();
  } else {
    document.getElementById('member-app').style.display = 'flex';
    document.getElementById('m-today').textContent = todayStr();
    document.getElementById('m-welcome-name').textContent = `Hi, ${loggedInUser.name.split(' ')[0]}! 👋`;
    document.getElementById('m-user-name').textContent = loggedInUser.name;
    document.getElementById('m-user-id').textContent = loggedInUser.id;
    document.getElementById('m-user-av').textContent = loggedInUser.initials;
    setupMemberBot();
    startCountdown();
    renderMemberCerts();
  }
  showToast(`Welcome back, ${loggedInUser.name.split(' ')[0]}!`, 'success');
}

function showLoginErr(msg) {
  const el = document.getElementById('login-err');
  el.textContent = msg; el.style.display = 'block';
}

function switchToLogin() {
  document.getElementById('member-app').style.display = 'none';
  document.getElementById('admin-app').style.display = 'none';
  document.getElementById('register-page').style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
  botOpen = false;
  document.getElementById('bot-panel').classList.remove('open');
  loggedInUser = null;
  // BACKEND HOOK: also call POST /api/auth/logout and clear authToken here.

  currentRole = 'member';
  const credEl = document.getElementById('l-cred');
  if (credEl) { credEl.value = ''; credEl.className = 'fi member-mode'; }
  const passEl = document.getElementById('l-pass');
  if (passEl) { passEl.value = ''; passEl.className = 'fi member-mode'; }
  const hintBox = document.getElementById('cred-hint-box');
  if (hintBox) { hintBox.className = 'cred-hint-box'; hintBox.innerHTML = '<strong>Member login</strong> — use your registered email address.<br><span style="color:var(--t3);">e.g. yourname@hrcalabarzon.ph</span>'; }
  const btn = document.getElementById('login-btn');
  if (btn) { btn.className = 'login-btn-base login-btn-member'; btn.textContent = 'Sign In →'; }
  const err = document.getElementById('login-err');
  if (err) err.style.display = 'none';
}

function todayStr() {
  return new Date().toLocaleDateString('en-PH',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
}

function handleForgotPassword() {
  // BACKEND HOOK: POST /api/auth/forgot-password { email }
  showToast('Password reset link sent to your registered email.', 'success');
}
function handleLinkedInLogin() {
  // BACKEND HOOK: kick off OAuth flow, e.g. window.location = '/api/auth/linkedin'
  showToast('Redirecting to LinkedIn sign-in...', 'info');
}

// ════════════════════════════════════════════════
// REGISTRATION
// ════════════════════════════════════════════════
function showRegisterPage() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('register-page').style.display = 'flex';
  document.getElementById('register-err').style.display = 'none';
  window.scrollTo(0, 0);
}
function showLoginPage() {
  document.getElementById('register-page').style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
  window.scrollTo(0, 0);
}
function showRegisterErr(msg) {
  const el = document.getElementById('register-err');
  el.textContent = msg; el.style.display = 'block';
}
function handleRegister() {
  const fullName    = document.getElementById('r-fullname').value.trim();
  const email       = document.getElementById('r-email').value.trim();
  const pass        = document.getElementById('r-pass').value;
  const pass2       = document.getElementById('r-pass2').value;
  const province    = document.getElementById('r-province').value;
  const company     = document.getElementById('r-company').value.trim();
  const department  = document.getElementById('r-department').value.trim();
  const position    = document.getElementById('r-position').value.trim();

  document.getElementById('register-err').style.display = 'none';

  if (!fullName || !email || !pass || !pass2 || !province || !company || !department || !position) {
    showRegisterErr('Please fill in all fields.');
    return;
  }
  if (!email.includes('@')) {
    showRegisterErr('Please enter a valid email address.');
    return;
  }
  if (pass.length < 6) {
    showRegisterErr('Password must be at least 6 characters.');
    return;
  }
  if (pass !== pass2) {
    showRegisterErr('Passwords do not match.');
    return;
  }

  const btn = document.getElementById('register-btn');
  const origText = btn.textContent;
  btn.textContent = 'Creating account...'; btn.disabled = true;

  // ──────────────────────────────────────────────
  // BACKEND HOOK: replace this whole block with a real registration call:
  //
  //   apiRequest('/auth/register', {
  //     method: 'POST',
  //     body: JSON.stringify({ fullName, email, password: pass, province, company, department, position })
  //   }).then(() => {
  //     showLoginPage();
  //     showToast('Account created! Sign in to continue.', 'success');
  //   }).catch(() => showRegisterErr('Registration failed. Please try again.'));
  //
  // For now we just simulate a short delay and add the new account to the
  // in-memory DUMMY_USERS table so it could (in a real backend) be used to
  // log in immediately after.
  // ──────────────────────────────────────────────
  setTimeout(() => {
    btn.textContent = origText; btn.disabled = false;

    DUMMY_USERS.members.push({
      credential: email,
      password: pass,
      id: `HRC-2025-${String(1000 + DUMMY_USERS.members.length)}`,
      name: fullName,
      initials: fullName.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'ME'
    });

    ['r-fullname','r-email','r-pass','r-pass2','r-company','r-department','r-position'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('r-province').value = '';

    showLoginPage();
    showToast(`Account created! Sign in as ${fullName.split(' ')[0]} to continue.`, 'success', 4000);
  }, 900);
}

// ════════════════════════════════════════════════
// MEMBER NAVIGATION
// ════════════════════════════════════════════════
function mShowPage(p) {
  document.querySelectorAll('#member-app .page').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('#member-app .nav-item').forEach(x=>x.classList.remove('active'));
  document.getElementById('mp-'+p).classList.add('active');
  const n=document.getElementById('mn-'+p); if(n) n.classList.add('active');
  const t={home:'Dashboard',career:'Career Path',attendance:'Attendance & Sessions',certificates:'Certificates',profile:'My Profile'};
  document.getElementById('m-page-title').textContent = t[p]||p;
  window.scrollTo(0,0);
}

// ════════════════════════════════════════════════
// ADMIN NAVIGATION
// ════════════════════════════════════════════════
function aShowPage(p) {
  document.querySelectorAll('#admin-app .page').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('#admin-app .nav-item').forEach(x=>x.classList.remove('active'));
  document.getElementById('ap-'+p).classList.add('active');
  const n=document.getElementById('an-'+p); if(n) n.classList.add('active');
  const t={home:'Admin Dashboard',analytics:'AI Analytics',members:'Data Management',sessions:'Session Creation',attendance:'Attendance Management',payments:'Payment Management'};
  document.getElementById('a-page-title').textContent = t[p]||p;
  window.scrollTo(0,0);
}
function aSwitchTab(btn, panelId) {
  btn.closest('.pill-tabs').querySelectorAll('.pt').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.apanel').forEach(p=>{
    p.classList.toggle('active', p.id===panelId);
  });
}

// ════════════════════════════════════════════════
// MODALS
// ════════════════════════════════════════════════
function openMo(id){ document.getElementById(id).classList.add('open'); }
function closeMo(id){ document.getElementById(id).classList.remove('open'); }
document.addEventListener('click', e => {
  if(e.target.classList.contains('mo')) e.target.classList.remove('open');
  if(e.target.id==='m-cert-detail') e.target.classList.remove('open');
});

// ════════════════════════════════════════════════
// MEMBER: render certificates grid from certData
// ════════════════════════════════════════════════
function renderMemberCerts() {
  const grid = document.getElementById('m-cert-grid');
  if (!grid) return;
  grid.innerHTML = certData.map((c, i) => `
    <div class="card m-cc" onclick="openMCert(${i})">
      <div class="m-cthumb" style="background:${c.bg};">
        <div class="m-cthi">
          <div style="font-size:26px;margin-bottom:5px;">${c.seal}</div>
          <div class="m-ctit">${c.title}</div>
        </div>
      </div>
      <div class="m-cbody">
        <h4>${c.short}</h4>
        <p>${c.dateShort} · ${c.accShort}</p>
        <div class="vbadge">✅ Verified</div>
      </div>
    </div>
  `).join('');
}

function openMCert(i) {
  const c=certData[i];
  document.getElementById('m-cd-prev').style.background=c.bg;
  document.getElementById('m-cd-seal').textContent=c.seal;
  document.getElementById('m-cd-title').textContent=c.title;
  document.getElementById('m-cd-meta').textContent=c.title;
  document.getElementById('m-cd-date').textContent=c.date;
  document.getElementById('m-cd-acc').textContent=c.acc;
  document.getElementById('m-cert-detail').classList.add('open');
}
function handleDownloadCert() {
  // BACKEND HOOK: GET /api/certificates/:id/download (returns a PDF stream)
  showToast('📥 Downloading certificate PDF...', 'info');
}
function handleShareLinkedIn() {
  // BACKEND HOOK: open LinkedIn's share intent URL with the cert's public link
  showToast('🔗 Opening LinkedIn share dialog...', 'info');
}
function claimCertificate(btn) {
  // BACKEND HOOK: POST /api/certificates/claim { sessionId }
  btn.outerHTML = '<span class="badge bg-g">✓ Claimed</span>';
  showToast('Certificate claimed! Check the Certificates page.', 'success');
}

// ════════════════════════════════════════════════
// MEMBER: skill tree node modal + filters
// ════════════════════════════════════════════════
function openNodeMo(state, title, desc, date) {
  const icons={done:'✅',active:'🟡',locked:'🔒'};
  document.getElementById('m-ni-icon').textContent=icons[state];
  document.getElementById('m-ni-title').textContent=title;
  document.getElementById('m-ni-body').textContent=desc;
  const btn=document.getElementById('m-ni-btn');
  const prog=document.getElementById('m-ni-prog');
  if(state==='locked'){
    prog.innerHTML='<div class="prog"><div class="prog-f" style="width:72%;background:var(--red);"></div></div><div style="font-size:12px;color:var(--t3);margin-top:5px;">72% · Need 80% to unlock</div>';
    btn.textContent='Find Sessions to Unlock';
    btn.onclick=()=>{closeMo('m-node-modal');mShowPage('attendance');};
  } else if(state==='done'){
    prog.innerHTML=`<div style="font-size:12px;color:var(--green);font-weight:600;">✅ Completed on ${date}</div>`;
    btn.textContent='View Certificate';
    btn.onclick=()=>{closeMo('m-node-modal');mShowPage('certificates');};
  } else {
    prog.innerHTML='<div class="prog"><div class="prog-f" style="width:72%;background:var(--yellow);"></div></div><div style="font-size:12px;color:var(--t3);margin-top:5px;">72% · 2 more sessions needed</div>';
    btn.textContent='Join Next Session';
    btn.onclick=()=>{closeMo('m-node-modal');mShowPage('attendance');};
  }
  openMo('m-node-modal');
}
function filterSkillTree(chip, area) {
  chip.closest('.m-tf').querySelectorAll('.fchip').forEach(c=>c.classList.remove('active'));
  chip.classList.add('active');
  // BACKEND HOOK: GET /api/members/:id/skill-tree?area=<area> and re-render the SVG nodes.
  showToast(area === 'all' ? 'Showing all skill tree areas.' : `Filtered to ${area}.`, 'info', 1800);
}
function unlockNextNode() {
  // BACKEND HOOK: POST /api/members/:id/skill-tree/unlock
  triggerConfetti();
  showToast("🎉 You've reached 80%! L&D node is now UNLOCKED!", 'success', 4000);
}

// ════════════════════════════════════════════════
// MEMBER: sessions / registration / search
// ════════════════════════════════════════════════
function registerForSession(btn, title) {
  // BACKEND HOOK: POST /api/sessions/:id/register
  btn.outerHTML = '<span class="badge bg-g" style="margin-top:7px;">✓ Registered</span>';
  showToast(`Registered for "${title}"!`, 'success');
}
function handleJoinSession() {
  // BACKEND HOOK: this would redirect to the real Zoom URL and log a join event:
  //   POST /api/sessions/:id/join
  showToast('Joining session...', 'info');
  closeMo('m-join-modal');
}
function handleFullRankings() {
  // BACKEND HOOK: navigate to a full rankings page backed by GET /api/analytics/rankings
  showToast('Opening full province rankings...', 'info');
}
function handleMemberSearch(query) {
  if (!query.trim()) return;
  // BACKEND HOOK: GET /api/sessions/search?q=<query>
  showToast(`Searching sessions for "${query}"...`, 'info');
}
function handleSettings() {
  // BACKEND HOOK: navigate to a settings page / open a settings modal
  showToast('Opening settings — notifications, privacy, preferences.', 'info');
}
function handleEditProfile() {
  // BACKEND HOOK: PUT /api/members/:id
  showToast('Opening profile editor...', 'info');
}
function toggleNotifications(role) {
  // BACKEND HOOK: GET /api/notifications?role=<role>
  if (role === 'member') showToast('3 session reminders, 1 certificate ready!', 'info');
  else showToast('3 pending CSVs · 2 payment reviews · 1 submission awaiting.', 'info');
}
function handleExport(what) {
  // BACKEND HOOK: GET /api/export?type=<what> (returns a file download)
  showToast(`Exporting ${what}...`, 'info');
}

// ════════════════════════════════════════════════
// COUNTDOWN (shared timer for the next live session)
// ════════════════════════════════════════════════
function startCountdown() {
  setInterval(()=>{
    if(countdown<=0){
      ['m-join-home','m-join-att'].forEach(id=>{
        const el=document.getElementById(id); if(!el)return;
        el.className='btn btn-red btn-sm'; el.textContent='🔴 Join Now — LIVE!';
      }); return;
    }
    countdown--;
    const h=Math.floor(countdown/3600),m=Math.floor((countdown%3600)/60),s=countdown%60;
    const f=n=>String(n).padStart(2,'0');
    [['m-hh','m-ah'],['m-hm','m-am'],['m-hs','m-as']].forEach(([id1,id2],i)=>{
      const v=f([h,m,s][i]);
      [id1,id2].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=v;});
    });
  },1000);
}

// ════════════════════════════════════════════════
// ADMIN: members table (rendered from membersData)
// ════════════════════════════════════════════════
const initialsColor = { blue:'var(--blue-l)|var(--blue)', green:'var(--green-l)|var(--green)', red:'var(--red-l)|var(--red)', yellow:'var(--yellow-l)|#B45309' };
function renderMembersTable() {
  const tbody = document.getElementById('a-members-tbody');
  if (!tbody) return;
  tbody.innerHTML = membersData.map((m, i) => {
    const [bg, fg] = (initialsColor[m.color] || initialsColor.blue).split('|');
    return `
    <tr>
      <td><div style="display:flex;align-items:center;gap:7px;"><div style="width:28px;height:28px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:${fg};">${m.initials}</div><div class="nc">${m.name}</div></div></td>
      <td style="color:var(--t3);font-size:12px;">${m.id}</td>
      <td>${m.province}</td>
      <td><span class="badge ${m.expertiseBadge}">${m.expertise}</span></td>
      <td><span class="badge ${m.levelBadge}">${m.level}</span></td>
      <td><div style="display:flex;align-items:center;gap:7px;"><div class="prog" style="width:55px;"><div class="prog-f" style="width:${m.attendance}%;background:${m.attendance>=80?'var(--green)':m.attendance>=70?'var(--red)':'var(--yellow)'};"></div></div><span style="font-size:12px;">${m.attendance}%</span></div></td>
      <td>${m.certs}</td>
      <td><span class="badge ${m.status==='Active'?'bg-g':'bg-gr'}">${m.status}</span></td>
      <td><button class="btn btn-xs btn-ghost" onclick="handleViewMember(${i})">View</button></td>
    </tr>`;
  }).join('');
}
function handleViewMember(i) {
  // BACKEND HOOK: GET /api/members/:id (open a full profile drawer/modal)
  const m = membersData[i];
  showToast(`Viewing ${m.name} — ${m.id}`, 'info');
}
function handleAddMember() {
  // BACKEND HOOK: POST /api/members — open a real "add member" form/modal.
  // Demo: push a placeholder row so the table visibly updates.
  membersData.push({ name:'New Member', initials:'NM', color:'blue', id:`HRC-2025-${String(1000+membersData.length)}`, province:'Cavite', expertise:'Recruitment', expertiseBadge:'bg-t', level:'Entry', levelBadge:'bg-y', attendance:0, certs:0, status:'Active' });
  renderMembersTable();
  showToast('New member added (demo row) — wire this to POST /api/members.', 'success');
}
function handlePagination(dir) {
  // BACKEND HOOK: GET /api/members?page=<n> and re-render renderMembersTable()
  showToast(dir > 0 ? 'Loading next page...' : 'Loading previous page...', 'info');
}
function handleAdminSearch(query) {
  if (!query.trim()) return;
  // BACKEND HOOK: GET /api/members/search?q=<query> or /api/sessions/search?q=<query>
  showToast(`Searching for "${query}"...`, 'info');
}
function handleAdminSettings() {
  // BACKEND HOOK: navigate to admin settings — permissions, API keys, notifications
  showToast('Opening admin settings — permissions, API keys, notifications.', 'info');
}

// ════════════════════════════════════════════════
// ADMIN: session creation / editing
// ════════════════════════════════════════════════
function saveSessionDraft() {
  // BACKEND HOOK: POST /api/sessions { status: 'draft', ... }
  sessionsData.draft++;
  showToast('Session saved as draft.', 'success');
  closeMo('a-create-session');
}
function publishSession() {
  const title = document.getElementById('acs-title')?.value.trim();
  // BACKEND HOOK: POST /api/sessions { status: 'published', ... }
  sessionsData.upcoming++;
  showToast(title ? `"${title}" published! Members can now see it.` : 'Session published! Members can now see it.', 'success');
  closeMo('a-create-session');
}
function saveSessionChanges() {
  // BACKEND HOOK: PUT /api/sessions/:id  → then trigger email notifications server-side
  showToast('Session updated. Members notified.', 'success');
  closeMo('a-edit-session');
}
function handleCancelSession(btn, title) {
  if (!confirm(`Cancel "${title}"? Registered members will be notified.`)) return;
  // BACKEND HOOK: DELETE /api/sessions/:id
  const card = btn.closest('.card');
  card.style.opacity = '0.4';
  card.style.pointerEvents = 'none';
  showToast(`"${title}" cancelled. Registrants notified.`, 'error');
}
function handleDeleteDraft(btn) {
  if (!confirm('Delete this draft? This cannot be undone.')) return;
  // BACKEND HOOK: DELETE /api/sessions/:id
  btn.closest('.card').remove();
  showToast('Draft deleted.', 'error');
}
function copyZoomLink(url) {
  navigator.clipboard?.writeText(url).catch(()=>{});
  showToast('Zoom link copied to clipboard.', 'success', 1800);
}

// ════════════════════════════════════════════════
// ADMIN: Zoom attendance sync / certificate generation
// (Attendance no longer comes from a manual CSV upload —
// it's pulled directly from the Zoom API.)
// ════════════════════════════════════════════════
function aSimZoomSync() {
  // BACKEND HOOK: replace this simulated delay with a real call to your
  // server, which in turn calls the Zoom API (e.g. the "Meeting/Webinar
  // Participant Reports" endpoint) for the selected session:
  //
  //   const sessionId = document.getElementById('a-sync-session').value;
  //   const res = await fetch(`/api/sessions/${sessionId}/sync-zoom-attendance`, { method: 'POST' });
  //   const result = await res.json(); // { attendees, qualified, belowThreshold }
  //   ...render result...
  //
  const btn = document.getElementById('a-sync-btn');
  const origText = btn.textContent;
  btn.textContent = '⏳ Syncing...'; btn.disabled = true;
  setTimeout(()=>{
    btn.textContent = origText; btn.disabled = false;
    document.getElementById('a-sync-res').classList.add('show');
    showToast('Attendance synced from Zoom.', 'success');
  },1200);
}
function handleGenerateCertificates(count) {
  // BACKEND HOOK: POST /api/sessions/:id/certificates { autoEmail: true }
  showToast(`🎉 Generating ${count} certificates... Members will be emailed automatically.`, 'success', 4000);
}
function handleDownloadAllZip() {
  // BACKEND HOOK: GET /api/certificates/export?format=zip
  showToast('Downloading all certificates as ZIP...', 'info');
}
function handleBulkSend() {
  // BACKEND HOOK: POST /api/certificates/bulk-send
  showToast('Bulk emailing certificates...', 'success');
}
function handlePendingCert() {
  showToast('DOLE Compliance — sync attendance from Zoom first to generate certificates.', 'info');
}
function handleResendCert(name) {
  // BACKEND HOOK: POST /api/certificates/:id/resend
  showToast(`Resending certificate email to ${name}...`, 'success');
}
function handleOverrideCert(btn, name) {
  if (!confirm(`Force-issue a certificate for ${name} even though they're below threshold? This will be logged.`)) return;
  // BACKEND HOOK: POST /api/certificates/override { memberName, reason }
  btn.outerHTML = '<span class="badge bg-y">⚠ Overridden</span>';
  showToast(`Certificate override logged for ${name}.`, 'info');
}

// ════════════════════════════════════════════════
// ADMIN: payments — VIEW ONLY.
// Payment status is confirmed automatically by the HitPay webhook
// (see US-3.1), so there's no manual Mark Paid / Waive action here —
// the admin just opens a read-only Payment Details modal.
// BACKEND HOOK: the row data below is currently inline in index.html;
// swap it for GET /api/payments and pass the fetched record straight
// into openPaymentDetail(). The actual status change happens server-side
// at POST /api/payments/hitpay-webhook, not from this UI.
// ════════════════════════════════════════════════
const paymentStatusBadge = {
  paid:    '<span class="badge bg-g">✓ Paid</span>',
  pending: '<span class="badge bg-y">⏳ Pending</span>',
  waived:  '<span class="badge bg-p">🎁 Waived</span>'
};
function openPaymentDetail(status, member, session, amount, method, date, extra) {
  document.getElementById('apd-member').textContent  = member;
  document.getElementById('apd-session').textContent = session;
  document.getElementById('apd-amount').textContent  = amount;
  document.getElementById('apd-method').textContent  = method;
  document.getElementById('apd-date').textContent    = date;
  document.getElementById('apd-status').innerHTML    = paymentStatusBadge[status] || status;

  const extraRow   = document.getElementById('apd-extra-row');
  const extraLabel = document.getElementById('apd-extra-label');
  const extraVal   = document.getElementById('apd-extra');
  if (status === 'paid' && extra) {
    extraRow.style.display = 'flex';
    extraLabel.textContent = 'Reference No.';
    extraVal.textContent = extra;
  } else if (status === 'waived' && extra) {
    extraRow.style.display = 'flex';
    extraLabel.textContent = 'Waiver Reason';
    extraVal.textContent = extra;
  } else {
    extraRow.style.display = 'none';
  }
  openMo('a-payment-detail');
}

// ════════════════════════════════════════════════
// CONFETTI (pure client-side, no backend needed)
// ════════════════════════════════════════════════
function triggerConfetti(){
  const wrap=document.getElementById('confetti-wrap');
  const cols=['#E53935','#1976D2','#FFC107','#2E7D32','#9C27B0'];
  for(let i=0;i<35;i++){
    const c=document.createElement('div');
    c.className='confetto';
    c.style.cssText=`left:${Math.random()*100}%;top:-10px;background:${cols[Math.floor(Math.random()*cols.length)]};transform:rotate(${Math.random()*360}deg);animation-delay:${Math.random()*0.8}s;animation-duration:${1.4+Math.random()*0.8}s;`;
    wrap.appendChild(c);
  }
  setTimeout(()=>wrap.innerHTML='',3000);
}

// ════════════════════════════════════════════════
// AI BOT — shared, role-aware
// BACKEND HOOK: sendBot() below replies from a hardcoded
// keyword map (memberReplies / adminReplies). To wire in a
// real AI backend, replace the matching block with:
//
//   const data = await apiRequest('/chatbot', {
//     method: 'POST',
//     body: JSON.stringify({ message: msg, role: currentRole, userId: loggedInUser?.id })
//   });
//   renderBotReply(data.reply);
//
// ════════════════════════════════════════════════
const memberReplies = {
  'next session':'Your next session is **Advanced HR Analytics Workshop** with Dr. Ana Reyes on Jun 15 at 2:00 PM. The Join Now button activates when it goes live! 🎯',
  'mid level':'To reach **Mid Level** you need:\n✅ 80% overall attendance (you\'re at 72%)\n✅ Complete at least 3 skill tree tracks\n✅ Earn 6+ certificates\n\nJoin 2 more sessions to hit 80%! 🚀',
  'skill tree':'Your Skill Tree status:\n\n✅ **Recruitment Basics** — Completed!\n🟡 **Compliance** — 72% (In Progress)\n🔒 All other tracks — Locked\n\nHit 80% attendance to unlock next nodes! 💪',
  'certificate':'You have **4 certificates** so far! 🏆\n1. Digital Onboarding (Apr 2025)\n2. DOLE Compliance (Mar 2025)\n3. HR Tech Tools (Feb 2025)\n4. Recruitment Mastery (Dec 2024)\n\nGo to the Certificates page to download or share on LinkedIn!',
  'unlock':'To unlock the next node:\n📋 Reach 80% attendance (you\'re at 72%)\n🎯 Join 2 more sessions in Compliance track\n\nI recommend the upcoming DOLE Compliance Refresher! 💡',
  'default':'I can help you navigate sessions, career path, and certificates. Try asking about your next session, how to reach Mid level, or where your certificates are! 😊'
};
const adminReplies = {
  'last session':'The last completed session was **Digital Onboarding Masterclass** (Jun 5). 215/250 attended (86%). 215 certificates generated. Revenue: ₱53,750. 🎉',
  'pending csv':'**1 pending CSV upload**: DOLE Compliance Refresher (Jun 10) — 98 attendees, 5 days overdue. Go to Attendance Management → Upload CSV.',
  'payment':'Payment summary for June 2025:\n💚 Collected: ₱186,400\n⏳ Pending: ₱3,600 (8 members)\n🎁 Waivers: 12 members\n\nTop method: GCash (64%).',
  'popular':'Most popular expertise area: **Recruitment** at 92% attendance. Compliance follows at 84%. Consider 2 more Recruitment sessions in Q3. 🎯',
  'certificates':'June MTD: **215 certificates** issued from Digital Onboarding. DOLE Compliance pending (CSV not uploaded yet). Total this year: **1,842 certificates**. 🏆',
  'attendance':'Average session attendance this month is **78%**, down 2% from last month. Cavite leads at 85%, Quezon is lowest at 58% — targeted outreach recommended.',
  'default':'I can help with session stats, pending actions, member data, certificates, and payment summaries. Try asking about pending CSVs, last session stats, or payment summary! 🤖'
};

function setupMemberBot(){
  document.getElementById('bot-role-label').textContent='Member AI Assistant';
  document.getElementById('bot-greeting').textContent=`Hi ${loggedInUser?.name.split(' ')[0] || 'there'}! 👋 I'm GameBot. I can help you with sessions, career path, and certificates. What do you need?`;
  document.getElementById('bot-qp').innerHTML=`
    <div class="qp" onclick="sendBot('Show my next session')">📅 Next session</div>
    <div class="qp" onclick="sendBot('How do I reach Mid level?')">🚀 Mid level</div>
    <div class="qp" onclick="sendBot('Where am I in Skill Tree?')">🗺 Skill Tree</div>
    <div class="qp" onclick="sendBot('Where is my certificate?')">🏆 Certificates</div>
    <div class="qp" onclick="sendBot('How do I unlock the next node?')">🔓 Unlock node</div>`;
}
function setupAdminBot(){
  document.getElementById('bot-role-label').textContent='Admin AI Assistant';
  document.getElementById('bot-greeting').textContent='Hi Juan! 👋 I\'m GameBot. I can help with session stats, member data, certificate status, and payment summaries. What do you need?';
  document.getElementById('bot-qp').innerHTML=`
    <div class="qp" onclick="sendBot('Last session stats')">📊 Last session</div>
    <div class="qp" onclick="sendBot('Pending CSV uploads')">⏳ Pending CSVs</div>
    <div class="qp" onclick="sendBot('Payment summary')">💳 Payments</div>
    <div class="qp" onclick="sendBot('Most popular area')">🎯 Top area</div>
    <div class="qp" onclick="sendBot('Certificates this month')">🏆 Certs</div>`;
}
function toggleBot(){
  botOpen=!botOpen;
  document.getElementById('bot-panel').classList.toggle('open',botOpen);
}
function sendBot(msg){
  if(!msg?.trim())return;
  const msgs=document.getElementById('bot-msgs');
  msgs.innerHTML+=`<div class="bmsg u">${escapeHtml(msg)}</div>`;
  document.getElementById('bot-in').value='';

  // BACKEND HOOK: swap this local keyword lookup for a real API call — see
  // the comment block above this function for the exact fetch() shape.
  const replies=currentRole==='admin' ? adminReplies : memberReplies;
  let reply=replies['default'];
  const ml=msg.toLowerCase();
  for(const k in replies){
    if(k!=='default'&&ml.includes(k)){reply=replies[k];break;}
  }
  setTimeout(()=>{
    msgs.innerHTML+=`<div class="bmsg b">${reply.replace(/\n/g,'<br>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')}</div>`;
    msgs.scrollTop=msgs.scrollHeight;
  },550);
  msgs.scrollTop=msgs.scrollHeight;
  if(!botOpen)toggleBot();
}
function escapeHtml(s){
  const d=document.createElement('div');
  d.textContent=s;
  return d.innerHTML;
}

// ════════════════════════════════════════════════
// INIT
// BACKEND HOOK: this is the natural place to kick off
// an initial data load, e.g.:
//   apiRequest('/stats/overview').then(s => { ...populate lh-stat-* ... });
// ════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('m-today').textContent = todayStr();
  document.getElementById('a-date').textContent = todayStr();
});
