function el(id) { return document.getElementById(id); }
function showTopAlert(msg) { const n = el('topLoginAlert'); if (!n) return; n.style.display = 'block'; n.textContent = msg; }
function hideTopAlert() { const n = el('topLoginAlert'); if (!n) return; n.style.display = 'none'; n.textContent = ''; }

async function apiPost(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw json;
  return json;
}

async function apiGet(url) {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw json;
  return json;
}

function normalizeErrorMessage(err) {
  if (!err) return 'Request failed';
  if (typeof err === 'string') return err;
  if (err.error) return err.error;
  return JSON.stringify(err);
}

function showBox(id) {
  ['loginBox', 'registerBox', 'forgotBox', 'profileArea'].forEach(k => {
    const e = el(k);
    if (e) e.classList.add('hidden');
  });
  el(id)?.classList.remove('hidden');
}

function showLogin() { showBox('loginBox'); }
function showRegisterBox() { showBox('registerBox'); }
function showForgotBox() { showBox('forgotBox'); }
function showProfileArea() { showBox('profileArea'); }

/* --- LOGIN --- */
async function loginHandler() {
  hideTopAlert();
  const username = (el('loginUsername')?.value || '').trim();
  const password = (el('loginPassword')?.value || '');
  if (!username || !password) return showTopAlert('Fill in all fields');
  try {
    await apiPost('/accounts/login', { username, password });
    await refreshProfile();
    showProfileArea();
  } catch (err) {
    showTopAlert(err.error || 'Login failed');
  }
}

/* --- REGISTER --- */
async function registerHandler() {
  hideTopAlert();
  const name = (el('regName')?.value || '').trim();
  const username = (el('regUsername')?.value || '').trim();
  const pw = (el('regPassword')?.value || '');
  const pwc = (el('regPasswordConfirm')?.value || '');
  if (!name || !username || !pw) return showTopAlert('Fill all fields');
  if (pw !== pwc) return showTopAlert('Passwords do not match');
  try {
    await apiPost('/accounts/register', { name, username, password: pw });
    showTopAlert('Account created. You may now log in.');
    showLogin();
  } catch (err) {
    showTopAlert(err.error || 'Registration failed');
  }
}

/* --- FORGOT PASSWORD (2-step OTP simulation) --- */
let forgotStep = 1;   // 1 = send code, 2 = reset password
let forgotUser = null;
let forgotCode = null;

async function forgotHandler() {
  hideTopAlert();

  // Step 1: Send OTP
  if (forgotStep === 1) {
    const username = (el('forgotUsername')?.value || '').trim();
    if (!username) return showTopAlert('Enter username');

    try {
      const res = await apiPost('/accounts/forgot', { username });

      forgotUser = username;
      forgotCode = res.reset_token;

      console.log(`📧 [SIMULATED EMAIL] Reset code for '${username}': ${forgotCode}`);

      el('forgotOtpDisplay').classList.remove('hidden');
      el('forgotOtpDisplay').textContent = 'A reset code has been sent to your email (check console).';
      el('forgotOtpInput').classList.remove('hidden');
      el('forgotNewPw').classList.remove('hidden');

      el('forgotBtn').textContent = 'Change Password';
      forgotStep = 2;
    } catch (err) {
      showTopAlert(normalizeErrorMessage(err));
    }
    return;
  }

  // Step 2: Verify code and change password
  if (forgotStep === 2) {
    const enteredCode = (el('forgotCode')?.value || '').trim();
    const newPassword = (el('forgotNewPassword')?.value || '').trim();

    if (!enteredCode || !newPassword) {
      showTopAlert('Enter both code and new password.');
      return;
    }

    try {
      await apiPost('/accounts/reset', {
        username: forgotUser,
        token: enteredCode,
        new_password: newPassword
      });

      showTopAlert('Password successfully reset. You may now log in.');

      // Reset step state
      forgotStep = 1;
      forgotUser = null;
      forgotCode = null;
      el('forgotBtn').textContent = 'Next';
      el('forgotCode').value = '';
      el('forgotNewPassword').value = '';

      showLogin();
    } catch (err) {
      showTopAlert(normalizeErrorMessage(err));
    }
  }
}

/* --- PROFILE --- */
async function refreshProfile() {
  try {
    const who = await apiGet('/accounts/whoami');
    if (who.authenticated) {
      const prof = await apiGet('/accounts/profile');
      const user = prof.user;
      el('meUsername').textContent = user.username;
      el('meName').textContent = user.name;
      showProfileArea();
      return true;
    } else showLogin();
  } catch {
    showLogin();
  }
}

async function saveProfile() {
  hideTopAlert();
  const name = (el('newName')?.value || '').trim();
  const username = (el('newUsername')?.value || '').trim();
  try {
    await fetch('/accounts/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username })
    });
    showTopAlert('Profile updated');
    el('newName').value = el('newUsername').value = '';
    await refreshProfile();
  } catch (err) {
    showTopAlert('Update failed');
  }
}

async function changePassword() {
  hideTopAlert();
  const current = (el('currentPw')?.value || '');
  const newpw = (el('newPw')?.value || '');
  if (!current || !newpw) return showTopAlert('Fill both fields');
  try {
    await apiPost('/accounts/change_password', { current_password: current, new_password: newpw });
    showTopAlert('Password changed');
    el('currentPw').value = el('newPw').value = '';
  } catch (err) {
    showTopAlert(err.error || 'Change failed');
  }
}

async function logout() {
  await apiPost('/accounts/logout', {});
  showLogin();
  showTopAlert('Logged out');
}

/* --- BIND --- */
function bind() {
  el('loginBtn')?.addEventListener('click', loginHandler);
  el('registerBtn')?.addEventListener('click', registerHandler);
  el('cancelRegister')?.addEventListener('click', () => showLogin());
  el('showRegisterLink')?.addEventListener('click', (e) => { e.preventDefault(); showRegisterBox(); });
  el('showForgotLink')?.addEventListener('click', (e) => { e.preventDefault(); showForgotBox(); });
  el('forgotBtn')?.addEventListener('click', forgotHandler);
  el('cancelForgot')?.addEventListener('click', () => {
    forgotStep = 1;
    forgotUser = null;
    forgotCode = null;
    el('forgotBtn').textContent = 'Next';
    showLogin();
  });
  el('saveProfileBtn')?.addEventListener('click', saveProfile);
  el('changePwBtn')?.addEventListener('click', changePassword);
  el('logoutBtn')?.addEventListener('click', logout);
}

/* --- INIT --- */
document.addEventListener('DOMContentLoaded', async () => {
  bind();
  await refreshProfile();
});
