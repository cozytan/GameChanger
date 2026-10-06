/* ════════════════════════════════════════════════════════════════
   GameChanger — HR Calabarzon
   script.js — all behavior lives here.

   HOW THE 3 FILES CONNECT
   ────────────────────────
   index.html  <link rel="stylesheet" href="style.css">   (styling)
   index.html  <script src="script.js"></script>          (this file)
   Every onclick="..." attribute in index.html calls a function
   defined in this file.

   DATA
   ────
   Everything shown on the page comes from Supabase — there is no
   hardcoded/dummy data. The SQL functions this file calls are in
   supabase/01_setup.sql … 05_live_data.sql:
     public_stats()      login page numbers
     member_dashboard()  everything on the member pages
     admin_dashboard()   everything on the admin pages
     member_* / admin_*  buttons that change data
   When a table is empty the page shows a "nothing yet" message.
   ════════════════════════════════════════════════════════════════ */


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
// (index.html is dropped so every page address gives the same link)
const APP_URL = window.location.origin + window.location.pathname.replace(/index\.html$/i, '');

// Read the URL BEFORE the Supabase client consumes it, so we know whether the
// user just clicked a "reset password" or "confirm email" link.
const ARRIVED_FROM = (() => {
  const h = new URLSearchParams(window.location.hash.slice(1));
  const q = new URLSearchParams(window.location.search);
  return {
    type:    h.get('type')  || q.get('type'),
    error:   h.get('error_description') || q.get('error_description'),
    message: h.get('message') || q.get('message')
  };
})();

if (!window.supabase || typeof window.supabase.createClient !== 'function') {
  console.error('Supabase library did not load. Check the <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"> tag in index.html (it must come before script.js).');
}
if (window.location.protocol === 'file:') {
  console.warn('You opened index.html directly from disk (file://). Email links cannot return to a file:// page. Serve the folder instead, e.g. VS Code "Live Server" → http://127.0.0.1:5500/index.html');
}

// Named "sb" so it doesn't clash with the global "supabase" library object.
// flowType 'implicit': the link in a reset / confirmation email works even
// when it is opened on a different phone or computer than the one used to ask.
const sb = window.supabase.createClient(new URL(SUPABASE_URL).origin, SUPABASE_ANON_KEY.trim(), {
  auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true }
});

// ════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════
let currentRole = 'member'; // auto-detected from credential format
let botOpen = false;
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
  if (m.includes('banned') || m.includes('archived')) return 'This account has been archived. Please contact an HR Calabarzon admin.';
  if (m.includes('email not confirmed'))        return 'Please confirm your email first — open the link we sent to your inbox (check Spam too).';
  if (m.includes('already registered'))         return 'This email is already registered. Sign in instead, or use "Forgot password?".';
  if (m.includes('security purposes') || m.includes('only request this after'))
    return 'Please wait about a minute before requesting another link.';
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
    position: p.position || meta.position || '',
    status:   p.status || 'Active'
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
  if (profile.status === 'Archived') {
    await sb.auth.signOut();
    throw new Error('This account has been archived. Please contact an HR Calabarzon admin.');
  }
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
    setText('a-welcome-name', `${greeting()}, ${first}! 👋`);
    loadAdminData();
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
    loadMemberData();
  }
  showToast(`Welcome back, ${first}!`, 'success');
}

function greeting() {
  const h = Number(new Date().toLocaleString('en-PH', { hour: 'numeric', hour12: false, timeZone: 'Asia/Manila' }));
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
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
  resetBot();
  stopCountdown();
  loggedInUser = null;
  memberData = null;
  adminData = null;
  adminMe = null;
  adminMembers = null;
  closeActMenu();

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

// Finds the REGISTERED email of the account (07_password_reset.sql).
// Falls back to the older lookups if 07 has not been run yet.
async function findResetTarget(input) {
  const { data, error } = await sb.rpc('password_reset_target', { p_identifier: input });
  if (!error && data) return data;
  if (isAdminId(input)) {
    const r = await sb.rpc('get_login_email', { p_member_id: input.toUpperCase() });
    if (r.error) throw r.error;
    return r.data ? { found: true, admin_id: true, email: r.data } : { found: false, admin_id: true };
  }
  const r = await sb.rpc('email_status', { p_email: input.toLowerCase() });
  return { found: r.error ? true : r.data !== 'none', admin_id: false, email: input.toLowerCase() };
}

let resetCooldownUntil = 0;
function startResetCooldown(btn) {
  resetCooldownUntil = Date.now() + 60000;
  const tick = () => {
    const left = Math.ceil((resetCooldownUntil - Date.now()) / 1000);
    if (left <= 0) { btn.disabled = false; btn.textContent = 'Send reset link'; return; }
    btn.disabled = true; btn.textContent = `Resend in ${left}s`;
    setTimeout(tick, 1000);
  };
  tick();
}

async function sendResetLink() {
  const input = document.getElementById('fp-email').value.trim();
  const btn = document.getElementById('fp-btn');
  if (!input) { showFpMsg('Please enter your registered email address or Admin ID.', false); return; }
  if (!isAdminId(input) && !EMAIL_REGEX.test(input.toLowerCase())) {
    showFpMsg('Enter the email address you registered with (members), or your Admin ID in the format ADM-YYYY-NNNN (admins).', false);
    return;
  }
  if (Date.now() < resetCooldownUntil) return;

  btn.disabled = true; btn.textContent = 'Sending...';
  let sent = false;
  try {
    const target = await findResetTarget(input);
    if (!target.found) {
      showFpMsg(target.admin_id ? 'That Admin ID was not found. Check the format ADM-YYYY-NNNN.'
                                : 'No account is registered with this email. Check the spelling, or create an account.', false);
      return;
    }
    if (target.archived) {
      showFpMsg('This account has been archived, so its password can\'t be reset. Please contact an HR Calabarzon admin.', false);
      return;
    }

    const { error } = await sb.auth.resetPasswordForEmail(target.email, { redirectTo: APP_URL });
    if (error) { showFpMsg(friendlyAuthError(error), false); return; }

    sent = true;
    const shown = target.admin_id ? maskEmail(target.email) : target.email;
    showFpMsg(`✓ A reset link was sent to the registered email ${shown}. Open the email and click the link to set a new password (check Spam/Promotions too). The link works once and expires after 1 hour.`, true);
    startResetCooldown(btn);
  } catch (e) {
    showFpMsg(friendlyAuthError(e), false);
  } finally {
    if (!sent) { btn.disabled = false; btn.textContent = 'Send reset link'; }
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
  // Registration link shared by an admin: …/index.html#register
  if (window.location.hash === '#register') {
    history.replaceState(null, '', APP_URL);
    showRegisterPage();
  }
  if (ARRIVED_FROM.error) {
    showToast(/expired|invalid/i.test(ARRIVED_FROM.error)
      ? 'That link has expired or was already used. Please request a new one with "Forgot password?".'
      : `Link problem: ${ARRIVED_FROM.error}. Request a new link.`, 'error', 8000);
    history.replaceState(null, '', APP_URL);
    return;
  }
  const { data: { session } } = await sb.auth.getSession();

  if (ARRIVED_FROM.type === 'recovery') { openResetModal(); return; }

  if (session) {
    try {
      await startSession(session.user, null);
      if (ARRIVED_FROM.type === 'signup') showToast('Email confirmed — your account is active! 🎉', 'success', 5000);
      if (ARRIVED_FROM.type === 'email_change') showToast('Your email address was updated. Use it the next time you sign in.', 'success', 6000);
      if (ARRIVED_FROM.message) showToast(ARRIVED_FROM.message, 'info', 8000);
    } catch (e) {
      console.error(e);
      showLoginErr(friendlyAuthError(e));
    }
  }
  if (ARRIVED_FROM.type || ARRIVED_FROM.message) history.replaceState(null, '', APP_URL);
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
  // Dashboard and Analytics are one page now: "analytics" opens it at the charts
  if (p === 'analytics') { aShowPage('home'); setTimeout(() => document.getElementById('a-analytics-section')?.scrollIntoView({ behavior: 'smooth' }), 30); return; }
  document.querySelectorAll('#admin-app .page').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('#admin-app .nav-item').forEach(x=>x.classList.remove('active'));
  document.getElementById('ap-'+p).classList.add('active');
  const n=document.getElementById('an-'+(p==='member-form'?'members':p)); if(n) n.classList.add('active');
  closeActMenu();
  const t={home:'Analytics',members:'Data Management',sessions:'Session Creation',attendance:'Certificate Management',payments:'Payment Management',profile:'My Profile','member-form':memberFormUserId?'Edit Member':'Add Member'};
  document.getElementById('a-page-title').textContent = t[p]||p;
  window.scrollTo(0,0);
}
function aSwitchTab(btn, panelId) {
  btn.closest('.pill-tabs').querySelectorAll('.pt').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const page = btn.closest('.page');
  (page || document).querySelectorAll('.apanel').forEach(p=>{
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
// FORMAT HELPERS
// All dates are shown in Philippine time.
// ════════════════════════════════════════════════
const TZ = 'Asia/Manila';
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
function setHtml(id, v) { const el = document.getElementById(id); if (el) el.innerHTML = v; }
function fmtInt(n) { return Number(n || 0).toLocaleString('en-PH'); }
function fmtMoney(n) { return '₱' + Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 }); }
function fmtCompact(n) {
  n = Number(n || 0);
  if (n < 1000) return String(n);
  return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k+';
}
function fmtDate(iso)      { return iso ? new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: TZ }) : '—'; }
function fmtDateLong(iso)  { return iso ? new Date(iso).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', timeZone: TZ }) : '—'; }
function fmtDateShort(iso) { return iso ? new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: TZ }) : '—'; }
function fmtTime(iso)      { return iso ? new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: TZ }) : ''; }
function fmtMonth(iso)     { return new Date(iso).toLocaleDateString('en-PH', { month: 'long', timeZone: TZ }); }
function fmtPct(n)         { return n === null || n === undefined ? '—' : Math.round(Number(n)) + '%'; }
// yyyy-mm-dd and hh:mm of a timestamp, in Philippine time (for form inputs)
function manilaParts(iso) {
  const d = new Date(iso);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` };
}
function initialsOf(name) {
  return (name || '').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}
function emptyState(icon, text) {
  return `<div style="padding:18px 10px;text-align:center;color:var(--t3);font-size:13px;line-height:1.6;"><div style="font-size:22px;margin-bottom:4px;">${icon}</div>${text}</div>`;
}
function emptyRow(cols, text) {
  return `<tr><td colspan="${cols}" style="text-align:center;color:var(--t3);padding:20px;font-size:13px;">${text}</td></tr>`;
}

const AREA_STYLE = {
  'Recruitment':               { short: 'Recruitment', badge: 'bg-t', color: 'var(--teal)',   light: 'var(--teal-l)',   grad: 'linear-gradient(135deg,#1565C0,#0D47A1)', seal: '🏆' },
  'Compliance':                { short: 'Compliance',  badge: 'bg-r', color: 'var(--red)',    light: 'var(--red-l)',    grad: 'linear-gradient(135deg,#B71C1C,#E53935)', seal: '🏅' },
  'Learning and Development':  { short: 'L&D',         badge: 'bg-g', color: 'var(--green)',  light: 'var(--green-l)',  grad: 'linear-gradient(135deg,#1B5E20,#2E7D32)', seal: '🎓' },
  'HRIS':                      { short: 'HRIS',        badge: 'bg-b', color: 'var(--blue)',   light: 'var(--blue-l)',   grad: 'linear-gradient(135deg,#0D47A1,#1976D2)', seal: '💻' },
  'Compensation and Benefits': { short: 'Comp & Ben',  badge: 'bg-p', color: 'var(--purple)', light: 'var(--purple-l)', grad: 'linear-gradient(135deg,#4A148C,#6A1B9A)', seal: '⭐' },
  'Labor Relations':           { short: 'Labor Rel.',  badge: 'bg-y', color: '#B45309',       light: 'var(--yellow-l)', grad: 'linear-gradient(135deg,#E65100,#F57C00)', seal: '🤝' }
};
function areaStyle(a) { return AREA_STYLE[a] || { short: a || '—', badge: 'bg-gr', color: 'var(--t2)', light: 'var(--bg)', grad: 'linear-gradient(135deg,#37474F,#546E7A)', seal: '🏆' }; }
function areaBadge(a) { return a ? `<span class="badge ${areaStyle(a).badge}">${esc(areaStyle(a).short)}</span>` : '—'; }
const BAR_COLORS = ['var(--red)', 'var(--blue)', 'var(--green)', 'var(--purple)', 'var(--teal)', 'var(--orange)'];

async function rpc(name, args) {
  const { data, error } = await sb.rpc(name, args);
  if (error) throw error;
  return data;
}
function sessionIsLive(s) { const n = Date.now(); return new Date(s.start) <= n && n < new Date(s.end); }

// ════════════════════════════════════════════════
// LOGIN PAGE NUMBERS
// ════════════════════════════════════════════════
async function loadPublicStats() {
  try {
    const s = await rpc('public_stats');
    setText('lh-stat-members', fmtCompact(s.members));
    setText('lh-stat-provinces', s.provinces);
    setText('lh-stat-tracks', s.tracks);
  } catch (e) {
    console.error('[Supabase] public_stats failed — did you run 05_live_data.sql?', e);
  }
}

// ════════════════════════════════════════════════
// STATE FOR LOADED DATA
// ════════════════════════════════════════════════
let memberData = null;     // result of member_dashboard()
let adminData  = null;     // result of admin_dashboard()
let countdownTimer = null;
let skillTreeArea = 'all';
let aMembersPage = 1;
const MEMBERS_PER_PAGE = 20;
let editingSessionId = null;
let openCertificate = null;
let adminMe = null;          // result of admin_whoami()   (06_member_management.sql)
let adminMembers = null;     // result of admin_members()  (06_member_management.sql)
let memberFormUserId = null; // null = adding, otherwise the account being edited
let archiveTargetId = null;

// ════════════════════════════════════════════════
// MEMBER: load + render
// ════════════════════════════════════════════════
async function loadMemberData() {
  try {
    memberData = await rpc('member_dashboard');
  } catch (e) {
    memberData = null;
    console.error('[Supabase] member_dashboard failed:', e);
    showToast('Could not load your dashboard data. ' + friendlyAuthError(e), 'error', 6000);
  }
  renderMemberAll();
}
function renderMemberAll() {
  renderMemberHome();
  renderSkillTree();
  fillMemberFilters();
  renderMemberAttendance();
  renderMemberCerts();
  renderMemberProfile();
  startCountdown();
  setupMemberBot();
  updateMemberBadges();
}
function md() {
  return memberData || { me: {}, stats: {}, upcoming: [], history: [], certificates: [], skill_tree: [], rankings: [], areas: [] };
}
// The session a member should see first: next one they registered for, else the next open one
function memberNextSession() {
  const up = md().upcoming || [];
  return up.find(s => s.is_registered) || up[0] || null;
}
function sessionsNeededFor80(attended, missed) {
  const n = Math.ceil((0.8 * (attended + missed) - attended) / 0.2);
  return Math.max(n, 0);
}

function renderMemberHome() {
  const d = md(), st = d.stats || {}, me = d.me || {};
  const attended = Number(st.attended || 0), missed = Number(st.missed || 0);
  const hasAttendance = attended + missed > 0;
  const rate = hasAttendance ? Number(st.rate || 0) : null;


  // attendance ring
  const ring = document.getElementById('m-att-ring');
  if (ring) ring.setAttribute('stroke-dashoffset', String(213 * (1 - (rate || 0) / 100)));
  setText('m-att-ring-text', fmtPct(rate));
  setText('m-att-pct', fmtPct(rate));
  const bar = document.getElementById('m-att-bar'); if (bar) bar.style.width = (rate || 0) + '%';
  const warn = document.getElementById('m-att-warn');
  if (warn) {
    if (!hasAttendance) { warn.style.display = 'block'; warn.style.color = 'var(--t3)'; warn.textContent = 'No completed sessions yet'; }
    else if (rate < 80) { const n = sessionsNeededFor80(attended, missed); warn.style.display = 'block'; warn.style.color = ''; warn.textContent = `⚠ ${n} more session${n === 1 ? '' : 's'} needed`; }
    else { warn.style.display = 'block'; warn.style.color = 'var(--green)'; warn.textContent = '✓ Goal reached'; }
  }

  // province rankings
  const ranks = (d.rankings || []).slice(0, 3);
  const medal = ['⭐ #1', '🥈 #2', '🥉 #3'];
  setHtml('m-rankings', ranks.length ? ranks.map((r, i) => `
    <div class="rank-item"><div class="rnum r${i + 1}">${i + 1}</div><div class="ri"><h4>${esc(r.province)}</h4><p>${r.top_area ? esc(areaStyle(r.top_area).short) + ' · ' : ''}${fmtInt(r.members)} member${r.members == 1 ? '' : 's'}</p></div><div class="rs">${medal[i]}</div></div>`).join('')
    : emptyState('📍', 'No province data yet.'));

  // career path summary
  const nodes = d.skill_tree || [];
  const done = nodes.filter(n => n.status === 'COMPLETED');
  const active = nodes.filter(n => n.status === 'IN_PROGRESS');
  const areasWithNodes = [...new Set(nodes.map(n => n.area))];
  const activeAreas = new Set([...done, ...active].map(n => n.area));
  setText('m-cp-level', (me.mastery_level || '—').toUpperCase());
  setText('m-cp-tracks', nodes.length ? `${activeAreas.size} of ${areasWithNodes.length} tracks active` : 'No tracks yet');
  const preview = [...done.slice(0, 1), ...active.slice(0, 1), ...nodes.filter(n => n.status === 'LOCKED').slice(0, 3)].slice(0, 3);
  setHtml('m-cp-list', preview.length ? preview.map(n => {
    const cls = n.status === 'COMPLETED' ? 'md-done' : n.status === 'IN_PROGRESS' ? 'md-active' : 'md-lock';
    const right = n.status === 'COMPLETED' ? '✓' : n.status === 'IN_PROGRESS' ? Math.round(n.progress) + '%' : '🔒';
    const anim = n.status === 'IN_PROGRESS' ? ' style="animation:pulse 1.8s ease-in-out infinite;"' : '';
    return `<div class="m-mr"><div class="m-md ${cls}"${anim}></div><div class="m-ml">${esc(n.title)}</div><div class="m-mp">${right}</div></div>`;
  }).join('') : emptyState('🗺', 'Your career path will appear here once it is set up.'));
  const pct = nodes.length ? Math.round(100 * done.length / nodes.length) : 0;
  const cpBar = document.getElementById('m-cp-bar'); if (cpBar) cpBar.style.width = pct + '%';
  setText('m-cp-note', nodes.length ? `${pct}% of career path completed` : '—');

  // upcoming sessions
  const next = memberNextSession();
  const upcoming = d.upcoming || [];
  if (next) {
    const s = next, a = areaStyle(s.area);
    setHtml('m-home-next', `
      <div class="stag ${sessionIsLive(s) ? 't-live' : 't-up'}">${sessionIsLive(s) ? '🔴 Live now' : (s.is_registered ? '🕒 Next Up · Registered' : '🕒 Next Up')}</div>
      <div class="m-stitle">${esc(s.title)}</div>
      <div class="m-smeta"><span>📋 ${esc(a.short)}</span><span>👤 ${esc(s.speaker)}</span></div>
      <div style="font-size:12px;color:var(--t2);margin-bottom:5px;">${fmtDate(s.start)} · ${fmtTime(s.start)} · Starts in:</div>
      <div class="cdb">
        <div class="cdu"><div class="cdn" id="m-hh">--</div><div class="cdl">Hrs</div></div>
        <div class="cdu"><div class="cdn" id="m-hm">--</div><div class="cdl">Min</div></div>
        <div class="cdu"><div class="cdn" id="m-hs">--</div><div class="cdl">Sec</div></div>
      </div>
      <button class="btn btn-disabled btn-sm" id="m-join-home" onclick="openJoinModal('${esc(s.session_id)}')">Join Now (Soon)</button>`);
  } else {
    setHtml('m-home-next', emptyState('📅', 'No upcoming sessions yet. New sessions will appear here once an admin publishes them.'));
  }
  const others = upcoming.filter(s => !next || s.session_id !== next.session_id).slice(0, 2);
  setHtml('m-home-upcoming', others.map(s => `
    <div class="m-sm"><div class="m-smd"></div><div><div class="m-smt">${esc(s.title)}</div><div class="m-smm">${fmtDateShort(s.start)} · ${fmtTime(s.start)}${s.type ? ' · ' + esc(s.type) : ''}${s.is_registered ? ' · ✓ Registered' : ''}</div></div></div>`).join(''));

  setHtml('m-home-recs', renderRecCards(recommendedSessions(3), 'No open sessions to recommend right now.'));

  // stat row
  setText('m-st-attended', memberData ? fmtInt(attended) : '—');
  setText('m-st-level', me.mastery_level ? '🏅 ' + me.mastery_level : '—');
  setText('m-st-certs', memberData ? fmtInt(st.certificates) : '—');
  const rk = st.province_rank;
  setText('m-st-rank', rk && rk.rank ? '#' + rk.rank : '—');
  setText('m-st-rank-lbl', me.province ? `${me.province} Ranking` : 'Province Ranking');
}

// Upcoming sessions the member hasn't registered for; their own area first
function recommendedSessions(limit, filterFn) {
  const d = md(), mine = (d.me || {}).expertise;
  let list = (d.upcoming || []).filter(s => !s.is_registered);
  if (filterFn) list = list.filter(filterFn);
  list.sort((a, b) => (b.area === mine) - (a.area === mine) || new Date(a.start) - new Date(b.start));
  return list.slice(0, limit);
}
function renderRecCards(list, emptyText) {
  if (!list.length) return emptyState('💡', emptyText);
  return list.map(s => {
    const a = areaStyle(s.area);
    const full = s.capacity && s.registered_count >= s.capacity;
    return `<div class="rec-card"><div class="rat" style="background:${a.light};color:${a.color};">${esc(a.short)}</div><div class="rtitle">${esc(s.title)}</div><div class="rmeta"><span>${fmtDateShort(s.start)}</span><span>${esc(s.duration)} min</span><span>${Number(s.fee) > 0 ? fmtMoney(s.fee) : 'Free'}</span></div>${full
      ? '<span class="badge bg-gr" style="margin-top:7px;">Full</span>'
      : `<button class="btn btn-outline btn-sm" style="margin-top:7px;font-size:11px;" onclick="registerForSession('${esc(s.session_id)}', this)">+ Register</button>`}</div>`;
  }).join('');
}

// ── Skill tree (drawn from career_nodes + member_skill_progress) ──
function renderSkillTree() {
  const d = md(), me = d.me || {}, st = d.stats || {};
  setText('m-car-level', (me.mastery_level || '—').toUpperCase());
  setText('m-car-position', me.position || 'HR Practitioner');
  const rk = st.province_rank;
  setText('m-car-rank', me.province ? `${me.province}${rk && rk.rank ? ' · #' + rk.rank + ' Rank' : ''}` : '—');

  const nodes = d.skill_tree || [];
  const areas = [...new Set(nodes.map(n => n.area))];
  if (skillTreeArea !== 'all' && !areas.includes(skillTreeArea)) skillTreeArea = 'all';
  setHtml('m-tree-filters', nodes.length ? [`<div class="fchip ${skillTreeArea === 'all' ? 'active' : ''}" onclick="filterSkillTree('all')">All Areas</div>`]
    .concat(areas.map(a => `<div class="fchip ${skillTreeArea === a ? 'active' : ''}" onclick="filterSkillTree('${esc(a)}')">${esc(areaStyle(a).short)}</div>`)).join('') : '');

  if (!nodes.length) {
    setHtml('m-skill-tree', emptyState('🗺', 'No career path nodes yet.<br>They appear here once an admin adds them to the <strong>career_nodes</strong> table.'));
    return;
  }
  const W = 660, H = 460, cx = 330, cy = 230;
  const font = `font-family="'Plus Jakarta Sans'"`;
  let lines = '', groups = '';
  areas.forEach((area, ai) => {
    const angle = -Math.PI / 2 + ai * (2 * Math.PI / areas.length);
    const list = nodes.map((n, i) => ({ n, i })).filter(x => x.n.area === area);
    const step = Math.min(85, 175 / Math.max(list.length, 1));
    const dim = skillTreeArea !== 'all' && skillTreeArea !== area;
    list.forEach((x, j) => {
      const dist = 118 + j * step;
      const px = cx + Math.cos(angle) * dist * 1.45, py = cy + Math.sin(angle) * dist * 0.92;
      const prevDist = j === 0 ? 34 : 118 + (j - 1) * step;
      const lx = cx + Math.cos(angle) * prevDist * 1.45, ly = cy + Math.sin(angle) * prevDist * 0.92;
      lines += `<line x1="${lx.toFixed(1)}" y1="${ly.toFixed(1)}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="#E0E0E0" stroke-width="2" stroke-dasharray="4,3" opacity="${dim ? .25 : 1}"/>`;
      const n = x.n;
      const done = n.status === 'COMPLETED', act = n.status === 'IN_PROGRESS';
      const fill = done ? '#2E7D32' : act ? '#1976D2' : '#BDBDBD';
      const txt = done || act ? 'white' : '#757575';
      const words = String(n.title).split(' ');
      let l1 = '', l2 = '';
      words.forEach(w => { if ((l1 + ' ' + w).trim().length <= 12 && !l2) l1 = (l1 + ' ' + w).trim(); else l2 = (l2 + ' ' + w).trim(); });
      if (l2.length > 12) l2 = l2.slice(0, 11) + '…';
      const label = done ? `<text x="${px}" y="${py + 36}" text-anchor="middle" fill="#2E7D32" font-size="9" font-weight="700" ${font}>✓ Done</text>`
        : act ? `<text x="${px}" y="${py + 36}" text-anchor="middle" fill="#1976D2" font-size="9" font-weight="700" ${font}>${Math.round(n.progress)}% →</text>`
        : `<text x="${px}" y="${py + 40}" text-anchor="middle" fill="#9E9E9E" font-size="11">🔒</text>`;
      groups += `<g style="cursor:pointer;" opacity="${dim ? .2 : 1}" onclick="openNodeMo(${x.i})">
        <circle cx="${px}" cy="${py}" r="33" fill="${fill}" opacity=".15"/><circle cx="${px}" cy="${py}" r="25" fill="${fill}"${act ? ' style="animation:pulse 1.8s ease-in-out infinite;transform-origin:' + px + 'px ' + py + 'px;"' : ''}/>
        <text x="${px}" y="${l2 ? py - 2 : py + 3}" text-anchor="middle" fill="${txt}" font-size="7" font-weight="700" ${font}>${esc(l1)}</text>${l2 ? `<text x="${px}" y="${py + 7}" text-anchor="middle" fill="${txt}" font-size="7" ${font}>${esc(l2)}</text>` : ''}
        ${label}</g>`;
    });
    // area label at the end of each spoke
    const ex = cx + Math.cos(angle) * 78, ey = cy + Math.sin(angle) * 58 + 3;
    groups += `<text x="${ex}" y="${ey}" text-anchor="middle" fill="${areaStyle(area).color}" font-size="8" font-weight="700" opacity="${dim ? .25 : .9}" ${font}>${esc(areaStyle(area).short)}</text>`;
  });
  setHtml('m-skill-tree', `<svg width="100%" viewBox="0 0 ${W} ${H}" style="overflow:visible;">
    <circle cx="${cx}" cy="${cy}" r="40" fill="#1976D2" opacity=".13"/><circle cx="${cx}" cy="${cy}" r="28" fill="#1976D2" opacity=".22"/><circle cx="${cx}" cy="${cy}" r="20" fill="#1976D2"/>
    <text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="white" ${font} font-size="8" font-weight="800">MASTERY</text><text x="${cx}" y="${cy + 7}" text-anchor="middle" fill="white" ${font} font-size="7">HUB</text>
    ${lines}${groups}</svg>`);
}
function filterSkillTree(area) {
  skillTreeArea = area;
  renderSkillTree();
}
function openNodeMo(i) {
  const n = (md().skill_tree || [])[i]; if (!n) return;
  const state = n.status === 'COMPLETED' ? 'done' : n.status === 'IN_PROGRESS' ? 'active' : 'locked';
  setText('m-ni-icon', { done: '✅', active: '🟡', locked: '🔒' }[state]);
  setText('m-ni-title', n.title);
  const tier = n.tier ? ` · ${n.tier} tier` : '';
  setText('m-ni-body', (n.description || 'No description yet.') + '');
  const prog = document.getElementById('m-ni-prog');
  const btn = document.getElementById('m-ni-btn');
  const areaLine = `<div style="font-size:12px;color:var(--t3);margin-bottom:8px;">${esc(areaStyle(n.area).short)}${esc(tier)}${n.required > 1 ? ' · ' + n.required + ' sessions required' : ''}</div>`;
  if (state === 'done') {
    prog.innerHTML = areaLine + `<div style="font-size:12px;color:var(--green);font-weight:600;">✅ Completed on ${fmtDate(n.completed_at)}</div>`;
    btn.textContent = 'View Certificates';
    btn.onclick = () => { closeMo('m-node-modal'); mShowPage('certificates'); };
  } else {
    const p = Math.round(n.progress || 0);
    const color = state === 'active' ? 'var(--yellow)' : 'var(--red)';
    prog.innerHTML = areaLine + `<div class="prog"><div class="prog-f" style="width:${p}%;background:${color};"></div></div><div style="font-size:12px;color:var(--t3);margin-top:5px;">${p}% complete${state === 'locked' ? ' · Locked until prerequisites are met' : ''}</div>`;
    btn.textContent = 'Find Sessions';
    btn.onclick = () => { closeMo('m-node-modal'); mShowPage('attendance'); };
  }
  openMo('m-node-modal');
}

// ── Attendance page ──
function fillMemberFilters() {
  const sel = document.getElementById('m-hist-area');
  if (sel && sel.options.length <= 1) {
    (md().areas || []).forEach(a => sel.add(new Option(areaStyle(a).short, a)));
  }
  const certs = md().certificates || [];
  const ySel = document.getElementById('m-cert-year');
  if (ySel) {
    const keep = ySel.value;
    ySel.innerHTML = '<option value="">All Years</option>';
    [...new Set(certs.map(c => new Date(c.issued_at).getFullYear()))].sort((a, b) => b - a).forEach(y => ySel.add(new Option(y, y)));
    ySel.value = keep;
  }
  const aSel = document.getElementById('m-cert-acc');
  if (aSel) {
    const keep = aSel.value;
    aSel.innerHTML = '<option value="">All Accreditations</option>';
    [...new Set(certs.map(c => c.accreditation).filter(Boolean))].sort().forEach(a => aSel.add(new Option(a, a)));
    aSel.value = keep;
  }
}
function memberSessionFilter() {
  const area = document.getElementById('m-hist-area')?.value || '';
  const q = (document.getElementById('m-hist-search')?.value || '').trim().toLowerCase();
  const when = document.getElementById('m-hist-date')?.value || '';
  return s => {
    if (area && s.area !== area) return false;
    if (q && !String(s.title).toLowerCase().includes(q)) return false;
    if (when === 'month') { const d = new Date(s.start), n = new Date(); if (d.getMonth() !== n.getMonth() || d.getFullYear() !== n.getFullYear()) return false; }
    if (when === '30') { if (Math.abs(Date.now() - new Date(s.start)) > 30 * 864e5) return false; }
    return true;
  };
}
function renderMemberAttendance() {
  const next = memberNextSession();
  if (next) {
    const s = next;
    setHtml('m-att-next', `
      <div class="stag ${sessionIsLive(s) ? 't-live' : 't-up'}">${sessionIsLive(s) ? '🔴 Live now' : '📅 Next Session'}</div>
      <div class="m-stitle">${esc(s.title)}</div>
      <div class="m-smeta"><span>👤 ${esc(s.speaker)}</span><span>📋 ${esc(areaStyle(s.area).short)}</span></div>
      <div style="font-size:12px;color:var(--t2);margin-bottom:5px;">📆 ${fmtDate(s.start)} · ${fmtTime(s.start)} · ${esc(s.duration)} min${s.is_registered ? ' · ✓ Registered' : ''}</div>
      <div class="cdb">
        <div class="cdu"><div class="cdn" id="m-ah">--</div><div class="cdl">Hrs</div></div>
        <div class="cdu"><div class="cdn" id="m-am">--</div><div class="cdl">Min</div></div>
        <div class="cdu"><div class="cdn" id="m-as">--</div><div class="cdl">Sec</div></div>
      </div>
      <button class="btn btn-disabled" id="m-join-att" onclick="openJoinModal('${esc(s.session_id)}')" style="margin-top:9px;">Join Now (opens when live)</button>`);
  } else {
    setHtml('m-att-next', emptyState('📅', 'No upcoming sessions yet.'));
  }
  const filter = memberSessionFilter();
  setHtml('m-att-recs', renderRecCards(recommendedSessions(10, filter), 'No open sessions match your filters.'));

  const hist = (md().history || []).filter(filter);
  setHtml('m-history', hist.length ? hist.map(h => {
    const a = areaStyle(h.area);
    const pct = h.attendance_pct !== null && h.attendance_pct !== undefined ? ' · ' + Math.round(h.attendance_pct) + '%' : '';
    let icon = '<div class="m-hst hs-miss">✕</div>', action;
    if (h.session_status === 'Cancelled') { icon = '<div class="m-hst" style="background:var(--bg);color:var(--t3);">–</div>'; action = '<span class="badge bg-gr">Session cancelled</span>'; }
    else if (h.attendance_status === 'ATTENDED') {
      icon = '<div class="m-hst hs-done">✓</div>';
      action = h.certificate_id ? `<button class="btn btn-outline btn-sm" onclick="openMCert('${esc(h.certificate_id)}')">View Cert</button>` : '<span class="badge bg-y">Certificate pending</span>';
    }
    else if (h.attendance_status === 'INCOMPLETE') action = '<span class="miss-b">Below 80% Threshold</span>';
    else if (h.attendance_status === 'ABSENT') action = '<span class="miss-b">Absent</span>';
    else { icon = '<div class="m-hst" style="background:var(--yellow-l);color:#B45309;">…</div>'; action = '<span class="badge bg-y">Awaiting attendance sync</span>'; }
    return `<div class="m-hitem">${icon}<div class="m-hi"><h4>${esc(h.title)}</h4><p>${fmtDate(h.start)} · ${esc(a.short)} · ${esc(h.duration)} min${pct}</p></div><div class="m-ha">${action}</div></div>`;
  }).join('') : emptyState('📋', memberData && (memberData.history || []).length ? 'No sessions match your filters.' : 'No attendance history yet. Sessions you register for will show up here after they end.'));
}

// ── Certificates ──
function renderMemberCerts() {
  const grid = document.getElementById('m-cert-grid');
  if (!grid) return;
  const y = document.getElementById('m-cert-year')?.value || '';
  const acc = document.getElementById('m-cert-acc')?.value || '';
  const q = (document.getElementById('m-cert-search')?.value || '').trim().toLowerCase();
  const all = md().certificates || [];
  const list = all.filter(c => (!y || String(new Date(c.issued_at).getFullYear()) === y)
    && (!acc || c.accreditation === acc) && (!q || String(c.title).toLowerCase().includes(q)));
  grid.innerHTML = list.length ? list.map(c => {
    const a = areaStyle(c.area);
    return `
    <div class="card m-cc" onclick="openMCert('${esc(c.certificate_id)}')">
      <div class="m-cthumb" style="background:${a.grad};">
        <div class="m-cthi"><div style="font-size:26px;margin-bottom:5px;">${a.seal}</div><div class="m-ctit">${esc(c.title)}</div></div>
      </div>
      <div class="m-cbody">
        <h4>${esc(c.title)}</h4>
        <p>${fmtDate(c.issued_at)}${c.accreditation ? ' · ' + esc(c.accreditation) : ''}</p>
        <div class="vbadge">${c.status === 'ISSUED' ? '✅ Verified' : '⏳ Being prepared'}</div>
      </div>
    </div>`;
  }).join('') : `<div style="grid-column:1/-1;">${emptyState('🏆', all.length ? 'No certificates match your filters.' : 'No certificates yet. Attend at least 80% of a session to earn one.')}</div>`;
}
function openMCert(id) {
  const c = (md().certificates || []).find(x => x.certificate_id === id);
  if (!c) { showToast('Certificate not found.', 'error'); return; }
  openCertificate = c;
  const a = areaStyle(c.area);
  document.getElementById('m-cd-prev').style.background = a.grad;
  setText('m-cd-seal', a.seal);
  setText('m-cd-title', c.title);
  setText('m-cd-meta', c.title);
  setText('m-cd-date', fmtDateLong(c.issued_at));
  setText('m-cd-acc', c.accreditation || '—');
  setText('m-cd-code', c.code || '—');
  setText('m-cd-name', loggedInUser?.name || '');
  setText('m-cd-issued-to', loggedInUser?.name || '');
  setText('m-cd-status', c.status === 'ISSUED' ? '✅ Verified' : '⏳ Being prepared');
  document.getElementById('m-cert-detail').classList.add('open');
}
async function handleDownloadCert(path) {
  path = path || openCertificate?.pdf;
  if (!path) { showToast('No PDF is attached to this certificate yet.', 'info'); return; }
  if (/^https?:\/\//.test(path)) { window.open(path, '_blank', 'noopener'); return; }
  const key = path.replace(/^certificates\//, '');
  const { data, error } = await sb.storage.from('certificates').createSignedUrl(key, 120);
  if (error || !data?.signedUrl) { showToast("This certificate's PDF hasn't been generated yet.", 'info', 4500); return; }
  window.open(data.signedUrl, '_blank', 'noopener');
}
function handleShareLinkedIn() {
  const c = openCertificate; if (!c) return;
  const d = new Date(c.issued_at);
  const url = 'https://www.linkedin.com/profile/add?' + new URLSearchParams({
    startTask: 'CERTIFICATION_NAME', name: c.title, organizationName: 'HR Calabarzon',
    issueYear: d.getFullYear(), issueMonth: d.getMonth() + 1, certId: c.code || ''
  });
  window.open(url, '_blank', 'noopener');
}

// ── Profile ──
function renderMemberProfile() {
  const d = md(), me = d.me || {}, st = d.stats || {};
  const attended = Number(st.attended || 0), missed = Number(st.missed || 0);
  const rate = attended + missed > 0 ? Number(st.rate || 0) : null;
  setText('m-prof-level', me.mastery_level ? `${me.mastery_level} Level` : '—');
  setText('m-prof-att', fmtPct(rate));
  const bar = document.getElementById('m-prof-att-bar'); if (bar) bar.style.width = (rate || 0) + '%';
  setText('m-prof-sessions', memberData ? fmtInt(attended) : '—');
  setText('m-prof-certs', memberData ? fmtInt(st.certificates) : '—');
  setText('m-prof-rank', st.province_rank && st.province_rank.rank ? '#' + st.province_rank.rank : '—');
  if (memberData) {
    setText('m-prof-fullname', me.full_name || '—');
    setText('m-prof-email', me.email || '—');
    setText('m-prof-province', me.province || '—');
    setText('m-prof-company', me.company || '—');
    setText('m-prof-department', me.department || '—');
    setText('m-prof-position', me.position || '—');
  }
  const areas = [...new Set([me.expertise, ...(d.skill_tree || []).filter(n => n.status !== 'LOCKED').map(n => n.area)].filter(Boolean))];
  setHtml('m-prof-areas', areas.length ? areas.map(a => {
    const s = areaStyle(a);
    return `<span style="background:${s.light};color:${s.color};padding:5px 13px;border-radius:20px;font-size:12px;font-weight:600;">${esc(a)}</span>`;
  }).join('') : '<span style="font-size:13px;color:var(--t3);">No areas yet — they are added as you progress through sessions.</span>');
}
function handleEditProfile() {
  const me = currentRole === 'admin' ? (adminMe || {}) : (md().me || {});
  document.getElementById('ep-name').value = me.full_name || '';
  document.getElementById('ep-province').value = me.province || 'Cavite';
  document.getElementById('ep-company').value = me.company || '';
  document.getElementById('ep-department').value = me.department || '';
  document.getElementById('ep-position').value = me.position || '';
  document.getElementById('ep-phone').value = me.phone || '';
  document.getElementById('ep-email').value = me.email || loggedInUser?.email || '';
  document.getElementById('ep-err').style.display = 'none';
  clearFormErrors(Object.keys(profileFormRules()));
  attachLiveValidation(profileFormRules);
  openMo('m-edit-profile');
}
async function saveProfile() {
  const val = id => document.getElementById(id).value.trim();
  const err = document.getElementById('ep-err');
  err.style.display = 'none';
  if (!runValidation(profileFormRules())) { err.textContent = 'Please fix the fields marked in red.'; err.style.display = 'block'; return; }
  if (val('ep-phone')) document.getElementById('ep-phone').value = normalizePhPhone(val('ep-phone')).value;
  const btn = document.getElementById('ep-btn'); btn.disabled = true; btn.textContent = 'Saving...';
  try {
    await rpc('member_update_profile', { p_data: { full_name: val('ep-name'), province: val('ep-province'), company: val('ep-company'), department: val('ep-department'), position: val('ep-position'), phone: val('ep-phone') } });
    // sign-in email (this is where "Forgot password?" sends the reset link)
    const newEmail = val('ep-email').toLowerCase();
    const oldEmail = ((currentRole === 'admin' ? adminMe?.email : md().me?.email) || loggedInUser.email || '').toLowerCase();
    if (newEmail && newEmail !== oldEmail) {
      if (currentRole === 'admin' && isSuperAdmin()) {
        await rpc('admin_set_email', { p_user: adminMe.user_id, p_email: newEmail });
        loggedInUser.email = newEmail;
        showToast(`Sign-in email changed to ${newEmail}.`, 'success', 5000);
      } else {
        const check = await validateEmail(newEmail, { checkDuplicate: true });
        if (!check.ok) throw new Error(check.msg);
        const { error } = await sb.auth.updateUser({ email: newEmail }, { emailRedirectTo: APP_URL });
        if (error) throw error;
        showToast(`To finish, open the confirmation link sent to ${newEmail} (a notice may also go to your current email). Until then, keep using ${oldEmail}.`, 'info', 9000);
      }
    }
    closeMo('m-edit-profile');
    loggedInUser.name = val('ep-name');
    loggedInUser.initials = makeInitials(loggedInUser.name);
    showToast('Profile updated.', 'success');
    if (currentRole === 'admin') {
      ['a-user-name'].forEach(id => setText(id, loggedInUser.name));
      ['a-user-av', 'a-tb-av'].forEach(id => setText(id, loggedInUser.initials));
      await loadAdminData();
    } else {
      ['m-user-name', 'm-prof-name'].forEach(id => setText(id, loggedInUser.name));
      ['m-user-av', 'm-tb-av', 'm-prof-av'].forEach(id => setText(id, loggedInUser.initials));
      await loadMemberData();
    }
  } catch (e) {
    showServerFieldError(e, 'ep');
    err.textContent = friendlyAuthError(e); err.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'Save';
  }
}

// ── Sessions: register / join / countdown ──
async function registerForSession(sessionId, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Registering...'; }
  try {
    const r = await rpc('member_register_session', { p_session: sessionId });
    if (r.status === 'already registered') showToast("You're already registered for this session.", 'info');
    else if (r.free) showToast("You're registered! The Zoom link is now available.", 'success', 4500);
    else showToast(`Registered! Your seat is confirmed once the ${fmtMoney(r.fee)} fee is paid.`, 'success', 5000);
    await loadMemberData();
  } catch (e) {
    showToast(friendlyAuthError(e), 'error', 5000);
    if (btn) { btn.disabled = false; btn.textContent = '+ Register'; }
  }
}
function openJoinModal(sessionId) {
  const s = (md().upcoming || []).find(x => x.session_id === sessionId);
  if (!s) return;
  const live = sessionIsLive(s);
  const soon = new Date(s.start) - Date.now() < 15 * 60 * 1000;
  setHtml('m-join-body', `You're joining: <strong>${esc(s.title)}</strong> with ${esc(s.speaker)}<br><br>📅 ${fmtDate(s.start)} · ${fmtTime(s.start)} · ${esc(s.duration)} min${s.zoom_passcode ? `<br>🔑 Passcode: <strong>${esc(s.zoom_passcode)}</strong>` : ''}<br><br>Your attendance is recorded from Zoom automatically.`);
  let footer;
  if (!s.is_registered) footer = `<button class="btn btn-primary" onclick="closeMo('m-join-modal');registerForSession('${esc(s.session_id)}')">+ Register</button>`;
  else if (!s.zoom_join_url) footer = `<span class="badge bg-y">⏳ Zoom link unlocks once your payment is confirmed</span>`;
  else if (live || soon) footer = `<button class="btn btn-primary" onclick="handleJoinSession('${esc(s.session_id)}')">🚀 Join Now</button>`;
  else footer = `<span class="badge bg-b">The Join button opens 15 minutes before the start</span>`;
  setHtml('m-join-footer', footer + `<button class="btn btn-ghost" onclick="closeMo('m-join-modal')">Close</button>`);
  openMo('m-join-modal');
}
function handleJoinSession(sessionId) {
  const s = (md().upcoming || []).find(x => x.session_id === sessionId);
  if (!s || !s.zoom_join_url) { showToast('The Zoom link is not available yet.', 'info'); return; }
  window.open(s.zoom_join_url, '_blank', 'noopener');
  closeMo('m-join-modal');
}
function stopCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = null;
}
function startCountdown() {
  stopCountdown();
  const s = memberNextSession();
  if (!s) return;
  const tick = () => {
    const start = new Date(s.start).getTime(), end = new Date(s.end).getTime(), now = Date.now();
    let left = Math.max(0, Math.floor((start - now) / 1000));
    const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60), sec = left % 60;
    const f = n => String(n).padStart(2, '0');
    [['m-hh', 'm-ah', h > 99 ? '99+' : f(h)], ['m-hm', 'm-am', f(m)], ['m-hs', 'm-as', f(sec)]].forEach(([a, b, v]) => { setText(a, v); setText(b, v); });
    const soon = start - now < 15 * 60 * 1000 && now < end;
    ['m-join-home', 'm-join-att'].forEach(id => {
      const el = document.getElementById(id); if (!el) return;
      if (now >= end) { el.className = 'btn btn-disabled btn-sm'; el.textContent = 'Session ended'; }
      else if (!s.is_registered) { el.className = 'btn btn-outline btn-sm'; el.textContent = '+ Register to join'; }
      else if (now >= start) { el.className = 'btn btn-red btn-sm'; el.textContent = '🔴 Join Now — LIVE!'; }
      else if (soon) { el.className = 'btn btn-primary btn-sm'; el.textContent = 'Join Now'; }
      else { el.className = 'btn btn-disabled btn-sm'; el.textContent = 'Join Now (Soon)'; }
    });
    if (now >= end) stopCountdown();
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

// ── Member misc ──
function handleFullRankings() {
  const r = md().rankings || [];
  if (!r.length) { showToast('No province rankings yet.', 'info'); return; }
  showToast(r.map((x, i) => `${i + 1}. ${x.province} — ${fmtInt(x.attended)} attended`).join('  ·  '), 'info', 6000);
}
function handleMemberSearch(query) {
  mShowPage('attendance');
  const el = document.getElementById('m-hist-search'); if (el) el.value = query.trim();
  renderMemberAttendance();
}


// ════════════════════════════════════════════════
// ADMIN: load + render
// ════════════════════════════════════════════════
async function loadAdminData() {
  const [dash, who, list] = await Promise.allSettled([rpc('admin_dashboard'), rpc('admin_whoami'), rpc('admin_members')]);
  adminData = dash.status === 'fulfilled' ? dash.value : null;
  adminMe = who.status === 'fulfilled' ? who.value : null;
  adminMembers = list.status === 'fulfilled' ? list.value : null;
  if (dash.status === 'rejected') {
    console.error('[Supabase] admin_dashboard failed:', dash.reason);
    showToast('Could not load dashboard data. ' + friendlyAuthError(dash.reason), 'error', 6000);
  }
  if (who.status === 'rejected' || list.status === 'rejected') {
    console.error('[Supabase] member management failed — did you run 06_member_management.sql?', who.reason || list.reason);
  }
  renderAdminAll();
}
function isSuperAdmin() { return !!(adminMe && adminMe.is_super); }
// Rows for the Data Management table (06 list if available, else the dashboard list)
function membersSource() {
  if (adminMembers) return adminMembers;
  return (ad().members || []).map(m => Object.assign({ role: 'member', archived: false }, m));
}
function ad() {
  return adminData || { overview: {}, members: [], sessions: [], payments: [], registrations: [], by_province: [], by_area: [], cert_status: {}, monthly: [], areas: [], provinces: [] };
}
function renderAdminAll() {
  fillAdminSelects();
  renderAdminIdentity();
  renderAdminProfile();
  renderAdminHome();
  renderAnalytics();
  renderMembersTable();
  renderSessions();
  renderSyncSelect();
  renderAdminCertificates();
  renderCertMonitor();
  renderPayments();
  setupAdminBot();
  updateAdminBadges();
}
function deltaHtml(cur, prev, fmt = fmtInt, suffix = 'vs last month') {
  if (cur === null || cur === undefined || prev === null || prev === undefined) return '';
  const d = Number(cur) - Number(prev);
  if (d === 0) return `<span style="color:var(--t3);">No change ${suffix}</span>`;
  return `<span style="color:${d > 0 ? 'var(--green)' : 'var(--red)'};">${d > 0 ? '↑' : '↓'} ${fmt(Math.abs(d))} ${suffix}</span>`;
}
function sessionStatusBadge(s) {
  if (s.status === 'Draft') return '<span class="badge bg-gr">Draft</span>';
  if (s.status === 'Cancelled') return '<span class="badge bg-gr">Cancelled</span>';
  if (sessionIsLive(s)) return '<span class="badge bg-r">🔴 Live</span>';
  if (new Date(s.end) > Date.now()) return '<span class="badge bg-b">📅 Upcoming</span>';
  if (Number(s.registered) > 0 && Number(s.log_count) === 0) return '<span class="badge bg-y">⏳ Awaiting Sync</span>';
  return '<span class="badge bg-g">✓ Done</span>';
}
function isPastSession(s) { return s.status !== 'Draft' && (s.status === 'Cancelled' || s.status === 'Completed' || new Date(s.end) <= Date.now()); }
function isUpcomingSession(s) { return (s.status === 'Upcoming' || s.status === 'Live') && new Date(s.end) > Date.now(); }

function fillAdminSelects() {
  const d = ad();
  const fill = (id, values, first, labelFn = v => v) => {
    const el = document.getElementById(id); if (!el) return;
    const keep = el.value;
    el.innerHTML = first ? `<option value="">${first}</option>` : '';
    values.forEach(v => el.add(new Option(labelFn(v), v)));
    if ([...el.options].some(o => o.value === keep)) el.value = keep;
  };
  fill('a-mem-province', d.provinces || [], 'All Provinces');
  fill('a-mem-level', ['Entry', 'Mid', 'Master'], 'All Levels');
  fill('acs-area', d.areas || [], null);
  fill('mf-expertise', d.areas || [], '— Not set —');
  const roleSel = document.getElementById('a-mem-role'); if (roleSel) roleSel.style.display = isSuperAdmin() ? '' : 'none';
  const withRegs = (d.sessions || []).filter(s => Number(s.registered) > 0);
  fill('a-cert-filter', withRegs.map(s => s.session_id), 'All Sessions', id => { const s = withRegs.find(x => x.session_id === id); return `${s.title} · ${fmtDateShort(s.start)}`; });
  const paySessions = [...new Map((d.payments || []).filter(p => p.session_id).map(p => [p.session_id, p.session])).entries()];
  fill('a-pay-session', paySessions.map(x => x[0]), 'All Sessions', id => (paySessions.find(x => x[0] === id) || [, id])[1]);
}

function renderAdminHome() {
  const o = ad().overview || {}, loaded = !!adminData;
  setText('a-ov-sync', loaded ? fmtInt(o.awaiting_sync) : '—');
  setText('a-ov-pending', loaded ? fmtInt(o.pending_payments) : '—');
  setText('a-ov-active', loaded ? fmtInt(o.active_sessions) : '—');
  setText('a-ov-members', loaded ? fmtInt(o.total_members) : '—');
  setText('a-ov-members-new', loaded ? (Number(o.new_members_month) > 0 ? `↑ ${fmtInt(o.new_members_month)} this month` : 'No new members this month') : '');
  setText('a-ov-sessions', loaded ? fmtInt(o.sessions_year) : '—');
  setHtml('a-ov-sessions-delta', loaded ? deltaHtml(o.sessions_month, o.sessions_prev) : '');
  setText('a-ov-certs', loaded ? fmtInt(o.certs_total) : '—');
  setHtml('a-ov-certs-delta', loaded ? `<span style="color:${Number(o.certs_month) ? 'var(--green)' : 'var(--t3)'};">${Number(o.certs_month) ? '↑ ' + fmtInt(o.certs_month) : 'None'} this month</span>` : '');
  setText('a-ov-revenue', loaded ? fmtMoney(o.revenue_total) : '—');
  setHtml('a-ov-revenue-delta', loaded ? `<span style="color:${Number(o.revenue_month) ? 'var(--green)' : 'var(--t3)'};">${Number(o.revenue_month) ? '↑ ' + fmtMoney(o.revenue_month) : 'None'} this month</span>` : '');
  setText('a-ov-att', loaded ? fmtPct(o.attendance_rate) : '—');
  const m = ad().monthly || [];
  const cur = m[m.length - 1]?.rate, prev = m[m.length - 2]?.rate;
  setHtml('a-ov-att-delta', loaded ? (cur != null && prev != null ? deltaHtml(cur, prev, v => v + '%') : '<span style="color:var(--t3);">Not enough data yet</span>') : '');

  const recent = (ad().sessions || []).filter(s => s.status !== 'Draft').slice(0, 5);
  setHtml('a-home-sessions', recent.length ? recent.map(s => `
    <tr><td class="nc">${esc(s.title)}</td><td>${fmtDateShort(s.start)}</td><td>${areaBadge(s.area)}</td>
    <td>${isUpcomingSession(s) ? `${fmtInt(s.registered)}/${fmtInt(s.capacity)}` : `${fmtInt(s.attended)}/${fmtInt(s.registered)}`}</td><td>${sessionStatusBadge(s)}</td></tr>`).join('')
    : emptyRow(5, 'No sessions yet. Click "+ New Session" to create the first one.'));

  const pays = (ad().payments || []).slice(0, 3);
  setHtml('a-home-payments', pays.length ? pays.map((p, i) => `
    <div style="display:flex;align-items:center;gap:9px;font-size:13px;"><div style="width:27px;height:27px;border-radius:50%;background:${['var(--blue-l)', 'var(--yellow-l)', 'var(--red-l)'][i]};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:${['var(--blue)', '#B45309', 'var(--red)'][i]};">${esc(initialsOf(p.member))}</div><div style="flex:1;"><div style="font-weight:600;">${esc(p.member || '—')}</div><div style="font-size:11px;color:var(--t3);">${esc(p.session || '—')}</div></div><div style="text-align:right;"><div style="font-weight:700;">${fmtMoney(p.amount)}</div>${paymentBadge(p.status)}</div></div>`).join('')
    : emptyState('💳', 'No payments yet.'));
}

function barRows(list, valueKey, labelFn, emptyText) {
  if (!list.length) return emptyState('📊', emptyText);
  return list.map((x, i) => {
    const v = x[valueKey];
    const c = BAR_COLORS[i % BAR_COLORS.length];
    return `<div class="cbr"><div class="cbl">${esc(labelFn(x))}</div><div class="cbt"><div class="cbf" style="width:${v == null ? 0 : v}%;background:${c};"></div></div><div class="cbv" style="color:${c};">${v == null ? '—' : v + '%'}</div></div>`;
  }).join('');
}
function renderAnalytics() {
  const d = ad();
  setHtml('a-an-province', barRows(d.by_province || [], 'rate', x => x.name, 'No member data yet.'));
  setHtml('a-an-area', barRows((d.by_area || []).slice(0, 5), 'rate', x => areaStyle(x.name).short, 'No sessions yet.'));

  const cs = d.cert_status || {};
  const segs = [['Issued', Number(cs.issued || 0), 'var(--green)'], ['Pending', Number(cs.pending || 0), 'var(--blue)'], ['Failed / below 80%', Number(cs.failed || 0) + Number(cs.below || 0), 'var(--yellow)']];
  const total = segs.reduce((a, s) => a + s[1], 0);
  if (!total) setHtml('a-an-certs', emptyState('📜', 'No certificates yet.'));
  else {
    const C = 2 * Math.PI * 34; let off = 0;
    const arcs = segs.filter(s => s[1] > 0).map(s => { const len = C * s[1] / total; const a = `<circle cx="48" cy="48" r="34" fill="none" stroke="${s[2]}" stroke-width="11" stroke-dasharray="${len.toFixed(1)} ${(C - len).toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}" transform="rotate(-90 48 48)"/>`; off += len; return a; }).join('');
    setHtml('a-an-certs', `<div style="display:flex;align-items:center;gap:14px;"><svg width="96" height="96" viewBox="0 0 96 96"><circle cx="48" cy="48" r="34" fill="none" stroke="#F1F5F9" stroke-width="11"/>${arcs}</svg>
      <div style="display:flex;flex-direction:column;gap:7px;">${segs.map(s => `<div style="display:flex;align-items:center;gap:7px;font-size:12px;"><div style="width:9px;height:9px;border-radius:50%;background:${s[2]};flex-shrink:0;"></div><div><div style="font-weight:600;">${s[0]}</div><div style="font-size:11px;color:var(--t3);">${fmtInt(s[1])} · ${Math.round(100 * s[1] / total)}%</div></div></div>`).join('')}</div></div>`);
  }

  const now = new Date();
  setText('a-an-insight-title', `Insights — ${now.toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: TZ })}`);
  const tips = [];
  const areasRated = (d.by_area || []).filter(x => x.rate != null);
  const provRated = (d.by_province || []).filter(x => x.rate != null);
  if (areasRated.length) tips.push(`🔴 <strong>${esc(areasRated[0].name)}</strong> sessions have the highest attendance (${areasRated[0].rate}%).`);
  if (provRated.length > 1) { const low = provRated[provRated.length - 1]; tips.push(`🔵 <strong>${esc(low.name)}</strong> has the lowest attendance (${low.rate}%) — consider targeted outreach.`); }
  if (Number(d.overview?.awaiting_sync)) tips.push(`🟡 ${fmtInt(d.overview.awaiting_sync)} finished session(s) still need their Zoom attendance synced.`);
  if (Number(d.overview?.pending_payments)) tips.push(`💳 ${fmtInt(d.overview.pending_payments)} payment(s) are still pending (${fmtMoney(d.overview.pending_amount)}).`);
  setHtml('a-an-insights', tips.length ? tips.join('<br>') : (adminData ? 'Not enough data yet. Insights appear once sessions have registrations and attendance records.' : 'Data could not be loaded.'));

  const months = d.monthly || [];
  setHtml('a-an-monthly', months.length ? months.map((m, i) => {
    const current = i === months.length - 1;
    const r = m.rate;
    const badge = r == null ? '—' : `<span class="badge ${r >= 80 ? 'bg-g' : r >= 70 ? 'bg-y' : 'bg-r'}">${r}%</span>`;
    const flag = r == null ? (Number(m.sessions) ? '⏳ Awaiting attendance' : '—') : r >= 85 ? '🔥 High engagement' : r < 75 ? '⚠ Below target' : '—';
    return `<tr><td>${fmtMonth(m.month)}${current ? ' (MTD)' : ''}</td><td>${fmtInt(m.sessions)}</td><td>${fmtInt(m.attendees)}</td><td>${fmtInt(m.certs)}</td><td>${fmtMoney(m.revenue)}</td><td>${badge}</td><td>${flag}</td></tr>`;
  }).join('') : emptyRow(7, 'No data yet.'));
}

// ── Members (Data Management) ──
function filteredMembers() {
  const q = (document.getElementById('a-mem-search')?.value || '').trim().toLowerCase();
  const prov = document.getElementById('a-mem-province')?.value || '';
  const lvl = document.getElementById('a-mem-level')?.value || '';
  const role = document.getElementById('a-mem-role')?.value || '';
  const st = document.getElementById('a-mem-status')?.value || 'active';
  return membersSource().filter(m =>
    (!q || [m.full_name, m.member_id, m.email].some(v => String(v || '').toLowerCase().includes(q)))
    && (!prov || m.province === prov) && (!lvl || m.level === lvl)
    && (!role || (role === 'member' ? m.role === 'member' : m.role !== 'member'))
    && (st === 'all' || (st === 'archived' ? m.archived : !m.archived)));
}
const ROLE_BADGE = { super_admin: '<span class="badge bg-r">🛡 Super Admin</span>', admin: '<span class="badge bg-p">🛡 Admin</span>' };
function renderMembersTable() {
  const tbody = document.getElementById('a-members-tbody');
  if (!tbody) return;
  const all = filteredMembers();
  const pages = Math.max(1, Math.ceil(all.length / MEMBERS_PER_PAGE));
  aMembersPage = Math.min(Math.max(1, aMembersPage), pages);
  const start = (aMembersPage - 1) * MEMBERS_PER_PAGE;
  const rows = all.slice(start, start + MEMBERS_PER_PAGE);
  const colors = [['var(--blue-l)', 'var(--blue)'], ['var(--green-l)', 'var(--green)'], ['var(--red-l)', 'var(--red)'], ['var(--yellow-l)', '#B45309']];
  const levelBadge = { Entry: 'bg-y', Mid: 'bg-b', Master: 'bg-r' };
  tbody.innerHTML = rows.length ? rows.map((m, i) => {
    const [bg, fg] = colors[(start + i) % colors.length];
    const att = m.attendance || {};
    const hasAtt = Number(att.attended || 0) + Number(att.missed || 0) > 0;
    const rate = hasAtt ? Number(att.rate) : null;
    return `
    <tr class="${m.archived ? 'is-archived' : ''}">
      <td><div style="display:flex;align-items:center;gap:7px;"><div style="width:28px;height:28px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:${fg};">${esc(initialsOf(m.full_name))}</div><div><div class="nc">${esc(m.full_name)} ${ROLE_BADGE[m.role] || ''}</div><div style="font-size:11px;color:var(--t3);">${esc(m.email)}${m.email_confirmed ? '' : ' · <span style="color:#B45309;">unconfirmed</span>'}</div></div></div></td>
      <td style="color:var(--t3);font-size:12px;">${esc(m.member_id || '—')}</td>
      <td>${esc(m.province || '—')}</td>
      <td>${m.expertise ? areaBadge(m.expertise) : '—'}</td>
      <td><span class="badge ${levelBadge[m.level] || 'bg-gr'}">${esc(m.level)}</span></td>
      <td>${rate == null ? '<span style="font-size:12px;color:var(--t3);">No data</span>' : `<div style="display:flex;align-items:center;gap:7px;"><div class="prog" style="width:55px;"><div class="prog-f" style="width:${rate}%;background:${rate >= 80 ? 'var(--green)' : rate >= 70 ? 'var(--red)' : 'var(--yellow)'};"></div></div><span style="font-size:12px;">${rate}%</span></div>`}</td>
      <td>${fmtInt(m.certificates)}</td>
      <td><span class="badge ${m.archived ? 'bg-gr' : m.status === 'Active' ? 'bg-g' : m.status === 'Suspended' ? 'bg-r' : 'bg-y'}">${m.archived ? '🗄 Archived' : esc(m.status)}</span></td>
      <td><button class="btn btn-xs btn-ghost act-btn" onclick="openActMenu(event,'${esc(m.user_id)}')">Actions ▾</button></td>
    </tr>`;
  }).join('') : emptyRow(9, membersSource().length ? 'No members match your filters.' : 'No members yet. Click "+ Add Member" or share the registration link.');
  setText('a-mem-footer', all.length ? `Showing ${start + 1}–${start + rows.length} of ${fmtInt(all.length)} member${all.length === 1 ? '' : 's'}` : '');
  let btns = `<button class="btn btn-xs btn-ghost" onclick="handlePagination(-1)" ${aMembersPage <= 1 ? 'disabled' : ''}>← Prev</button>`;
  for (let p = Math.max(1, aMembersPage - 2); p <= Math.min(pages, aMembersPage + 2); p++) {
    btns += `<button class="btn btn-xs ${p === aMembersPage ? 'btn-red' : 'btn-ghost'}" onclick="aMembersPage=${p};renderMembersTable()">${p}</button>`;
  }
  btns += `<button class="btn btn-xs btn-ghost" onclick="handlePagination(1)" ${aMembersPage >= pages ? 'disabled' : ''}>Next →</button>`;
  setHtml('a-mem-pages', btns);
}
function handlePagination(dir) { aMembersPage += dir; renderMembersTable(); }
function handleViewMember(userId) {
  const m = membersSource().find(x => x.user_id === userId); if (!m) return;
  const att = m.attendance || {};
  setHtml('a-md-body', [
    ['Account type', { member: 'Member', admin: 'Admin', super_admin: 'Super Admin' }[m.role] || 'Member'],
    ['Member ID', m.member_id], ['Email', m.email + (m.email_confirmed ? ' ✓' : ' (not confirmed)')], ['Province', m.province],
    ['Phone', m.phone], ['Company', m.company], ['Department', m.department], ['Position', m.position], ['Expertise', m.expertise], ['Level', m.level],
    ['Status', m.archived ? `Archived ${fmtDate(m.archived_at)}` : m.status],
    ['Sessions', `${fmtInt(att.registered)} registered · ${fmtInt(att.attended)} attended`], ['Certificates', fmtInt(m.certificates)],
    ['Registered', fmtDate(m.registered_at)], ['Last sign-in', m.last_sign_in ? `${fmtDate(m.last_sign_in)} ${fmtTime(m.last_sign_in)}` : 'Never']
  ].map(([k, v]) => `<div style="display:flex;gap:10px;"><div style="font-size:12px;color:var(--t3);min-width:110px;">${k}</div><div style="font-size:13px;font-weight:600;">${esc(v || '—')}</div></div>`).join(''));
  setText('a-md-title', m.full_name);
  const acts = memberActions(m).filter(a => a.key !== 'view');
  setHtml('a-md-footer', acts.map(a => `<button class="btn ${a.cls === 'danger' ? 'btn-danger' : a.cls === 'good' ? 'btn-green' : 'btn-outline'}" onclick="closeMo('a-member-detail');${a.call}">${a.label}</button>`).join('')
    + `<button class="btn btn-ghost" onclick="closeMo('a-member-detail')">Close</button>`);
  openMo('a-member-detail');
}
function handleAdminSearch(query) {
  aShowPage('members');
  const el = document.getElementById('a-mem-search'); if (el) el.value = query.trim();
  aMembersPage = 1;
  renderMembersTable();
}

// ── Sessions ──
function renderSessions() {
  const all = ad().sessions || [];
  const upcoming = all.filter(isUpcomingSession).sort((a, b) => new Date(a.start) - new Date(b.start));
  const past = all.filter(isPastSession);
  const drafts = all.filter(s => s.status === 'Draft');
  setText('a-tab-upcoming', `Upcoming (${upcoming.length})`);
  setText('a-tab-past', `Past Sessions (${past.length})`);
  setText('a-tab-draft', `Drafts (${drafts.length})`);

  setHtml('a-sess-upcoming', upcoming.length ? upcoming.map(s => {
    const live = sessionIsLive(s), soon = new Date(s.start) - Date.now() < 864e5;
    const cap = Number(s.capacity) ? Math.round(100 * Number(s.registered) / Number(s.capacity)) : 0;
    return `<div class="card cp" style="border-left:4px solid ${live || soon ? 'var(--red)' : 'var(--blue)'};"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:9px;">${live ? '<span class="badge bg-r">🔴 Live now</span>' : soon ? '<span class="badge bg-r">🔴 Live Soon</span>' : '<span class="badge bg-b">📅 Upcoming</span>'}<div style="display:flex;gap:5px;"><button class="btn btn-xs btn-ghost" onclick="openSessionEditor('${esc(s.session_id)}')">✏ Edit</button><button class="btn btn-xs btn-danger" onclick="handleCancelSession('${esc(s.session_id)}')">Cancel</button></div></div>
      <div style="font-family:var(--font-h);font-size:14px;font-weight:700;margin-bottom:7px;">${esc(s.title)}</div>
      <div style="font-size:12px;color:var(--t2);display:flex;flex-direction:column;gap:3px;"><div>📅 ${fmtDate(s.start)} · ${fmtTime(s.start)} · ${esc(s.duration)} min</div><div>👤 ${esc(s.speaker)} · ${esc(areaStyle(s.area).short)}</div>${s.zoom_join_url ? `<div>🔗 <span style="color:var(--blue);cursor:pointer;" onclick="copyZoomLink('${esc(s.session_id)}')">${esc(String(s.zoom_join_url).replace(/^https?:\/\//, ''))}</span></div>` : '<div style="color:#B45309;">🔗 No Zoom link yet</div>'}<div>💳 ${Number(s.fee) > 0 ? fmtMoney(s.fee) + ' admission fee' : 'Free session'}</div></div>
      <div style="display:flex;gap:14px;margin-top:11px;">${[['Registered', s.registered, 'var(--blue)'], ['Paid', s.paid, 'var(--green)'], ['Pending Pay', s.pending_pay, 'var(--yellow)'], ['Capacity', s.capacity, 'var(--red)']].map(([l, v, c]) => `<div style="text-align:center;"><div style="font-family:var(--font-h);font-size:18px;font-weight:800;color:${c};">${fmtInt(v)}</div><div style="font-size:11px;color:var(--t3);">${l}</div></div>`).join('')}</div>
      <div class="prog" style="margin-top:7px;"><div class="prog-f" style="width:${Math.min(cap, 100)}%;background:var(--blue);"></div></div><div style="font-size:11px;color:var(--t3);margin-top:3px;">${cap}% capacity</div></div>`;
  }).join('') : `<div style="grid-column:1/-1;">${emptyState('📅', 'No upcoming sessions. Click "+ Create New Session" to add one.')}</div>`);

  setHtml('a-sess-past', past.length ? past.map(s => {
    const cancelled = s.status === 'Cancelled';
    const synced = Number(s.log_count) > 0;
    const sync = cancelled ? '<span class="badge bg-gr">Cancelled</span>' : synced ? '<span class="badge bg-g">✓ Synced</span>' : Number(s.registered) ? '<span class="badge bg-y">⏳ Awaiting Sync</span>' : '<span class="badge bg-gr">No registrations</span>';
    const action = cancelled ? '—' : `<button class="btn btn-xs ${synced ? 'btn-ghost' : 'btn-red'}" onclick="goToAttendance('${esc(s.session_id)}')">${synced ? 'View Certs' : 'Sync Now'}</button>`;
    return `<tr><td class="nc">${esc(s.title)}</td><td>${fmtDateShort(s.start)}</td><td>${areaBadge(s.area)}</td><td>${fmtInt(s.attended)}/${fmtInt(s.registered)}</td><td><span class="badge ${Number(s.certs) ? 'bg-g' : 'bg-y'}">${Number(s.certs) ? fmtInt(s.certs) : 'None'}</span></td><td>${fmtMoney(s.revenue)}</td><td>${sync}</td><td>${action}</td></tr>`;
  }).join('') : emptyRow(8, 'No past sessions yet.'));

  setHtml('a-sess-drafts', drafts.length ? drafts.map(s => `
    <div class="card cp" style="border:2px dashed var(--border);"><span class="badge bg-gr" style="margin-bottom:9px;">Draft</span><div style="font-family:var(--font-h);font-size:14px;font-weight:700;margin-bottom:5px;">${esc(s.title)}</div><div style="font-size:12px;color:var(--t3);margin-bottom:11px;">Created ${fmtDate(s.created_at)} · planned for ${fmtDate(s.start)}</div><div style="display:flex;gap:7px;flex-wrap:wrap;"><button class="btn btn-sm btn-red" onclick="openSessionEditor('${esc(s.session_id)}')">Continue Editing</button><button class="btn btn-sm btn-ghost" onclick="publishDraft('${esc(s.session_id)}')">Publish</button><button class="btn btn-sm btn-danger" onclick="handleDeleteDraft('${esc(s.session_id)}')">Delete</button></div></div>`).join('')
    : `<div style="grid-column:1/-1;">${emptyState('📝', 'No drafts.')}</div>`);
}
function goToAttendance(sessionId) {
  aShowPage('attendance');
  const sel = document.getElementById('a-sync-session'); if (sel) sel.value = sessionId;
  const f = document.getElementById('a-cert-filter'); if (f && [...f.options].some(o => o.value === sessionId)) { f.value = sessionId; renderAdminCertificates(); }
}
function copyZoomLink(sessionId) {
  const s = (ad().sessions || []).find(x => x.session_id === sessionId);
  if (!s?.zoom_join_url) return;
  navigator.clipboard?.writeText(s.zoom_join_url).catch(() => {});
  showToast('Zoom link copied to clipboard.', 'success', 1800);
}

// Create / edit session form (one modal for both)
function openSessionEditor(sessionId) {
  const s = sessionId ? (ad().sessions || []).find(x => x.session_id === sessionId) : null;
  editingSessionId = s ? s.session_id : null;
  const v = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
  setText('acs-heading', s ? '✏ Edit Session' : '📅 Create New Session');
  const parts = s ? manilaParts(s.start) : null;
  v('acs-title', s?.title); v('acs-speaker', s?.speaker === 'To be announced' ? '' : s?.speaker); v('acs-speaker-title', s?.speaker_title);
  v('acs-date', parts?.date); v('acs-time', parts?.time || '14:00'); v('acs-duration', s?.duration ?? 90);
  v('acs-capacity', s?.capacity ?? 200); v('acs-zoom', s?.zoom_join_url); v('acs-fee', s ? Number(s.fee) : 0);
  v('acs-accreditation', s?.accreditation); v('acs-desc', s?.description);
  const area = document.getElementById('acs-area'); if (area && s?.area) area.value = s.area;
  const type = document.getElementById('acs-type'); if (type) type.value = s?.type || 'Webinar';
  const warn = document.getElementById('acs-warning');
  if (s && Number(s.registered) > 0) { warn.style.display = 'block'; warn.textContent = `⚠ ${fmtInt(s.registered)} member(s) are registered. They are not notified automatically — please let them know about changes.`; }
  else warn.style.display = 'none';
  document.getElementById('acs-err').style.display = 'none';
  let footer;
  if (!s) footer = `<button class="btn btn-ghost" onclick="saveSession('Draft')">Save as Draft</button><button class="btn btn-red" onclick="saveSession('Upcoming')">Publish Session</button>`;
  else if (s.status === 'Draft') footer = `<button class="btn btn-ghost" onclick="saveSession('Draft')">Save Draft</button><button class="btn btn-red" onclick="saveSession('Upcoming')">Publish</button>`;
  else footer = `<button class="btn btn-ghost" onclick="closeMo('a-create-session')">Cancel</button><button class="btn btn-red" onclick="saveSession(null)">Save Changes</button>`;
  setHtml('acs-footer', footer);
  openMo('a-create-session');
}
async function saveSession(status) {
  const g = id => (document.getElementById(id)?.value || '').trim();
  const err = document.getElementById('acs-err');
  const fail = t => { err.textContent = t; err.style.display = 'block'; };
  err.style.display = 'none';
  if (!g('acs-title')) return fail('Please enter a session title.');
  if (status === 'Upcoming' || (status === null && editingSessionId)) {
    if (!g('acs-date')) return fail('Please pick a date.');
    if (!g('acs-speaker')) return fail('Please enter the speaker name.');
  }
  const start = g('acs-date') ? `${g('acs-date')}T${g('acs-time') || '00:00'}:00+08:00` : '';
  if (status === 'Upcoming' && start && new Date(start) < Date.now()) return fail('The date and time are in the past.');
  const data = {
    title: g('acs-title'), description: g('acs-desc'), area: g('acs-area'), type: g('acs-type'),
    speaker: g('acs-speaker'), speaker_title: g('acs-speaker-title'), accreditation: g('acs-accreditation'),
    start, duration: g('acs-duration'), fee: g('acs-fee'), capacity: g('acs-capacity'), zoom_join_url: g('acs-zoom')
  };
  if (status) data.status = status;
  const btns = document.querySelectorAll('#acs-footer button'); btns.forEach(b => b.disabled = true);
  try {
    const wasEditing = !!editingSessionId;
    const id = await rpc('admin_save_session', { p_id: editingSessionId, p_data: data });
    const action = !wasEditing ? (status === 'Draft' ? 'Saved session draft' : 'Published session')
      : status === 'Upcoming' ? 'Published session' : 'Edited session';
    logAdminAction(action, data.title, { session_id: id });
    closeMo('a-create-session');
    showToast(status === 'Draft' ? 'Session saved as draft.' : status === 'Upcoming' ? `"${data.title}" published! Members can now see it.` : 'Session updated.', 'success');
    await loadAdminData();
  } catch (e) {
    fail(friendlyAuthError(e));
  } finally {
    btns.forEach(b => b.disabled = false);
  }
}
async function publishDraft(sessionId) {
  const s = (ad().sessions || []).find(x => x.session_id === sessionId); if (!s) return;
  if (new Date(s.start) < Date.now()) { showToast('This draft is dated in the past. Edit the date before publishing.', 'error', 5000); openSessionEditor(sessionId); return; }
  try {
    await rpc('admin_set_session_status', { p_id: sessionId, p_status: 'Upcoming' });
    logAdminAction('Published session', s.title, { session_id: sessionId });
    showToast(`"${s.title}" published!`, 'success');
    await loadAdminData();
  } catch (e) { showToast(friendlyAuthError(e), 'error', 5000); }
}
async function handleCancelSession(sessionId) {
  const s = (ad().sessions || []).find(x => x.session_id === sessionId); if (!s) return;
  if (!confirm(`Cancel "${s.title}"?${Number(s.registered) ? ` ${s.registered} member(s) are registered — you will need to inform them.` : ''}`)) return;
  try {
    await rpc('admin_set_session_status', { p_id: sessionId, p_status: 'Cancelled' });
    logAdminAction('Cancelled session', s.title, { session_id: sessionId });
    showToast(`"${s.title}" cancelled.`, 'error');
    await loadAdminData();
  } catch (e) { showToast(friendlyAuthError(e), 'error', 5000); }
}
async function handleDeleteDraft(sessionId) {
  const s = (ad().sessions || []).find(x => x.session_id === sessionId); if (!s) return;
  if (!confirm(`Delete the draft "${s.title}"? This cannot be undone.`)) return;
  try {
    await rpc('admin_delete_session', { p_id: sessionId });
    logAdminAction('Deleted session draft', s.title, { session_id: sessionId });
    showToast('Draft deleted.', 'error');
    await loadAdminData();
  } catch (e) { showToast(friendlyAuthError(e), 'error', 5000); }
}

// ── Attendance sync + certificates ──
function renderSyncSelect() {
  const sel = document.getElementById('a-sync-session'); if (!sel) return;
  const keep = sel.value;
  const list = (ad().sessions || []).filter(s => s.status !== 'Draft' && s.status !== 'Cancelled' && new Date(s.start) <= Date.now());
  sel.innerHTML = `<option value="">${list.length ? '-- Select session --' : 'No sessions have started yet'}</option>` +
    list.map(s => `<option value="${esc(s.session_id)}">${esc(s.title)} · ${fmtDateShort(s.start)}${Number(s.log_count) === 0 && Number(s.registered) ? ' ⏳' : ''}</option>`).join('');
  if ([...sel.options].some(o => o.value === keep)) sel.value = keep;
}
async function aSyncAttendance() {
  const id = document.getElementById('a-sync-session').value;
  const box = document.getElementById('a-sync-res');
  if (!id) { showToast('Select a session first.', 'info'); return; }
  const s = (ad().sessions || []).find(x => x.session_id === id);
  const btn = document.getElementById('a-sync-btn'); const orig = btn.textContent;
  btn.textContent = '⏳ Syncing...'; btn.disabled = true;
  try {
    const r = await rpc('admin_sync_attendance', { p_session: id });
    if (r.no_logs) {
      box.style.background = 'var(--yellow-l)'; box.style.borderColor = '#FFE082';
      box.innerHTML = `<div style="font-family:var(--font-h);font-size:13px;font-weight:700;color:#B45309;margin-bottom:7px;">No Zoom attendance found</div><div style="font-size:13px;color:var(--t2);">There are no rows in <strong>attendance_logs</strong> for "${esc(s?.title)}" yet. Once the Zoom participant report is imported, sync again.</div><div style="margin-top:11px;"><button class="btn btn-ghost btn-sm" onclick="document.getElementById('a-sync-res').classList.remove('show')">Dismiss</button></div>`;
    } else {
      box.style.background = ''; box.style.borderColor = '';
      box.innerHTML = `<div style="font-family:var(--font-h);font-size:13px;font-weight:700;color:var(--green);margin-bottom:7px;">✅ Attendance synced — ${esc(s?.title)}</div>
        <div style="font-size:13px;color:var(--t2);display:flex;flex-direction:column;gap:3px;"><div>👥 <strong>Zoom attendees:</strong> ${fmtInt(r.attendees)}</div><div>✅ <strong>Qualified (≥80%):</strong> ${fmtInt(r.qualified)} member(s)</div><div>❌ <strong>Below threshold / absent:</strong> ${fmtInt(r.below)} member(s)</div>${Number(r.unmatched) ? `<div>❔ <strong>Zoom rows not matched to an account:</strong> ${fmtInt(r.unmatched)}</div>` : ''}</div>
        <div style="margin-top:11px;display:flex;gap:7px;">${Number(r.needs_certs) ? `<button class="btn btn-green btn-sm" onclick="handleGenerateCertificates('${esc(id)}')">Generate ${fmtInt(r.needs_certs)} Certificate${r.needs_certs == 1 ? '' : 's'}</button>` : ''}<button class="btn btn-ghost btn-sm" onclick="document.getElementById('a-sync-res').classList.remove('show')">Dismiss</button></div>`;
      logAdminAction('Synced Zoom attendance', s?.title, r);
    }
    box.classList.add('show');
    await loadAdminData();
  } catch (e) {
    showToast(friendlyAuthError(e), 'error', 5000);
  } finally {
    btn.textContent = orig; btn.disabled = false;
  }
}
async function handleGenerateCertificates(sessionId) {
  const s = (ad().sessions || []).find(x => x.session_id === sessionId);
  try {
    const n = await rpc('admin_generate_certificates', { p_session: sessionId });
    logAdminAction('Generated certificates', s?.title, { count: n, session_id: sessionId });
    showToast(n ? `🎉 ${n} certificate${n === 1 ? '' : 's'} created.` : 'Every qualified member already has a certificate.', 'success', 4000);
    document.getElementById('a-sync-res').classList.remove('show');
    await loadAdminData();
  } catch (e) { showToast(friendlyAuthError(e), 'error', 5000); }
}
function renderAdminCertificates() {
  const d = ad(), filter = document.getElementById('a-cert-filter')?.value || '';
  const sessions = (d.sessions || []).filter(s => Number(s.registered) > 0 && s.status !== 'Draft' && (!filter || s.session_id === filter));
  setHtml('a-cert-minis', sessions.length ? sessions.slice(0, 8).map(s => {
    const a = areaStyle(s.area);
    const has = Number(s.certs) > 0;
    return `<div class="cert-mini" style="background:${has ? a.grad : 'linear-gradient(135deg,#B71C1C,#E53935)'};" onclick="${has ? `openCertTemplate('${esc(s.session_id)}')` : `handlePendingCert('${esc(s.session_id)}')`}"><div class="cmi"><div style="font-size:18px;margin-bottom:3px;">${has ? a.seal : '⏳'}</div><div class="cmit">${esc(s.title)}</div><div style="font-size:10px;opacity:.7;margin-top:2px;">${has ? fmtInt(s.certs) + ' issued' : (Number(s.log_count) ? 'Ready to generate' : 'Awaiting Sync')}</div></div></div>`;
  }).join('') : `<div style="grid-column:1/-1;">${emptyState('🏆', 'No sessions with registrations yet.')}</div>`);

  const regs = (d.registrations || []).filter(r => !filter || r.session_id === filter);
  setHtml('a-cert-tbody', regs.length ? regs.map(r => {
    const pct = r.attendance_pct;
    const attBadge = pct == null ? (r.attendance_status === 'ABSENT' ? '<span class="badge bg-r">Absent</span>' : '<span class="badge bg-gr">No data</span>') : `<span class="badge ${pct >= 80 ? 'bg-g' : 'bg-r'}">${Math.round(pct)}%</span>`;
    let cert, actions;
    if (r.certificate_id) {
      cert = r.cert_status === 'ISSUED' ? '<span class="badge bg-g">✓ Issued</span>' : r.cert_status === 'FAILED' ? '<span class="badge bg-r">✗ Failed</span>' : '<span class="badge bg-y">⏳ Pending</span>';
      actions = `<div style="display:flex;gap:4px;"><button class="btn btn-xs btn-ghost" onclick="handleDownloadCert('${esc(r.cert_pdf)}')">⬇ PDF</button><button class="btn btn-xs btn-ghost" onclick="handleResendCert('${esc(r.registration_id)}')">Resend</button></div>`;
    } else if (r.attendance_status === 'ATTENDED') {
      cert = '<span class="badge bg-y">Not generated</span>';
      actions = `<button class="btn btn-xs btn-green" onclick="handleGenerateCertificates('${esc(r.session_id)}')">Generate</button>`;
    } else if (r.attendance_status === 'INCOMPLETE' || r.attendance_status === 'ABSENT') {
      cert = '<span class="badge bg-r">✗ Not Qualified</span>';
      actions = `<button class="btn btn-xs btn-ghost" onclick="handleOverrideCert('${esc(r.registration_id)}')">Override</button>`;
    } else {
      cert = '<span class="badge bg-gr">Awaiting sync</span>';
      actions = '—';
    }
    return `<tr><td class="nc">${esc(r.member || r.email || '—')}</td><td>${esc(r.session)}</td><td>${attBadge}</td><td>${cert}</td><td>${r.email_sent_at ? '<span class="badge bg-g">✓ Sent</span>' : '—'}</td><td>${actions}</td></tr>`;
  }).join('') : emptyRow(6, 'No attendance records yet. They appear after a session starts and members have registered.'));
}
function renderCertMonitor() {
  const d = ad(), cs = d.cert_status || {};
  setText('a-mon-issued', adminData ? fmtInt(cs.issued) : '—');
  setText('a-mon-pending', adminData ? fmtInt(cs.pending) : '—');
  setText('a-mon-failed', adminData ? fmtInt(Number(cs.failed || 0) + Number(cs.below || 0)) : '—');
  const list = (d.sessions || []).filter(s => Number(s.registered) > 0 && isPastSession(s) && s.status !== 'Cancelled');
  setHtml('a-mon-bars', list.length ? list.map((s, i) => {
    const base = Number(s.attended) || 0, certs = Number(s.certs) || 0;
    const c = certs && certs >= base ? 'var(--green)' : Number(s.log_count) ? 'var(--blue)' : 'var(--yellow)';
    const pct = base ? Math.round(100 * Math.min(certs, base) / base) : 0;
    return `<div class="cbr"><div class="cbl">${esc(s.title)}</div><div class="cbt"><div class="cbf" style="width:${pct}%;background:${c};"></div></div><div class="cbv" style="color:${c};">${Number(s.log_count) ? `${fmtInt(certs)}/${fmtInt(base)}` : 'Awaiting Sync'}</div></div>`;
  }).join('') : emptyState('📊', 'No finished sessions yet.'));
}
function openCertTemplate(sessionId) {
  const s = (ad().sessions || []).find(x => x.session_id === sessionId); if (!s) return;
  document.getElementById('a-cd-preview').style.background = areaStyle(s.area).grad;
  setText('a-cd-title', s.title);
  setText('a-cd-sub', 'HR Calabarzon' + (s.accreditation ? ' · ' + s.accreditation + ' Accredited' : ''));
  setText('a-cd-issued', `${fmtInt(s.certs)} certificate${Number(s.certs) === 1 ? '' : 's'}`);
  setText('a-cd-date', fmtDate(s.start));
  setText('a-cd-acc', s.accreditation || '—');
  openMo('a-cert-detail');
}
function handlePendingCert(sessionId) {
  const s = (ad().sessions || []).find(x => x.session_id === sessionId);
  showToast(`${s ? s.title + ' — ' : ''}sync attendance from Zoom first to generate certificates.`, 'info', 4500);
  goToAttendance(sessionId);
}
async function handleOverrideCert(registrationId) {
  const r = (ad().registrations || []).find(x => x.registration_id === registrationId); if (!r) return;
  const reason = prompt(`Force-issue a certificate for ${r.member} even though they're below the 80% threshold?\n\nReason (this will be logged):`);
  if (reason === null) return;
  if (!reason.trim()) { showToast('Please give a reason for the override.', 'error'); return; }
  try {
    await rpc('admin_override_certificate', { p_registration: registrationId, p_reason: reason.trim() });
    showToast(`Certificate override logged for ${r.member}.`, 'info');
    await loadAdminData();
  } catch (e) { showToast(friendlyAuthError(e), 'error', 5000); }
}
const EMAIL_NOT_READY = 'Emailing certificates is not set up yet — it needs an email service connected to Supabase (for example an Edge Function).';
function handleResendCert() { showToast(EMAIL_NOT_READY, 'info', 6000); }
function handleBulkSend() { showToast(EMAIL_NOT_READY, 'info', 6000); }
function handleDownloadAllZip() { showToast('Downloading all certificates as a ZIP is not set up yet — certificate PDFs are not generated yet.', 'info', 6000); }

// ── Payments (read-only; status comes from the HitPay webhook) ──
const PAYMENT_LABEL = {
  PAID: ['bg-g', '✓ Paid'], PENDING_PAYMENT: ['bg-y', '⏳ Pending'], WAIVED: ['bg-p', '🎁 Waived'],
  FAILED: ['bg-r', '✗ Failed'], CANCELLED: ['bg-gr', 'Cancelled'], REFUNDED: ['bg-b', '↩ Refunded']
};
const CHANNEL_LABEL = { GCASH: 'GCash', MAYA: 'Maya', CARD: 'Card', QR_PH: 'QR Ph', MANUAL_BANK: 'Bank transfer' };
function paymentBadge(status) { const [c, t] = PAYMENT_LABEL[status] || ['bg-gr', status || '—']; return `<span class="badge ${c}">${t}</span>`; }
function filteredPayments() {
  const sess = document.getElementById('a-pay-session')?.value || '';
  const st = document.getElementById('a-pay-status')?.value || '';
  const q = (document.getElementById('a-pay-search')?.value || '').trim().toLowerCase();
  return (ad().payments || []).filter(p => (!sess || p.session_id === sess) && (!st || p.status === st)
    && (!q || [p.member, p.email].some(v => String(v || '').toLowerCase().includes(q))));
}
function renderPayments() {
  const o = ad().overview || {}, loaded = !!adminData;
  setText('a-pay-collected', loaded ? fmtMoney(o.revenue_total) : '—');
  setText('a-pay-pending', loaded ? fmtMoney(o.pending_amount) : '—');
  setText('a-pay-pending-lbl', loaded ? `Pending (${fmtInt(o.pending_payments)})` : 'Pending');
  setText('a-pay-count', loaded ? fmtInt(o.transactions) : '—');
  setText('a-pay-waivers', loaded ? fmtInt(o.waivers) : '—');
  const colors = [['var(--blue-l)', 'var(--blue)'], ['var(--yellow-l)', '#B45309'], ['var(--green-l)', 'var(--green)'], ['var(--red-l)', 'var(--red)']];
  const list = filteredPayments();
  setHtml('a-payments-tbody', list.length ? list.map((p, i) => {
    const [bg, fg] = colors[i % colors.length];
    const paidish = p.status === 'PAID' || p.status === 'REFUNDED';
    return `<tr><td><div style="display:flex;align-items:center;gap:7px;"><div style="width:27px;height:27px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:${fg};">${esc(initialsOf(p.member))}</div><div class="nc">${esc(p.member || p.email || '—')}</div></div></td><td>${esc(p.session || '—')}</td><td style="font-weight:700;">${fmtMoney(p.amount)}</td><td>${paidish ? esc(CHANNEL_LABEL[p.channel] || p.channel) : '—'}</td><td>${fmtDateShort(p.date)}</td><td>${paymentBadge(p.status)}</td><td><button class="btn btn-xs btn-ghost" onclick="openPaymentDetail('${esc(p.transaction_id)}')">View</button></td></tr>`;
  }).join('') : emptyRow(7, (ad().payments || []).length ? 'No payments match your filters.' : 'No payments yet.'));
}
function openPaymentDetail(transactionId) {
  const p = (ad().payments || []).find(x => x.transaction_id === transactionId); if (!p) return;
  setText('apd-member', p.member || p.email || '—');
  setText('apd-session', p.session || '—');
  setText('apd-amount', fmtMoney(p.amount) + (p.currency && p.currency !== 'PHP' ? ' ' + p.currency : ''));
  setText('apd-method', CHANNEL_LABEL[p.channel] || p.channel || '—');
  setText('apd-date', p.date ? `${fmtDate(p.date)} ${fmtTime(p.date)}` : '—');
  setHtml('apd-status', paymentBadge(p.status));
  const row = document.getElementById('apd-extra-row');
  if (p.status === 'PAID' && (p.hitpay_ref || p.order_ref)) {
    row.style.display = 'flex'; setText('apd-extra-label', 'Reference No.'); setText('apd-extra', p.hitpay_ref || p.order_ref);
  } else if (p.status === 'WAIVED' && p.waiver_reason) {
    row.style.display = 'flex'; setText('apd-extra-label', 'Waiver Reason'); setText('apd-extra', p.waiver_reason);
  } else {
    row.style.display = 'none';
  }
  openMo('a-payment-detail');
}

// ════════════════════════════════════════════════
// FORM VALIDATION  (same rules as 08_validation.sql)
// Every field shows its own red message under the input.
// ════════════════════════════════════════════════
const NAME_BAD_CHARS = /[0-9!@#$%^&*()_+=\[\]{};:"\\|<>/?~`,]/;
const ID_REGEX = /^HRC-\d{4}-\d{4}$/i;

// Philippine mobile: +63 and exactly 10 digits starting with 9.
// Accepts 09171234567 · +63 917 123 4567 · 639171234567 · 9171234567
function normalizePhPhone(raw) {
  const s = String(raw || '').trim();
  if (!s) return { ok: false, empty: true, msg: 'Phone number is required.' };
  if (/[^0-9+()\s.-]/.test(s)) return { ok: false, msg: 'Use numbers only, e.g. +63 917 123 4567.' };
  const d = s.replace(/\D/g, '');
  // the 10-digit local part: after +63 / 63, or after the leading 0
  const local = s.startsWith('+') || (d.startsWith('63') && d.length > 10) ? d.replace(/^63/, '') : d.replace(/^0/, '');
  if (s.startsWith('+') && !d.startsWith('63')) return { ok: false, msg: 'Only Philippine numbers are accepted — start with +63 or 09.' };
  if (local.length !== 10) {
    return { ok: false, msg: `Invalid number — it needs +63 followed by exactly 10 digits (you entered ${local.length}). Example: +63 917 123 4567.` };
  }
  if (local[0] !== '9') return { ok: false, msg: 'Invalid number — a PH mobile number starts with 9 after +63 (e.g. +63 917 123 4567).' };
  return { ok: true, value: `+63 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` };
}

const RULES = {
  name(v, { full = true } = {}) {
    v = v.trim().replace(/\s+/g, ' ');
    if (!v) return 'Full name is required.';
    if (v.length < 2 || v.length > 100) return 'Full name must be 2 to 100 characters.';
    if (NAME_BAD_CHARS.test(v)) return 'Use letters only (spaces, periods, apostrophes and hyphens are allowed).';
    if (full && !v.includes(' ')) return 'Please enter both first and last name.';
    return '';
  },
  email(v) {
    v = v.trim().toLowerCase();
    if (!v) return 'Email address is required.';
    if (v.length > 254 || !EMAIL_REGEX.test(v) || v.includes('..')) return 'Enter a valid email address, e.g. name@gmail.com.';
    const dom = v.split('@')[1];
    if (DOMAIN_TYPOS[dom]) return `Did you mean ${v.split('@')[0]}@${DOMAIN_TYPOS[dom]}?`;
    return '';
  },
  password(v, { required = true } = {}) {
    if (!v) return required ? 'Password is required.' : '';
    if (v.length < 8) return `Password must be at least 8 characters (now ${v.length}).`;
    if (v.length > 72) return 'Password must be at most 72 characters.';
    if (!/[A-Za-z]/.test(v) || !/[0-9]/.test(v)) return 'Password must include both letters and numbers.';
    return '';
  },
  phone(v, { required = true } = {}) {
    if (!v.trim()) return required ? 'Phone number is required.' : '';
    const r = normalizePhPhone(v);
    return r.ok ? '' : r.msg;
  },
  select(label) { return v => v ? '' : `Please choose ${label}.`; },
  text(label, { required = true } = {}) {
    return v => {
      v = v.trim();
      if (!v) return required ? `${label} is required.` : '';
      if (v.length < 2 || v.length > 100) return `${label} must be 2 to 100 characters.`;
      return '';
    };
  },
  memberId(v) {
    v = v.trim();
    if (!v) return '';
    return ID_REGEX.test(v) ? '' : 'Member ID must look like HRC-2026-0001 (or leave it blank).';
  }
};

function fieldErrorEl(input) {
  const box = input.closest('.fg2') || input.closest('.fg') || input.parentElement;
  let el = box.querySelector(':scope > .fld-err');
  if (!el) { el = document.createElement('div'); el.className = 'fld-err'; box.appendChild(el); }
  return el;
}
function setFieldError(id, msg) {
  const input = document.getElementById(id); if (!input) return;
  input.classList.toggle('is-invalid', !!msg);
  const el = fieldErrorEl(input);
  el.textContent = msg || '';
  el.style.display = msg ? 'block' : 'none';
}
function clearFormErrors(ids) { ids.forEach(id => setFieldError(id, '')); }

// Rules for the Add / Edit Member page (depends on add vs edit and role)
function memberFormRules() {
  const editing = !!memberFormUserId;
  const midInput = document.getElementById('mf-mid');
  const rules = {
    'mf-name': v => RULES.name(v),
    'mf-email': v => RULES.email(v),
    'mf-phone': v => RULES.phone(v),
    'mf-pass': v => RULES.password(v, { required: !editing }),
    'mf-province': RULES.select('a province'),
    'mf-company': RULES.text('Company'),
    'mf-department': RULES.text('Department'),
    'mf-position': RULES.text('Position'),
    'mf-expertise': RULES.select('an area of expertise')
  };
  if (isSuperAdmin() && midInput && !midInput.disabled) rules['mf-mid'] = v => RULES.memberId(v);
  return rules;
}
function profileFormRules() {
  return {
    'ep-name': v => RULES.name(v, { full: false }),
    'ep-email': v => RULES.email(v),
    'ep-phone': v => RULES.phone(v, { required: false }),
    'ep-company': RULES.text('Company', { required: false }),
    'ep-department': RULES.text('Department', { required: false }),
    'ep-position': RULES.text('Position', { required: false })
  };
}
// Checks every field; shows all errors; focuses the first wrong one
function runValidation(rules) {
  let first = null;
  Object.entries(rules).forEach(([id, rule]) => {
    const el = document.getElementById(id); if (!el) return;
    const msg = rule(el.value || '');
    setFieldError(id, msg);
    if (msg && !first) first = el;
  });
  if (first) { first.focus(); first.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  return !first;
}
// Live checks: clear the message while typing, re-check when leaving a field
function attachLiveValidation(rulesFn) {
  Object.keys(rulesFn()).forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.dataset.liveVal) return;
    el.dataset.liveVal = '1';
    el.addEventListener('input', () => { if (el.classList.contains('is-invalid')) setFieldError(id, ''); });
    el.addEventListener('change', () => { const r = rulesFn()[id]; if (r) setFieldError(id, r(el.value || '')); });
    el.addEventListener('blur', () => {
      if (/phone$/.test(id)) { const p = normalizePhPhone(el.value); if (p.ok) el.value = p.value; }
      const r = rulesFn()[id]; if (r && el.value) setFieldError(id, r(el.value || ''));
    });
  });
}
// Server messages (08_validation.sql) → the matching field
function showServerFieldError(e, prefix) {
  const m = (e && e.message) || '';
  const map = [[/phone/i, 'phone'], [/full name/i, 'name'], [/email/i, 'email'], [/password/i, 'pass'], [/province/i, 'province'],
               [/company/i, 'company'], [/department/i, 'department'], [/position/i, 'position'], [/expertise/i, 'expertise'], [/member id/i, 'mid']];
  const hit = map.find(([re]) => re.test(m));
  if (hit && document.getElementById(`${prefix}-${hit[1]}`)) { setFieldError(`${prefix}-${hit[1]}`, m); return true; }
  return false;
}

// ════════════════════════════════════════════════
// MEMBER MANAGEMENT  (functions in 06_member_management.sql)
//   Super admin  → View · Edit · Archive · Restore · add members/admins
//   Normal admin → View · Archive · add members (no editing, no admins)
// ════════════════════════════════════════════════
function renderAdminIdentity() {
  setText('a-sb-role', isSuperAdmin() ? '🛡 Super Admin Panel' : '🛡 Admin Panel');
}
function memberActions(m) {
  const sup = isSuperAdmin(), id = esc(m.user_id);
  const acts = [{ key: 'view', label: '👁 View details', call: `handleViewMember('${id}')` }];
  if (!adminMembers) return acts;                           // 06 not installed yet
  if (m.archived) {
    if (sup) acts.push({ key: 'restore', label: '♻ Restore', cls: 'good', call: `restoreMember('${id}')` });
    return acts;
  }
  if (sup) acts.push({ key: 'edit', label: '✏ Edit', call: `openMemberForm('${id}')` });
  if (sup || m.role === 'member') acts.push({ key: 'archive', label: '🗄 Archive', cls: 'danger', call: `openArchiveMember('${id}')` });
  return acts;
}
function openActMenu(ev, userId) {
  ev.stopPropagation();
  const menu = document.getElementById('act-menu');
  const m = membersSource().find(x => x.user_id === userId); if (!m || !menu) return;
  if (menu.classList.contains('open') && menu.dataset.user === userId) { closeActMenu(); return; }
  const acts = memberActions(m);
  menu.innerHTML = `<div class="act-head">${esc(m.full_name || m.email)}</div>` + acts.map((a, i) =>
    (a.cls === 'danger' || a.cls === 'good') && i ? `<div class="act-sep"></div><button class="act-item ${a.cls}" onclick="closeActMenu();${a.call}">${a.label}</button>`
      : `<button class="act-item ${a.cls || ''}" onclick="closeActMenu();${a.call}">${a.label}</button>`).join('');
  menu.dataset.user = userId;
  menu.classList.add('open');
  const r = ev.currentTarget.getBoundingClientRect();
  const w = menu.offsetWidth, h = menu.offsetHeight;
  menu.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + 'px';
  menu.style.top = (r.bottom + h + 8 > window.innerHeight ? r.top - h - 4 : r.bottom + 4) + 'px';
}
function closeActMenu() { document.getElementById('act-menu')?.classList.remove('open'); }
document.addEventListener('click', e => { if (!e.target.closest('#act-menu')) closeActMenu(); });
window.addEventListener('scroll', closeActMenu, true);
window.addEventListener('resize', closeActMenu);

// ── Add / Edit Member page ──
const MF_ACTIONS_HTML = document.getElementById('mf-actions')?.innerHTML || '';
function openMemberForm(userId) {
  setHtml('mf-actions', MF_ACTIONS_HTML);
  if (!adminMembers) { showToast('Run supabase/06_member_management.sql first to enable adding members.', 'error', 6000); return; }
  const m = userId ? membersSource().find(x => x.user_id === userId) : null;
  if (userId && (!m || !isSuperAdmin())) { showToast('Only a super admin can edit members.', 'error'); return; }
  memberFormUserId = m ? m.user_id : null;
  const sup = isSuperAdmin();
  const v = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
  setText('mf-heading', m ? `Edit ${m.role === 'member' ? 'Member' : 'Admin'}` : 'Add Member');
  setText('mf-subheading', m ? `Changes are saved to ${m.full_name}'s account.` : 'Create an account for a new member. They can sign in right away with the email and password you set.');
  v('mf-name', m?.full_name); v('mf-email', m?.email); v('mf-phone', m?.phone);
  v('mf-pass', m ? '' : ''); v('mf-province', m?.province || ''); v('mf-company', m?.company);
  v('mf-department', m?.department); v('mf-position', m?.position); v('mf-expertise', m?.expertise || '');
  v('mf-level', m?.level || 'Entry'); v('mf-status', m && !m.archived ? m.status : 'Active');
  v('mf-role', m?.role || 'member'); v('mf-mid', m ? m.member_id : '');
  setText('mf-email-hint', m ? 'Sign-in email. "Forgot password?" sends the reset link here, so it must be a real inbox.' : 'They sign in with this email. Password reset links are sent here.');
  setText('mf-pass-label', m ? 'New Password' : 'Password *');
  document.getElementById('mf-pass').placeholder = m ? 'Leave blank to keep the current password' : 'At least 6 characters';
  setText('mf-pass-hint', m ? 'Only fill this in to reset their password.' : 'Share this password with the member. They can change it anytime with "Forgot password?".');
  document.getElementById('mf-confirm-wrap').style.display = m ? 'none' : '';
  document.getElementById('mf-confirm').checked = true;
  document.getElementById('mf-access-card').style.display = sup ? '' : 'none';
  document.querySelectorAll('.mf-super-only').forEach(el => el.style.display = sup ? '' : 'none');
  document.getElementById('mf-save-another').style.display = m ? 'none' : '';
  setText('mf-save', m ? 'Save Changes' : 'Save Member');
  document.getElementById('mf-err').style.display = 'none';
  document.getElementById('mf-done').style.display = 'none';
  clearFormErrors(['mf-name', 'mf-email', 'mf-phone', 'mf-pass', 'mf-province', 'mf-company', 'mf-department', 'mf-position', 'mf-expertise', 'mf-mid']);
  attachLiveValidation(memberFormRules);
  if (!m) generateMemberPassword();
  onMemberRoleChange();
  aShowPage('member-form');
  setText('a-page-title', m ? 'Edit Member' : 'Add Member');
}
function generateMemberPassword() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz', digits = '23456789', all = letters + digits;
  const rnd = crypto.getRandomValues(new Uint32Array(10));
  const pick = (set, n) => set[n % set.length];
  const chars = Array.from(rnd, (n, i) => i === 0 ? pick(letters, n) : i === 1 ? pick(digits, n) : pick(all, n));
  for (let i = chars.length - 1; i > 0; i--) { const j = rnd[i] % (i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  document.getElementById('mf-pass').value = 'GC-' + chars.join('');
  setFieldError('mf-pass', '');
}
function onMemberRoleChange() {
  const role = document.getElementById('mf-role').value;
  const hints = { member: 'Members use the member portal.', admin: 'Admins can manage sessions, attendance and payments, and add or remove members.', super_admin: 'Super admins can do everything, including editing members and creating admins.' };
  setText('mf-role-hint', hints[role]);
  const editingMember = memberFormUserId && membersSource().find(x => x.user_id === memberFormUserId);
  const mid = document.getElementById('mf-mid');
  const roleChanges = editingMember && (editingMember.role === 'member') !== (role === 'member');
  mid.disabled = role !== 'member' || roleChanges;
  if (mid.disabled) mid.value = editingMember && !roleChanges ? editingMember.member_id : '';
  setText('mf-mid-hint', role !== 'member' || roleChanges
    ? (roleChanges ? 'A new ID is assigned because the account type changes.' : 'Admins get the next ADM-YYYY-NNNN ID.')
    : (editingMember ? 'Change only if needed — must be unique.' : 'Blank = next HRC-YYYY-NNNN number.'));
  updateMemberPreview();
}
function updateMemberPreview() {
  const g = id => (document.getElementById(id)?.value || '').trim();
  const name = g('mf-name'), role = isSuperAdmin() ? g('mf-role') : 'member';
  setText('mf-pv-av', initialsOf(name));
  setText('mf-pv-name', name || 'New member');
  setText('mf-pv-id', g('mf-mid') || (memberFormUserId ? '—' : 'ID assigned on save'));
  setText('mf-pv-email', g('mf-email'));
  setText('mf-pv-position', g('mf-position'));
  const exp = g('mf-expertise');
  setHtml('mf-pv-badges', (ROLE_BADGE[role] || '<span class="badge bg-b">👤 Member</span>')
    + (exp ? areaBadge(exp) : '')
    + (isSuperAdmin() ? `<span class="badge bg-y">${esc(g('mf-level') || 'Entry')}</span>` : ''));
}
async function saveMemberForm(addAnother) {
  const g = id => (document.getElementById(id)?.value || '').trim();
  const err = document.getElementById('mf-err');
  const fail = t => { err.textContent = t; err.style.display = 'block'; err.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
  err.style.display = 'none';
  const editing = !!memberFormUserId, sup = isSuperAdmin();
  if (!runValidation(memberFormRules())) return fail('Please fix the fields marked in red.');
  document.getElementById('mf-phone').value = normalizePhPhone(g('mf-phone')).value;

  const data = { full_name: g('mf-name'), phone: g('mf-phone'), province: g('mf-province'), company: g('mf-company'),
                 department: g('mf-department'), position: g('mf-position'), expertise: g('mf-expertise') };
  if (sup) Object.assign(data, { role: g('mf-role'), level: g('mf-level'), status: g('mf-status') });
  if (sup && !document.getElementById('mf-mid').disabled && g('mf-mid')) data.member_id = g('mf-mid');
  if (g('mf-pass')) data.password = g('mf-pass');

  const btns = document.querySelectorAll('#mf-actions button'); btns.forEach(b => b.disabled = true);
  try {
    if (editing) {
      await rpc('admin_update_member', { p_user: memberFormUserId, p_data: data });
      const before = membersSource().find(x => x.user_id === memberFormUserId);
      if (before && g('mf-email').toLowerCase() !== String(before.email || '').toLowerCase()) {
        await rpc('admin_set_email', { p_user: memberFormUserId, p_email: g('mf-email').toLowerCase() });
      }
      showToast(`${data.full_name} was updated.`, 'success');
      await loadAdminData();
      aShowPage('members');
      return;
    }
    data.email = g('mf-email').toLowerCase();
    data.password = g('mf-pass');
    data.confirm_email = document.getElementById('mf-confirm').checked;
    const r = await rpc('admin_create_member', { p_data: data });
    await loadAdminData();
    const done = document.getElementById('mf-done');
    done.innerHTML = `<div style="font-family:var(--font-h);font-size:14px;font-weight:700;color:var(--green);margin-bottom:6px;">✅ ${esc(data.full_name)} was added (${esc(r.member_id)})</div>
      <div style="font-size:13px;color:var(--t2);line-height:1.7;">Share these sign-in details with them:<br>
      ${r.role === 'member' ? 'Email' : 'Admin ID'}: <strong>${esc(r.role === 'member' ? r.email : r.member_id)}</strong><br>
      Password: <strong>${esc(data.password)}</strong></div>
      <button class="btn btn-ghost btn-sm" style="margin-top:9px;" onclick="copyNewMemberDetails(this)" data-text="${esc(`GameChanger sign-in\n${r.role === 'member' ? 'Email' : 'Admin ID'}: ${r.role === 'member' ? r.email : r.member_id}\nPassword: ${data.password}\n${APP_URL}`)}">📋 Copy sign-in details</button>
      ${data.confirm_email ? '' : '<div style="font-size:12px;color:#B45309;margin-top:8px;">Their email is not confirmed yet — they must use the confirmation link before signing in.</div>'}`;
    done.style.display = 'block';
    showToast(`${data.full_name} was added.`, 'success');
    if (addAnother) {
      ['mf-name', 'mf-email', 'mf-phone', 'mf-position', 'mf-mid'].forEach(id => { document.getElementById(id).value = ''; setFieldError(id, ''); });
      generateMemberPassword();
      updateMemberPreview();
      document.getElementById('mf-name').focus();
    } else {
      setHtml('mf-actions', `<button class="btn btn-ghost" onclick="openMemberForm()">+ Add another</button><button class="btn btn-red" onclick="aShowPage('members')">Done</button>`);
    }
    done.scrollIntoView({ block: 'center', behavior: 'smooth' });
  } catch (e) {
    showServerFieldError(e, 'mf');
    fail(friendlyAuthError(e));
  } finally {
    btns.forEach(b => b.disabled = false);
  }
}
function copyNewMemberDetails(btn) {
  navigator.clipboard?.writeText(btn.dataset.text).then(() => showToast('Sign-in details copied.', 'success', 1800)).catch(() => {});
}

// ── Archive (remove) / Restore ──
function openArchiveMember(userId) {
  const m = membersSource().find(x => x.user_id === userId); if (!m) return;
  archiveTargetId = userId;
  const sup = isSuperAdmin();
  setText('aa-title', `🗄 Archive ${m.full_name}`);
  setText('aa-text', `${m.full_name} (${m.member_id || m.email}) will be hidden from the member list and will no longer be able to sign in. `
    + 'Their attendance and certificates are kept.' + (sup ? ' You can restore the account later from the "Archived" filter.' : ' A super admin can restore the account if needed.'));
  document.getElementById('aa-reason').value = '';
  document.getElementById('aa-err').style.display = 'none';
  setText('aa-btn', 'Archive');
  openMo('a-archive-modal');
}
async function confirmArchiveMember() {
  const btn = document.getElementById('aa-btn'); btn.disabled = true;
  try {
    await rpc('admin_archive_member', { p_user: archiveTargetId, p_reason: document.getElementById('aa-reason').value.trim() || null });
    closeMo('a-archive-modal');
    showToast('Account archived.', 'info');
    await loadAdminData();
  } catch (e) {
    const err = document.getElementById('aa-err'); err.textContent = friendlyAuthError(e); err.style.display = 'block';
  } finally { btn.disabled = false; }
}
async function restoreMember(userId) {
  const m = membersSource().find(x => x.user_id === userId); if (!m) return;
  if (!confirm(`Restore ${m.full_name}? They will be able to sign in again.`)) return;
  try {
    await rpc('admin_restore_member', { p_user: userId });
    showToast(`${m.full_name} was restored.`, 'success');
    await loadAdminData();
  } catch (e) { showToast(friendlyAuthError(e), 'error', 5000); }
}

// ── Admin: My Profile ──
function renderAdminProfile() {
  const me = adminMe;
  if (!me) {
    setText('a-prof-name', loggedInUser?.name || '—'); setText('a-prof-id', loggedInUser?.id || '—');
    setText('a-prof-av', loggedInUser?.initials || '');
    setHtml('a-prof-perms', 'Run <strong>06_member_management.sql</strong> in Supabase to enable profiles and member management.');
    return;
  }
  setText('a-prof-av', initialsOf(me.full_name));
  setText('a-prof-name', me.full_name || '—');
  setText('a-prof-id', me.member_id || '—');
  setHtml('a-prof-role', me.is_super ? ROLE_BADGE.super_admin : ROLE_BADGE.admin);
  setText('a-prof-since', fmtDate(me.created_at));
  setText('a-prof-last', me.last_sign_in ? `${fmtDate(me.last_sign_in)} ${fmtTime(me.last_sign_in)}` : '—');
  [['fullname', me.full_name], ['email', me.email], ['phone', me.phone], ['province', me.province], ['company', me.company],
   ['department', me.department], ['position', me.position]].forEach(([k, v]) => setText('a-prof-' + k, v || '—'));
  setHtml('a-prof-perms', me.is_super
    ? '✅ Add members and admins<br>✅ Edit any member (details, level, status, password, account type)<br>✅ Archive and restore accounts<br>✅ Manage sessions, attendance, certificates and payments'
    : '✅ View and add members<br>✅ Archive members<br>✅ Manage sessions, attendance, certificates and payments<br>🔒 Editing member info, restoring archived accounts and creating admins is for super admins');
}
async function sendMyPasswordReset() {
  const email = adminMe?.email || loggedInUser?.email;
  if (!email) return;
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: APP_URL });
  if (error) showToast(friendlyAuthError(error), 'error', 6000);
  else showToast(`A password reset link was sent to ${email}.`, 'success', 5000);
}

// ════════════════════════════════════════════════
// EXPORT — builds a CSV file from the data on screen
// ════════════════════════════════════════════════
function downloadCSV(filename, headers, rows) {
  const cell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function handleExport(what) {
  const today = new Date().toISOString().slice(0, 10);
  let file, headers, rows;
  if (what === 'attendance history' || what === 'all attendance records') {
    file = `my-attendance-${today}.csv`;
    headers = ['Session', 'Date', 'Area', 'Duration (min)', 'Attendance %', 'Status', 'Certificate'];
    rows = (md().history || []).map(h => [h.title, fmtDate(h.start), h.area, h.duration, h.attendance_pct ?? '', h.attendance_status, h.certificate_id ? 'Yes' : 'No']);
  } else if (what === 'member CSV') {
    file = `members-${today}.csv`;
    headers = ['Member ID', 'Name', 'Email', 'Province', 'Expertise', 'Company', 'Position', 'Level', 'Status', 'Attendance %', 'Certificates', 'Registered'];
    rows = filteredMembers().map(m => [m.member_id, m.full_name, m.email, m.province, m.expertise, m.company, m.position, m.level, m.status, m.attendance?.rate ?? '', m.certificates, fmtDate(m.registered_at)]);
  } else if (what === 'payments Excel') {
    file = `payments-${today}.csv`;
    headers = ['Member', 'Email', 'Session', 'Amount', 'Method', 'Date', 'Status', 'Reference'];
    rows = filteredPayments().map(p => [p.member, p.email, p.session, p.amount, CHANNEL_LABEL[p.channel] || p.channel, fmtDate(p.date), p.status, p.hitpay_ref || p.order_ref || '']);
  } else if (what === 'monthly report') {
    file = `monthly-report-${today}.csv`;
    headers = ['Month', 'Sessions', 'Attendees', 'Certificates', 'Revenue', 'Avg Attendance %'];
    rows = (ad().monthly || []).map(m => [fmtMonth(m.month), m.sessions, m.attendees, m.certs, m.revenue, m.rate ?? '']);
  } else {
    showToast('Nothing to export.', 'info'); return;
  }
  if (!rows.length) { showToast('There is no data to export yet.', 'info'); return; }
  downloadCSV(file, headers, rows);
  if (currentRole === 'admin') logAdminAction('Exported data', what, { rows: rows.length });
  showToast(`Exported ${rows.length} row${rows.length === 1 ? '' : 's'}.`, 'success');
}

// ════════════════════════════════════════════════
// NOTIFICATIONS — summarised from the loaded data
// ════════════════════════════════════════════════
function notificationItems(role) {
  const items = [];
  if (role === 'member') {
    const d = md();
    const soon = (d.upcoming || []).filter(s => s.is_registered && new Date(s.start) - Date.now() < 7 * 864e5);
    if (soon.length) items.push(`${soon.length} registered session${soon.length === 1 ? '' : 's'} this week`);
    const unpaid = (d.upcoming || []).filter(s => s.is_registered && !s.zoom_join_url && Number(s.fee) > 0);
    if (unpaid.length) items.push(`${unpaid.length} payment${unpaid.length === 1 ? '' : 's'} pending`);
    const recent = (d.certificates || []).filter(c => Date.now() - new Date(c.issued_at) < 7 * 864e5);
    if (recent.length) items.push(`${recent.length} new certificate${recent.length === 1 ? '' : 's'}`);
  } else {
    const o = ad().overview || {};
    if (Number(o.awaiting_sync)) items.push(`${o.awaiting_sync} session(s) awaiting attendance sync`);
    if (Number(o.pending_payments)) items.push(`${o.pending_payments} pending payment(s)`);
    if (Number(o.drafts)) items.push(`${o.drafts} draft session(s)`);
  }
  return items;
}
function toggleNotifications(role) {
  const items = notificationItems(role);
  showToast(items.length ? items.join(' · ') : 'No new notifications.', 'info', 4500);
}
function showBadge(id, value) {
  const el = document.getElementById(id); if (!el) return;
  el.style.display = value ? '' : 'none';
  if (value && el.classList.contains('nb')) el.textContent = value;
}
function updateMemberBadges() { showBadge('m-bell-dot', notificationItems('member').length > 0); }
function updateAdminBadges() {
  const o = ad().overview || {};
  const current = adminMembers ? adminMembers.filter(m => m.role === 'member' && !m.archived).length : Number(o.total_members);
  showBadge('a-nb-members', current ? fmtCompact(current).replace('+', '') : '');
  showBadge('a-nb-sync', Number(o.awaiting_sync) ? String(o.awaiting_sync) : '');
  showBadge('a-bell-dot', notificationItems('admin').length > 0);
}

// ════════════════════════════════════════════════
// CONFETTI (pure client-side)
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
// GAMEBOT — answers from the data already loaded
// (no hardcoded facts; everything comes from Supabase)
// ════════════════════════════════════════════════
const BOT_GREETING_HTML = document.getElementById('bot-msgs')?.innerHTML || '';
function resetBot() {
  const msgs = document.getElementById('bot-msgs'); if (msgs) msgs.innerHTML = BOT_GREETING_HTML;
  botOpen = false;
  document.getElementById('bot-panel')?.classList.remove('open');
}
function setupMemberBot(){
  setText('bot-role-label', 'Member Assistant');
  setText('bot-greeting', `Hi ${loggedInUser?.name.split(' ')[0] || 'there'}! 👋 I'm GameBot. I can help you with sessions, career path, and certificates. What do you need?`);
  document.getElementById('bot-qp').innerHTML=`
    <div class="qp" onclick="sendBot('Show my next session')">📅 Next session</div>
    <div class="qp" onclick="sendBot('What is my attendance?')">📊 Attendance</div>
    <div class="qp" onclick="sendBot('Where am I in Skill Tree?')">🗺 Skill Tree</div>
    <div class="qp" onclick="sendBot('Where is my certificate?')">🏆 Certificates</div>
    <div class="qp" onclick="sendBot('How do I unlock the next node?')">🔓 Unlock node</div>`;
}
function setupAdminBot(){
  setText('bot-role-label', 'Admin Assistant');
  setText('bot-greeting', `Hi ${loggedInUser?.name.split(' ')[0] || 'there'}! 👋 I'm GameBot. I can help with session stats, member data, certificate status, and payment summaries. What do you need?`);
  document.getElementById('bot-qp').innerHTML=`
    <div class="qp" onclick="sendBot('Last session stats')">📊 Last session</div>
    <div class="qp" onclick="sendBot('Sessions awaiting sync')">⏳ Awaiting sync</div>
    <div class="qp" onclick="sendBot('Payment summary')">💳 Payments</div>
    <div class="qp" onclick="sendBot('Most popular area')">🎯 Top area</div>
    <div class="qp" onclick="sendBot('Certificates this month')">🏆 Certs</div>`;
}
function memberBotReply(ml) {
  const d = md(), st = d.stats || {};
  if (!memberData) return "I couldn't load your data right now. Please refresh the page.";
  if (/session|next|join/.test(ml)) {
    const s = memberNextSession();
    if (!s) return 'There are no upcoming sessions yet. Check back soon! 📅';
    return `Your next session is **${s.title}** with ${s.speaker} on ${fmtDate(s.start)} at ${fmtTime(s.start)}.${s.is_registered ? " You're registered ✅" : ' You are not registered yet — open the Attendance page to register.'}`;
  }
  if (/attendance|level|mid|progress/.test(ml)) {
    const a = Number(st.attended || 0), m = Number(st.missed || 0);
    if (!a && !m) return `You're at **${d.me?.mastery_level || 'Entry'}** level. You have no completed sessions yet — attend a session to start building your attendance rate. 🚀`;
    const need = sessionsNeededFor80(a, m);
    return `Your attendance is **${st.rate}%** (${a} attended, ${m} missed). ${need ? `Attend **${need} more** session${need === 1 ? '' : 's'} to reach the 80% goal. 🎯` : "You're above the 80% goal! 🎉"}`;
  }
  if (/skill|tree|career|node|unlock/.test(ml)) {
    const nodes = d.skill_tree || [];
    if (!nodes.length) return 'Your career path has not been set up yet. 🗺';
    const done = nodes.filter(n => n.status === 'COMPLETED'), act = nodes.filter(n => n.status === 'IN_PROGRESS'), lock = nodes.filter(n => n.status === 'LOCKED');
    return `Your Skill Tree:\n✅ Completed: **${done.length}**${done.length ? ' (' + done.slice(0, 3).map(n => n.title).join(', ') + ')' : ''}\n🟡 In progress: **${act.length}**${act.length ? ' (' + act.slice(0, 3).map(n => `${n.title} ${Math.round(n.progress)}%`).join(', ') + ')' : ''}\n🔒 Locked: **${lock.length}**\n\nAttend sessions in an area to unlock its next node. 💪`;
  }
  if (/cert/.test(ml)) {
    const c = d.certificates || [];
    if (!c.length) return "You don't have certificates yet. Attend at least 80% of a session to earn one! 🏆";
    return `You have **${c.length} certificate${c.length === 1 ? '' : 's'}** 🏆\n` + c.slice(0, 5).map((x, i) => `${i + 1}. ${x.title} (${fmtDateShort(x.issued_at)})`).join('\n') + '\n\nOpen the Certificates page to view them.';
  }
  return 'I can help with your next session, attendance, skill tree, and certificates. Try one of the buttons below! 😊';
}
function adminBotReply(ml) {
  const d = ad(), o = d.overview || {};
  if (!adminData) return "I couldn't load the dashboard data right now. Please refresh the page.";
  if (/last session/.test(ml)) {
    const s = (d.sessions || []).filter(isPastSession).filter(x => x.status !== 'Cancelled')[0];
    if (!s) return 'No session has finished yet. 📅';
    return `The last session was **${s.title}** (${fmtDate(s.start)}). ${fmtInt(s.attended)}/${fmtInt(s.registered)} registered members attended. ${fmtInt(s.certs)} certificate(s) issued. Revenue: ${fmtMoney(s.revenue)}.`;
  }
  if (/sync|pending csv|awaiting/.test(ml)) {
    const list = (d.sessions || []).filter(s => isPastSession(s) && s.status !== 'Cancelled' && Number(s.registered) && !Number(s.log_count));
    if (!list.length) return 'All finished sessions have their attendance synced. ✅';
    return `**${list.length} session(s)** awaiting attendance sync:\n` + list.slice(0, 5).map(s => `• ${s.title} (${fmtDateShort(s.start)})`).join('\n') + '\n\nGo to Certificate Management → Sync Now.';
  }
  if (/payment|revenue/.test(ml)) {
    return `Payment summary:\n💚 Collected: **${fmtMoney(o.revenue_total)}** (${fmtMoney(o.revenue_month)} this month)\n⏳ Pending: **${fmtMoney(o.pending_amount)}** (${fmtInt(o.pending_payments)} payment(s))\n🎁 Waivers: ${fmtInt(o.waivers)}\nTotal transactions: ${fmtInt(o.transactions)}`;
  }
  if (/popular|area|expertise/.test(ml)) {
    const a = (d.by_area || []).filter(x => x.rate != null);
    if (!a.length) return 'Not enough attendance data to rank areas yet. 🎯';
    return `The best-attended area is **${a[0].name}** at ${a[0].rate}% attendance.` + (a[1] ? ` ${a[1].name} follows at ${a[1].rate}%.` : '');
  }
  if (/cert/.test(ml)) return `Certificates: **${fmtInt(o.certs_month)}** issued this month, **${fmtInt(o.certs_total)}** in total. 🏆`;
  if (/attendance/.test(ml)) {
    const p = (d.by_province || []).filter(x => x.rate != null);
    return `Average attendance is **${fmtPct(o.attendance_rate)}**.` + (p.length > 1 ? ` ${p[0].name} leads at ${p[0].rate}%, ${p[p.length - 1].name} is lowest at ${p[p.length - 1].rate}%.` : '');
  }
  if (/member/.test(ml)) return `There are **${fmtInt(o.total_members)} members** (${fmtInt(o.new_members_month)} new this month).`;
  return 'I can help with session stats, attendance sync, member numbers, certificates, and payment summaries. Try one of the buttons below! 🤖';
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
  const ml = msg.toLowerCase();
  const reply = currentRole === 'admin' ? adminBotReply(ml) : memberBotReply(ml);
  setTimeout(()=>{
    msgs.innerHTML+=`<div class="bmsg b">${esc(reply).replace(/\n/g,'<br>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')}</div>`;
    msgs.scrollTop=msgs.scrollHeight;
  },400);
  msgs.scrollTop=msgs.scrollHeight;
  if(!botOpen)toggleBot();
}
function escapeHtml(s){ return esc(s); }

// ════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('m-today').textContent = todayStr();
  document.getElementById('a-date').textContent = todayStr();
});
loadPublicStats();