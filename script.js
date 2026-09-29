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
   ✅ AUTH IS NOW LIVE ON SUPABASE: login, registration, email
      confirmation, and forgot/reset password use Supabase Auth.
      Fill in SUPABASE_URL and SUPABASE_ANON_KEY below, and run
      supabase_setup.sql in the Supabase SQL Editor.
   The REST of the app (members table, sessions, payments, certs)
   still runs on DUMMY DATA (the objects/arrays
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

// ════════════════════════════════════════════════
// SUPABASE CONNECTION
// Copy these two values from:
//   Supabase Dashboard → Project Settings → API
// The "anon / public" key is meant for the browser.
// NEVER paste the "service_role" key here.
// ════════════════════════════════════════════════
const SUPABASE_URL      = 'https://xszowbctpuqbszagzdwa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhzem93YmN0cHVxYnN6YWd6ZHdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5NTcyOTMsImV4cCI6MjEwNTUzMzI5M30.oeNCiiRMqnyDWzrwoE5AJldK_83UiqU728aLUk_xdrQ';

// Where the links inside Supabase emails (confirm sign-up, reset password)
// bring the user back to. This exact URL must also be added in:
//   Authentication → URL Configuration → Redirect URLs
const APP_URL = window.location.origin + window.location.pathname;

// Read the URL BEFORE the Supabase client consumes it, so we know whether the
// user just clicked a "reset password" or "confirm email" link.
const ARRIVED_FROM = (() => {
  const h = new URLSearchParams(window.location.hash.slice(1));
  const q = new URLSearchParams(window.location.search);
  return {
    type:  h.get('type')  || q.get('type'),
    error: h.get('error_description') || q.get('error_description')
  };
})();

if (!window.supabase || typeof window.supabase.createClient !== 'function') {
  console.error('Supabase library did not load. Check the <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"> tag in index.html (it must come before script.js).');
}
if (window.location.protocol === 'file:') {
  console.warn('You opened index.html directly from disk (file://). Email links cannot return to a file:// page. Serve the folder instead, e.g. VS Code "Live Server" → http://127.0.0.1:5500/index.html');
}

// Named "sb" so it doesn't clash with the global "supabase" library object.
const sb = window.supabase.createClient(new URL(SUPABASE_URL).origin, SUPABASE_ANON_KEY.trim());

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

// ════════════════════════════════════════════════
// EMAIL VALIDATION
// No website can prove a mailbox exists without emailing it — that is
// what Supabase's confirmation link does (the account can't sign in until
// the link is clicked). Before that, we reject what we CAN detect:
//   1. bad format            (juan@, juan@gmail, juan gmail.com)
//   2. common domain typos   (gmial.com, gmail.con, yaho.com)
//   3. domains with no mail server (checked through public DNS)
//   4. emails already registered   (email_status() SQL function)
// ════════════════════════════════════════════════
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

const DOMAIN_TYPOS = {
  'gmial.com':'gmail.com','gmal.com':'gmail.com','gmai.com':'gmail.com','gamil.com':'gmail.com',
  'gnail.com':'gmail.com','gmail.co':'gmail.com','gmail.con':'gmail.com','gmail.cm':'gmail.com','gmail.om':'gmail.com',
  'yaho.com':'yahoo.com','yahooo.com':'yahoo.com','yahoo.con':'yahoo.com','yahoo.co':'yahoo.com',
  'hotmial.com':'hotmail.com','hotmal.com':'hotmail.com','hotmail.con':'hotmail.com',
  'outlok.com':'outlook.com','outloo.com':'outlook.com','outlook.con':'outlook.com',
  'icloud.con':'icloud.com','iclod.com':'icloud.com'
};

// Ask Google's public DNS whether the domain can receive email.
// Returns true / false, or null when the check itself couldn't run
// (offline, blocked by a firewall) — in that case we don't block the user.
async function domainAcceptsMail(domain) {
  async function dns(type) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    try {
      const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`, { signal: ctrl.signal });
      return res.ok ? await res.json() : null;
    } finally { clearTimeout(timer); }
  }
  try {
    const mx = await dns('MX');
    if (!mx) return null;
    if (mx.Status === 3) return false;          // NXDOMAIN — the domain doesn't exist
    if (mx.Status !== 0) return null;
    const records = (mx.Answer || []).filter(a => a.type === 15);
    if (records.length) {
      // "Null MX" (priority 0, host ".") means the domain explicitly accepts no mail
      return !records.every(a => /^0\s+\.?$/.test(String(a.data).trim()));
    }
    const a = await dns('A');                   // no MX → mail falls back to the A record
    return a ? (a.Answer || []).some(r => r.type === 1) : null;
  } catch (e) {
    return null;
  }
}

// Returns { ok: boolean, msg: string }
async function validateEmail(rawEmail, { checkDuplicate = false } = {}) {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return { ok: false, msg: 'Please enter your email address.' };
  if (!EMAIL_REGEX.test(email) || email.includes('..')) {
    return { ok: false, msg: 'That doesn\'t look like a valid email address (example: juan@gmail.com).' };
  }
  const domain = email.split('@')[1];
  if (DOMAIN_TYPOS[domain]) {
    return { ok: false, msg: `Did you mean ${email.split('@')[0]}@${DOMAIN_TYPOS[domain]}? "${domain}" looks like a typo.` };
  }
  const acceptsMail = await domainAcceptsMail(domain);
  if (acceptsMail === false) {
    return { ok: false, msg: `The domain "${domain}" doesn't exist or can't receive email. Please check the spelling.` };
  }
  if (checkDuplicate) {
    // 'none' | 'unconfirmed' | 'confirmed'. An unconfirmed address may sign up
    // again — Supabase simply re-sends the confirmation link.
    const { data, error } = await sb.rpc('email_status', { p_email: email });
    if (!error && data === 'confirmed') {
      return { ok: false, msg: 'This email is already registered. Sign in instead, or use "Forgot password?".' };
    }
  }
  return { ok: true, msg: '' };
}

// Live feedback while typing the registration email
async function liveCheckEmail(value) {
  const hint = document.getElementById('r-email-hint');
  if (!hint || !value.trim()) return;
  hint.style.color = 'var(--t3)';
  hint.textContent = 'Checking email...';
  const result = await validateEmail(value, { checkDuplicate: true });
  if (document.getElementById('r-email').value.trim() !== value.trim()) return; // user kept typing
  hint.style.color = result.ok ? 'var(--green, #2E7D32)' : 'var(--red-d)';
  hint.textContent = result.ok
    ? '✓ Looks good. We\'ll send a confirmation link to this address.'
    : result.msg;
}
function clearEmailHint() {
  const hint = document.getElementById('r-email-hint');
  if (!hint) return;
  hint.style.color = 'var(--t3)';
  hint.textContent = 'A confirmation link will be sent to this address. You must click it before you can sign in.';
}

// Turn Supabase error messages into something a member understands,
// and log the technical reason for whoever is maintaining the app.
function friendlyAuthError(error) {
  const m = (error && error.message ? error.message : String(error)).toLowerCase();
  console.error('[Supabase]', error);
  if (m.includes('invalid login credentials'))  return 'Incorrect email/Admin ID or password.';
  if (m.includes('email not confirmed'))        return 'Please confirm your email first — open the link we sent to your inbox (check Spam too).';
  if (m.includes('already registered'))         return 'This email is already registered. Sign in instead, or use "Forgot password?".';
  if (m.includes('rate limit') || m.includes('too many') || (error && error.status === 429))
    return 'Too many emails were requested. Please wait a while and try again. (Admin: Supabase\'s built-in mailer allows only a few emails per hour — set up custom SMTP.)';
  if (m.includes('not authorized') || m.includes('error sending'))
    return 'We couldn\'t send the email. (Admin: Supabase\'s built-in mailer only delivers to your Supabase team members — set up custom SMTP under Authentication → Emails → SMTP Settings.)';
  if (m.includes('database error'))
    return 'The account could not be saved. (Admin: run the supabase_setup.sql script in the SQL Editor — the profile trigger is failing.)';
  if (m.includes('password should be') || m.includes('weak password'))
    return 'Password is too weak. Use at least 6 characters.';
  if (m.includes('failed to fetch') || m.includes('network'))
    return 'Can\'t reach the server. Check your internet connection and your SUPABASE_URL in script.js.';
  return error && error.message ? error.message : 'Something went wrong. Please try again.';
}

// ════════════════════════════════════════════════
// SESSION / PROFILE
// ════════════════════════════════════════════════
function makeInitials(name) {
  return (name || '').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'ME';
}

// Reads the row for this user from public.profiles (created by the SQL trigger)
async function loadProfile(user) {
  const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) console.error('[Supabase] Could not load profile:', error);
  const meta = user.user_metadata || {};
  const p = data || {};
  const name = p.full_name || meta.full_name || user.email;
  return {
    uid:      user.id,
    id:       p.member_id || '—',
    role:     p.role || 'member',
    name,
    initials: makeInitials(name),
    email:    user.email,
    province: p.province || meta.province || '',
    company:  p.company  || meta.company  || '',
    department: p.department || meta.department || '',
    position: p.position || meta.position || ''
  };
}

// ════════════════════════════════════════════════
// ACTIVITY LOGS  (tables created by supabase/03_logs.sql)
//   member_attendance_logs / admin_attendance_logs → sign-in & sign-out
//   admin_activity_logs                            → what admins changed
// Logging never blocks the user: failures only show in the console.
// ════════════════════════════════════════════════
async function logSignIn(method) {
  try {
    const { error } = await sb.rpc('log_sign_in', { p_method: method, p_user_agent: navigator.userAgent });
    if (error) console.error('[Supabase] sign-in log failed:', error);
  } catch (e) { console.error('[Supabase] sign-in log failed:', e); }
}
async function logSignOut() {
  try {
    const { error } = await sb.rpc('log_sign_out', { p_user_agent: navigator.userAgent });
    if (error) console.error('[Supabase] sign-out log failed:', error);
  } catch (e) { console.error('[Supabase] sign-out log failed:', e); }
}
// Failed attempts go to login_audit (wrong password, unconfirmed email…)
function logFailedLogin(identifier, reason) {
  sb.rpc('log_failed_login', { p_identifier: identifier, p_reason: reason, p_user_agent: navigator.userAgent })
    .then(({ error }) => { if (error) console.error('[Supabase] failed-login log failed:', error); });
}
// Call from any admin action: logAdminAction('Published session', title, { extra: 'info' })
function logAdminAction(action, target = null, details = null) {
  if (currentRole !== 'admin' || !loggedInUser) return;
  sb.rpc('log_admin_action', { p_action: action, p_target: target, p_details: details })
    .then(({ error }) => { if (error) console.error('[Supabase] admin activity log failed:', error); });
}

// loginMode: 'admin' when the user typed an Admin ID, 'member' for email, null for a restored session
async function startSession(user, loginMode) {
  const profile = await loadProfile(user);
  if (loginMode === 'admin' && profile.role !== 'admin') {
    logFailedLogin(profile.id, 'not an admin account');
    await sb.auth.signOut();
    throw new Error('This Admin ID does not belong to an admin account.');
  }
  loggedInUser = profile;
  currentRole  = profile.role === 'admin' ? 'admin' : 'member';
  enterApp();
  // A typed login is always logged. A restored session (page reload) only
  // starts a new row if the user has no recent open sign-in.
  logSignIn(loginMode ? 'password' : 'session_restored');
}

let pendingConfirmEmail = null;

async function doLogin() {
  const cred = document.getElementById('l-cred').value.trim();
  const p    = document.getElementById('l-pass').value;
  const err  = document.getElementById('login-err');
  err.style.display = 'none';

  if (!cred || !p) {
    showLoginErr('Please enter your ' + (currentRole === 'admin' ? 'Admin ID' : 'email address') + ' and password.');
    return;
  }
  const loginMode = isAdminId(cred) ? 'admin' : 'member';
  if (loginMode === 'member' && !EMAIL_REGEX.test(cred)) {
    showLoginErr('Please enter a valid email address. Admin IDs use the format ADM-YYYY-NNNN.');
    return;
  }

  const btn = document.getElementById('login-btn');
  const origText = btn.textContent;
  btn.textContent = 'Signing in...'; btn.disabled = true;

  try {
    // Supabase signs in with an EMAIL, so an Admin ID is first translated
    // to the admin's email by the get_login_email() SQL function.
    let email = cred.toLowerCase();
    if (loginMode === 'admin') {
      const { data, error } = await sb.rpc('get_login_email', { p_member_id: cred.toUpperCase() });
      if (error) throw error;
      if (!data) { logFailedLogin(cred, 'admin id not found'); showLoginErr('Admin ID not found.'); return; }
      email = data;
    }

    const { data, error } = await sb.auth.signInWithPassword({ email, password: p });
    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        logFailedLogin(cred, 'email not confirmed');
        pendingConfirmEmail = email;
        showLoginErrHtml('Please confirm your email first — open the link we sent to your inbox (check Spam too).<br><a style="font-weight:700;cursor:pointer;text-decoration:underline;" onclick="resendConfirmation()">Resend confirmation email</a>');
        return;
      }
      if (error.message.toLowerCase().includes('invalid login credentials')) logFailedLogin(cred, 'wrong password');
      showLoginErr(friendlyAuthError(error));
      return;
    }
    await startSession(data.user, loginMode);
  } catch (e) {
    showLoginErr(friendlyAuthError(e));
  } finally {
    btn.textContent = origText; btn.disabled = false;
  }
}

async function resendConfirmation() {
  if (!pendingConfirmEmail) return;
  const { error } = await sb.auth.resend({
    type: 'signup',
    email: pendingConfirmEmail,
    options: { emailRedirectTo: APP_URL }
  });
  if (error) showLoginErr(friendlyAuthError(error));
  else showToast(`Confirmation email re-sent to ${pendingConfirmEmail}.`, 'success', 5000);
}

function enterApp() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('register-page').style.display = 'none';
  const first = loggedInUser.name.split(' ')[0];
  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  if (currentRole === 'admin') {
    document.getElementById('admin-app').style.display = 'flex';
    document.getElementById('a-date').textContent = todayStr();
    setText('a-user-av', loggedInUser.initials);
    setText('a-tb-av', loggedInUser.initials);
    setText('a-user-name', loggedInUser.name);
    setText('a-user-id', loggedInUser.id);
    setText('a-welcome-name', `Good morning, ${first}! 👋`);
    setupAdminBot();
    renderMembersTable();
  } else {
    document.getElementById('member-app').style.display = 'flex';
    document.getElementById('m-today').textContent = todayStr();
    setText('m-welcome-name', `Hi, ${first}! 👋`);
    setText('m-user-name', loggedInUser.name);
    setText('m-user-id', loggedInUser.id);
    setText('m-user-av', loggedInUser.initials);
    setText('m-tb-av', loggedInUser.initials);
    setText('m-prof-av', loggedInUser.initials);
    setText('m-prof-name', loggedInUser.name);
    setText('m-prof-id', loggedInUser.id);
    setText('m-prof-fullname', loggedInUser.name);
    setText('m-prof-email', loggedInUser.email);
    setText('m-prof-province', loggedInUser.province || '—');
    setText('m-prof-company', loggedInUser.company || '—');
    setupMemberBot();
    startCountdown();
    renderMemberCerts();
  }
  showToast(`Welcome back, ${first}!`, 'success');
}

function showLoginErr(msg) {
  const el = document.getElementById('login-err');
  el.textContent = msg; el.style.display = 'block';
}
function showLoginErrHtml(html) {
  const el = document.getElementById('login-err');
  el.innerHTML = html; el.style.display = 'block';
}

function switchToLogin() {
  const hadUser = !!loggedInUser;
  (async () => {
    if (hadUser) await logSignOut();          // needs the session, so it runs first
    await sb.auth.signOut();
  })().catch(e => console.error('[Supabase] sign-out failed', e));

  document.getElementById('member-app').style.display = 'none';
  document.getElementById('admin-app').style.display = 'none';
  document.getElementById('register-page').style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
  botOpen = false;
  document.getElementById('bot-panel').classList.remove('open');
  loggedInUser = null;

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

// ════════════════════════════════════════════════
// FORGOT PASSWORD
// Step 1: user enters email (or Admin ID) → Supabase emails a reset link
// Step 2: link opens this page → "Set a new password" modal → updateUser()
// ════════════════════════════════════════════════
function handleForgotPassword() {
  const typed = document.getElementById('l-cred').value.trim();
  document.getElementById('fp-email').value = typed;
  const msg = document.getElementById('fp-msg');
  msg.style.display = 'none';
  openMo('forgot-modal');
  setTimeout(() => document.getElementById('fp-email').focus(), 50);
}

function showFpMsg(text, ok) {
  const msg = document.getElementById('fp-msg');
  msg.textContent = text;
  msg.style.background = ok ? 'var(--green-l, #E8F5E9)' : 'var(--red-l)';
  msg.style.color      = ok ? 'var(--green, #2E7D32)'   : 'var(--red-d)';
  msg.style.display = 'block';
}

function maskEmail(email) {
  const [u, d] = email.split('@');
  return (u.length <= 2 ? u[0] + '*' : u.slice(0, 2) + '*'.repeat(Math.max(1, u.length - 2))) + '@' + d;
}

async function sendResetLink() {
  const input = document.getElementById('fp-email').value.trim();
  const btn = document.getElementById('fp-btn');
  if (!input) { showFpMsg('Please enter your email address or Admin ID.', false); return; }

  btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Sending...';
  try {
    let email = input.toLowerCase();
    let viaAdminId = false;

    if (isAdminId(input)) {
      const { data, error } = await sb.rpc('get_login_email', { p_member_id: input.toUpperCase() });
      if (error) throw error;
      if (!data) { showFpMsg('Admin ID not found.', false); return; }
      email = data; viaAdminId = true;
    } else {
      if (!EMAIL_REGEX.test(email)) { showFpMsg('Please enter a valid email address.', false); return; }
      // Tell the user plainly if there is no account for this email
      const { data: status, error } = await sb.rpc('email_status', { p_email: email });
      if (!error && status === 'none') {
        showFpMsg('No account is registered with this email. Check the spelling or create an account.', false);
        return;
      }
    }

    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: APP_URL });
    if (error) { showFpMsg(friendlyAuthError(error), false); return; }

    const shown = viaAdminId ? maskEmail(email) : email;
    showFpMsg(`✓ Reset link sent to ${shown}. Open it on this device to set a new password (check Spam too).`, true);
  } catch (e) {
    showFpMsg(friendlyAuthError(e), false);
  } finally {
    btn.disabled = false; btn.textContent = orig;
  }
}

function openResetModal() {
  document.getElementById('rp-msg').style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('member-app').style.display = 'none';
  document.getElementById('admin-app').style.display = 'none';
  openMo('reset-modal');
}

async function saveNewPassword() {
  const p1 = document.getElementById('rp-pass').value;
  const p2 = document.getElementById('rp-pass2').value;
  const msg = document.getElementById('rp-msg');
  const btn = document.getElementById('rp-btn');
  msg.style.display = 'none';
  const fail = t => { msg.textContent = t; msg.style.display = 'block'; };

  if (p1.length < 6) return fail('Password must be at least 6 characters.');
  if (p1 !== p2)     return fail('Passwords do not match.');

  btn.disabled = true; btn.textContent = 'Saving...';
  const { error } = await sb.auth.updateUser({ password: p1 });
  btn.disabled = false; btn.textContent = 'Save new password';
  if (error) return fail(friendlyAuthError(error));

  await sb.auth.signOut();
  document.getElementById('rp-pass').value = '';
  document.getElementById('rp-pass2').value = '';
  closeMo('reset-modal');
  history.replaceState(null, '', APP_URL);
  showToast('Password updated! Sign in with your new password.', 'success', 5000);
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

async function handleRegister() {
  const fullName    = document.getElementById('r-fullname').value.trim();
  const email       = document.getElementById('r-email').value.trim().toLowerCase();
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
  if (pass.length < 6) { showRegisterErr('Password must be at least 6 characters.'); return; }
  if (pass !== pass2)  { showRegisterErr('Passwords do not match.'); return; }

  const btn = document.getElementById('register-btn');
  const origText = btn.textContent;
  btn.textContent = 'Checking email...'; btn.disabled = true;

  try {
    const check = await validateEmail(email, { checkDuplicate: true });
    if (!check.ok) { showRegisterErr(check.msg); return; }

    btn.textContent = 'Creating account...';

    // Creates the user in Authentication → Users and sends the confirmation email.
    // The extra fields go into user metadata; the SQL trigger copies them
    // into public.profiles and assigns a member ID (HRC-YYYY-NNNN).
    const { data, error } = await sb.auth.signUp({
      email,
      password: pass,
      options: {
        emailRedirectTo: APP_URL,
        data: { full_name: fullName, province, company, department, position }
      }
    });
    if (error) { showRegisterErr(friendlyAuthError(error)); return; }

    // Supabase hides duplicates by returning a user with no identities
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      showRegisterErr('This email is already registered. Sign in instead, or use "Forgot password?".');
      return;
    }

    if (data.session) {
      // "Confirm email" is switched OFF in Supabase, so nobody verifies the address.
      console.warn('Supabase "Confirm email" is disabled — fake emails can register. Turn it on in Authentication → Sign In / Providers → Email.');
      await sb.auth.signOut();
    }

    ['r-fullname','r-email','r-pass','r-pass2','r-company','r-department','r-position'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('r-province').value = '';
    clearEmailHint();

    showLoginPage();
    document.getElementById('l-cred').value = email;
    detectCredential(email);
    showToast(`Account created! We sent a confirmation link to ${email}. Click it, then sign in.`, 'success', 7000);
  } catch (e) {
    showRegisterErr(friendlyAuthError(e));
  } finally {
    btn.textContent = origText; btn.disabled = false;
  }
}

// ════════════════════════════════════════════════
// AUTH STARTUP
// Restores a logged-in session, and handles people arriving
// from the "confirm email" or "reset password" links.
// ════════════════════════════════════════════════
sb.auth.onAuthStateChange((event) => {
  // Keep this callback synchronous (Supabase recommendation)
  if (event === 'PASSWORD_RECOVERY') openResetModal();
});

(async function initAuth() {
  if (ARRIVED_FROM.error) {
    showToast(`Link problem: ${ARRIVED_FROM.error}. Request a new link.`, 'error', 7000);
    history.replaceState(null, '', APP_URL);
    return;
  }
  const { data: { session } } = await sb.auth.getSession();

  if (ARRIVED_FROM.type === 'recovery') { openResetModal(); return; }

  if (session) {
    try {
      await startSession(session.user, null);
      if (ARRIVED_FROM.type === 'signup') showToast('Email confirmed — your account is active! 🎉', 'success', 5000);
    } catch (e) {
      console.error(e);
    }
  }
  if (ARRIVED_FROM.type) history.replaceState(null, '', APP_URL);
})();

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
  logAdminAction('Exported data', what);
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
  const added = membersData[membersData.length - 1];
  logAdminAction('Added member', added.id, { name: added.name });
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
  logAdminAction('Saved session draft', document.getElementById('acs-title')?.value.trim() || null);
  showToast('Session saved as draft.', 'success');
  closeMo('a-create-session');
}
function publishSession() {
  const title = document.getElementById('acs-title')?.value.trim();
  // BACKEND HOOK: POST /api/sessions { status: 'published', ... }
  sessionsData.upcoming++;
  logAdminAction('Published session', title || null);
  showToast(title ? `"${title}" published! Members can now see it.` : 'Session published! Members can now see it.', 'success');
  closeMo('a-create-session');
}
function saveSessionChanges() {
  // BACKEND HOOK: PUT /api/sessions/:id  → then trigger email notifications server-side
  logAdminAction('Edited session', document.querySelector('#a-edit-session .fi2')?.value.trim() || null);
  showToast('Session updated. Members notified.', 'success');
  closeMo('a-edit-session');
}
function handleCancelSession(btn, title) {
  if (!confirm(`Cancel "${title}"? Registered members will be notified.`)) return;
  // BACKEND HOOK: DELETE /api/sessions/:id
  const card = btn.closest('.card');
  card.style.opacity = '0.4';
  card.style.pointerEvents = 'none';
  logAdminAction('Cancelled session', title);
  showToast(`"${title}" cancelled. Registrants notified.`, 'error');
}
function handleDeleteDraft(btn) {
  if (!confirm('Delete this draft? This cannot be undone.')) return;
  // BACKEND HOOK: DELETE /api/sessions/:id
  const draftCard = btn.closest('.card');
  const draftTitle = draftCard.querySelector('.ct, .nc, strong')?.textContent.trim() || null;
  draftCard.remove();
  logAdminAction('Deleted session draft', draftTitle);
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
    const syncSel = document.getElementById('a-sync-session');
    logAdminAction('Synced Zoom attendance', syncSel ? syncSel.options[syncSel.selectedIndex]?.text : null);
    showToast('Attendance synced from Zoom.', 'success');
  },1200);
}
function handleGenerateCertificates(count) {
  // BACKEND HOOK: POST /api/sessions/:id/certificates { autoEmail: true }
  logAdminAction('Generated certificates', null, { count });
  showToast(`🎉 Generating ${count} certificates... Members will be emailed automatically.`, 'success', 4000);
}
function handleDownloadAllZip() {
  // BACKEND HOOK: GET /api/certificates/export?format=zip
  showToast('Downloading all certificates as ZIP...', 'info');
}
function handleBulkSend() {
  // BACKEND HOOK: POST /api/certificates/bulk-send
  logAdminAction('Bulk-sent certificates');
  showToast('Bulk emailing certificates...', 'success');
}
function handlePendingCert() {
  showToast('DOLE Compliance — sync attendance from Zoom first to generate certificates.', 'info');
}
function handleResendCert(name) {
  // BACKEND HOOK: POST /api/certificates/:id/resend
  logAdminAction('Resent certificate', name);
  showToast(`Resending certificate email to ${name}...`, 'success');
}
function handleOverrideCert(btn, name) {
  if (!confirm(`Force-issue a certificate for ${name} even though they're below threshold? This will be logged.`)) return;
  // BACKEND HOOK: POST /api/certificates/override { memberName, reason }
  btn.outerHTML = '<span class="badge bg-y">⚠ Overridden</span>';
  logAdminAction('Overrode certificate threshold', name);
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