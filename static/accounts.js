function el(id) { return document.getElementById(id); }
function showTopAlert(msg) {
  const n = el('topLoginAlert');
  if (!n) return;
  n.style.display = 'block';
  n.textContent = msg;
}
function hideTopAlert() {
  const n = el('topLoginAlert');
  if (!n) return;
  n.style.display = 'none';
  n.textContent = '';
}

/* --- API HELPERS --- */
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

/* --- BOX HANDLER --- */
function showBox(id) {
  ['loginBox', 'registerBox', 'forgotBox', 'resetBox', 'profileArea'].forEach(k => {
    const e = el(k);
    if (e) e.classList.add('hidden');
  });
  el(id)?.classList.remove('hidden');
}

function showLogin() { showBox('loginBox'); }
function showRegisterBox() { showBox('registerBox'); }
function showForgotBox() { showBox('forgotBox'); }
function showResetBox() { showBox('resetBox'); }
function showProfileArea() { showBox('profileArea'); }

/* --- LOGIN --- */
async function loginHandler() {
  hideTopAlert();
  const username = (el('loginUsername')?.value || '').trim();
  const password = (el('loginPassword')?.value || '');
  if (!username || !password) return showTopAlert('Fill in all fields');

  try {
    const res = await apiPost('/accounts/login', { username, password });
    if (res?.user) {
      await refreshProfile();
      window.location.href = '/todo';
    }
  } catch (err) {
    showTopAlert(normalizeErrorMessage(err));
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
    showTopAlert(normalizeErrorMessage(err));
  }
}

/* --- PROFILE --- */
async function refreshProfile() {
  try {
    const who = await apiGet('/accounts/whoami');
    if (who.authenticated) {
      const prof = await apiGet('/accounts/profile');
      const user = prof.user;

      // Show user info beside labels
      el('meUsername').textContent = `Username: ${user.username}`;
      el('meName').textContent = `Name: ${user.name}`;

      showProfileArea();
      return true;
    } else {
      showLogin();
    }
  } catch (err) {
    showLogin();
  }
}

/* --- EDIT PROFILE --- */
async function saveProfile() {
  hideTopAlert();
  const name = (el('editName')?.value || '').trim();
  const username = (el('editUsername')?.value || '').trim();

  try {
    const res = await fetch('/accounts/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username })
    });

    if (res.ok) {
      showTopAlert('Profile updated successfully!');
      el('editFields').classList.add('hidden');
      await refreshProfile();
    } else {
      const err = await res.json();
      showTopAlert(err.error || 'Profile update failed');
    }
  } catch (err) {
    showTopAlert('Update failed');
  }
}

/* --- CHANGE PASSWORD --- */
async function changePasswordHandler() {
  hideTopAlert();
  const current_password = (el('currentPassword')?.value || '').trim();
  const new_password = (el('newPassword')?.value || '').trim();

  if (!current_password || !new_password) return showTopAlert('Fill all fields');

  try {
    await apiPost('/accounts/change_password', { current_password, new_password });
    showTopAlert('Password changed successfully');
    el('currentPassword').value = '';
    el('newPassword').value = '';
    el('changePasswordFields').classList.add('hidden');
  } catch (err) {
    showTopAlert(normalizeErrorMessage(err));
  }
}

/* --- FORGOT PASSWORD --- */
async function forgotPasswordHandler() {
  hideTopAlert();
  const username = (el('forgotUsername')?.value || '').trim();
  if (!username) return showTopAlert('Enter your email');

  try {
    const res = await apiPost('/accounts/forgot', { username });
    showTopAlert(res.message || 'Check your email for reset code');
    showResetBox();
  } catch (err) {
    showTopAlert(normalizeErrorMessage(err));
  }
}

async function resetPasswordHandler() {
  hideTopAlert();
  const username = (el('resetUsername')?.value || '').trim();
  const token = (el('resetToken')?.value || '').trim();
  const new_password = (el('resetNewPw')?.value || '').trim();

  if (!username || !token || !new_password) return showTopAlert('Fill all fields');

  try {
    const res = await apiPost('/accounts/reset', { username, token, new_password });
    showTopAlert(res.message || 'Password reset successful');
    showLogin();
  } catch (err) {
    showTopAlert(normalizeErrorMessage(err));
  }
}

/* --- LOGOUT --- */
async function logout() {
  await apiPost('/accounts/logout', {});
  showLogin();
  showTopAlert('Logged out');
}

/* --- BIND --- */
function bind() {
  el('loginBtn')?.addEventListener('click', loginHandler);
  el('registerBtn')?.addEventListener('click', registerHandler);
  el('forgotBtn')?.addEventListener('click', forgotPasswordHandler);
  el('resetBtn')?.addEventListener('click', resetPasswordHandler);
  el('saveProfileBtn')?.addEventListener('click', saveProfile);
  el('savePasswordBtn')?.addEventListener('click', changePasswordHandler);
  el('logoutBtn')?.addEventListener('click', logout);

  el('cancelRegister')?.addEventListener('click', showLogin);
  el('showRegisterLink')?.addEventListener('click', e => { e.preventDefault(); showRegisterBox(); });
  el('showForgotLink')?.addEventListener('click', e => { e.preventDefault(); showForgotBox(); });

  // Profile buttons
  el('editProfileBtn')?.addEventListener('click', () => {
    el('editFields').classList.remove('hidden');
    el('editUsername').value = el('meUsername').textContent.replace('Username: ', '');
    el('editName').value = el('meName').textContent.replace('Name: ', '');
  });

  el('cancelEditBtn')?.addEventListener('click', () => {
    el('editFields').classList.add('hidden');
  });

  el('changePasswordBtn')?.addEventListener('click', () => {
    el('changePasswordFields').classList.remove('hidden');
  });

  el('cancelPasswordBtn')?.addEventListener('click', () => {
    el('changePasswordFields').classList.add('hidden');
  });

  el('backToTasksBtn')?.addEventListener('click', () => {
    window.location.href = '/todo';
  });
}

/* --- INIT --- */
document.addEventListener('DOMContentLoaded', async () => {
  bind();
  await refreshProfile();
});
