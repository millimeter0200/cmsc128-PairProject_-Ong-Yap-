// static/accounts.js
// Full client for accounts page: login, register, forgot (OTP demo), reset, profile.

function el(id){ return document.getElementById(id); } //
function showTopAlert(msg){
  const n = el('topLoginAlert'); if(!n) return;
  n.classList.remove('hidden'); n.style.display='block'; n.textContent = msg;
}
function hideTopAlert(){ const n = el('topLoginAlert'); if(!n) return; n.classList.add('hidden'); n.style.display='none'; n.textContent=''; }

async function apiPost(url, data){
  const res = await fetch(url, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(data)
  });
  let json = null; try{ json = await res.json(); } catch(e){ json = null; }
  if(!res.ok) throw json || { error:`Request failed (${res.status})` };
  return json;
}
async function apiGet(url){
  const res = await fetch(url);
  let json = null; try{ json = await res.json(); } catch(e){ json = null; }
  if(!res.ok) throw json || { error:`Request failed (${res.status})` };
  return json;
}

function normalizeErrorMessage(err){
  if(!err) return 'Operation failed.';
  if(typeof err === 'string') return err;
  if(err.error) {
    const s = String(err.error).toLowerCase();
    if(s.includes('credential')) return 'Invalid username or password.';
    return err.error;
  }
  return JSON.stringify(err);
}

/* UI box toggles */
function showBox(id){
  const boxes = ['loginBox','registerBox','forgotBox','resetBox','profileArea'];
  boxes.forEach(k => { const n = el(k); if(!n) return; if(k===id) n.classList.remove('hidden'); else n.classList.add('hidden'); });
  hideTopAlert();
}
function showLogin(){ showBox('loginBox'); }
function showRegisterBox(){ showBox('registerBox'); }
function showForgotBox(){ showBox('forgotBox'); }
function showResetBox(){ showBox('resetBox'); }
function showProfileArea(){ showBox('profileArea'); }

/* ---- Handlers ---- */

async function loginHandler(){
  hideTopAlert();
  const username = (el('loginUsername') && el('loginUsername').value || '').trim();
  const password = (el('loginPassword') && el('loginPassword').value) || '';
  if(!username || !password){ showTopAlert('Invalid username or password.'); return; }
  try {
    await apiPost('/accounts/login', { username, password });
    // showSnackbar if available
    if(typeof showSnackbar === 'function') showSnackbar('Logged in', 'success');
    await refreshProfile();
    showProfileArea();
  } catch(err){
    showTopAlert(normalizeErrorMessage(err));
  }
}

async function registerHandler(){
  hideTopAlert();
  const name = (el('regName') && el('regName').value || '').trim();
  const username = (el('regUsername') && el('regUsername').value || '').trim();
  const pw = (el('regPassword') && el('regPassword').value) || '';
  const pwc = (el('regPasswordConfirm') && el('regPasswordConfirm').value) || '';
  if(!name || !username || !pw){ showTopAlert('Fill all fields.'); return; }
  if(pw !== pwc){ showTopAlert('Passwords do not match.'); return; }
  try {
    await apiPost('/accounts/register', { name, username, password: pw });
    if(typeof showSnackbar === 'function') showSnackbar('Account created. You may now login.','success');
    // auto-switch to login
    showLogin();
  } catch(err){
    showTopAlert(normalizeErrorMessage(err));
  }
}

async function forgotHandler(){
  hideTopAlert();
  // This handler acts as a step flow:
  // - If OTP not yet requested, request and show token and show code + new password fields.
  // - If OTP is shown and user filled code & new pw, call reset endpoint.
  const username = (el('forgotUsername') && el('forgotUsername').value || '').trim();
  if(!username){ showTopAlert('Enter username'); return; }

  // If OTP input currently hidden -> request OTP
  const otpInput = el('forgotOtpInput');
  const newPwBox = el('forgotNewPw');
  if(otpInput.classList.contains('hidden')){
    // request token
    try {
      const res = await apiPost('/accounts/forgot', { username });
      // show returned token (demo only)
      const display = el('forgotOtpDisplay');
      if(display) {
        display.classList.remove('hidden');
        display.textContent = `Demo code: ${res.reset_token}`;
      }
      // reveal otp input and new password input
      otpInput.classList.remove('hidden');
      newPwBox.classList.remove('hidden');
      // change Next button text to "Reset"
      const btn = el('forgotBtn'); if(btn) btn.textContent = 'Reset';
      if(typeof showSnackbar === 'function') showSnackbar('Code generated (demo).', 'success');
    } catch(err){
      showTopAlert(normalizeErrorMessage(err));
    }
    return;
  }

  // If OTP input visible -> perform reset
  const token = (el('forgotCode') && el('forgotCode').value || '').trim();
  const newpw = (el('forgotNewPassword') && el('forgotNewPassword').value) || '';
  if(!token || !newpw){ showTopAlert('Enter code and new password.'); return; }
  try {
    await apiPost('/accounts/reset', { username, token, new_password: newpw });
    if(typeof showSnackbar === 'function') showSnackbar('Password reset. You may now login.','success');
    // reset form and go to login
    el('forgotUsername').value = ''; if(el('forgotCode')) el('forgotCode').value = ''; if(el('forgotNewPassword')) el('forgotNewPassword').value = '';
    el('forgotOtpDisplay').classList.add('hidden'); el('forgotOtpInput').classList.add('hidden'); el('forgotNewPw').classList.add('hidden');
    el('forgotBtn').textContent = 'Next';
    showLogin();
  } catch(err){
    showTopAlert(normalizeErrorMessage(err));
  }
}

async function resetHandler(){ // alternate reset route (if used)
  hideTopAlert();
  const username = (el('resetUsername') && el('resetUsername').value || '').trim();
  const code = (el('resetCode') && el('resetCode').value || '').trim();
  const newpw = (el('resetNewpw') && el('resetNewpw').value) || '';
  if(!username || !code || !newpw){ showTopAlert('Fill all reset fields'); return; }
  try {
    await apiPost('/accounts/reset', { username, token: code, new_password: newpw });
    if(typeof showSnackbar === 'function') showSnackbar('Password reset. You may now login.', 'success');
    showLogin();
  } catch(err){ showTopAlert(normalizeErrorMessage(err)); }
}

async function refreshProfile(){
  try {
    const who = await apiGet('/accounts/whoami');
    if(who && who.authenticated){
      const prof = await apiGet('/accounts/profile');
      const user = prof && prof.user ? prof.user : {};
      if(el('meUsername')) el('meUsername').textContent = user.username || '';
      if(el('meName')) el('meName').textContent = user.name || '';
      showProfileArea();
      return true;
    } else {
      showLogin();
      return false;
    }
  } catch(e){
    showLogin();
    return false;
  }
} //refresh profile works through whoami endpoint to check if logged in, then gets profile data to display
//stays consistent because profile data is fetched from server each time

async function saveProfile(){
  hideTopAlert();
  const name = (el('newName') && el('newName').value.trim()) || undefined;
  const username = (el('newUsername') && el('newUsername').value.trim()) || undefined;
  try {
    const res = await fetch('/accounts/profile', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, username }) });
    const json = await res.json();
    if(!res.ok) throw json;
    if(typeof showSnackbar === 'function') showSnackbar('Profile updated','success');
    el('newName').value = el('newUsername').value = '';
    await refreshProfile();
  } catch(err){ showTopAlert(normalizeErrorMessage(err)); }
}

async function changePassword(){
  hideTopAlert();
  const current = (el('currentPw') && el('currentPw').value) || '';
  const newpw = (el('newPw') && el('newPw').value) || '';
  if(!current || !newpw){ showTopAlert('Fill both fields'); return; }
  try {
    const res = await fetch('/accounts/change_password', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ current_password: current, new_password: newpw }) });
    const json = await res.json();
    if(!res.ok) throw json;
    if(typeof showSnackbar === 'function') showSnackbar('Password changed','success');
    el('currentPw').value = el('newPw').value = '';
  } catch(err){ showTopAlert(normalizeErrorMessage(err)); }
}

async function logout(){
  try { await apiPost('/accounts/logout', {}); } catch(e){ /* ignore */ }
  showLogin();
  if(typeof showSnackbar === 'function') showSnackbar('Logged out','success');
}

/* ----- bind events & keyboard (Enter) ----- */
function bindCommon(){
  // login
  if(el('loginBtn')) el('loginBtn').addEventListener('click', loginHandler);
  // register
  if(el('registerBtn')) el('registerBtn').addEventListener('click', registerHandler);
  if(el('cancelRegister')) el('cancelRegister').addEventListener('click', (e)=>{ e.preventDefault(); showLogin(); });

  // forgot
  if(el('forgotBtn')) el('forgotBtn').addEventListener('click', forgotHandler);
  if(el('cancelForgot')) el('cancelForgot').addEventListener('click', (e)=>{ e.preventDefault(); showLogin(); });

  // reset
  if(el('resetBtn')) el('resetBtn').addEventListener('click', resetHandler);
  if(el('cancelReset')) el('cancelReset').addEventListener('click', (e)=>{ e.preventDefault(); showLogin(); });

  // profile actions
  if(el('saveProfileBtn')) el('saveProfileBtn').addEventListener('click', saveProfile);
  if(el('changePwBtn')) el('changePwBtn').addEventListener('click', changePassword);
  if(el('logoutBtn')) el('logoutBtn').addEventListener('click', logout);

  // links to toggle
  if(el('showRegisterLink')) el('showRegisterLink').addEventListener('click',(e)=>{ e.preventDefault(); showRegisterBox(); });
  if(el('showForgotLink')) el('showForgotLink').addEventListener('click',(e)=>{ e.preventDefault(); showForgotBox(); });

  // Enter key submit for login fields
  ['loginUsername','loginPassword'].forEach(id=>{
    const n = el(id); if(!n) return;
    n.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); loginHandler(); } });
    n.addEventListener('input', ()=> hideTopAlert());
    n.addEventListener('change', ()=> hideTopAlert());
  });

  // register enter key convenience
  ['regName','regUsername','regPassword','regPasswordConfirm'].forEach(id=>{
    const n = el(id); if(!n) return;
    n.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); registerHandler(); }});
  });

  // forgot/reset enter
  if(el('forgotUsername')) el('forgotUsername').addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); forgotHandler(); }});
  ['forgotCode','forgotNewPassword','resetUsername','resetCode','resetNewpw'].forEach(id=>{
    const n=el(id); if(!n) return; n.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); forgotHandler(); } });
  });
}

/* Initialize on DOM ready */
document.addEventListener('DOMContentLoaded', async ()=>{
  bindCommon();
  // attempt to show profile if already logged in
  try { await refreshProfile(); } catch(e){ showLogin(); }
});
