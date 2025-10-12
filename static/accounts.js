// accounts.js - simple client for accounts endpoints

function el(id) { return document.getElementById(id); }
function showMsg(msg, error=false) {
    const sn = el('accountsSnackbar');
    sn.style.color = error ? 'crimson' : 'green';
    sn.textContent = msg;
    setTimeout(()=>{ sn.textContent = ''; }, 6000);
}

// helpers to show/hide boxes
function showRegister(show) { el('registerBox').style.display = show ? 'block' : 'none'; }
function showForgot(show) { el('forgotBox').style.display = show ? 'block' : 'none'; }

async function apiPost(url, data) {
    const res = await fetch(url, {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!res.ok) throw json;
    return json;
}

async function apiGet(url) {
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) throw json;
    return json;
}

// registration
el('showRegisterBtn').addEventListener('click', ()=>showRegister(true));
el('hideRegisterBtn').addEventListener('click', ()=>showRegister(false));
el('registerBtn').addEventListener('click', async ()=>{
    const name = el('regName').value.trim();
    const username = el('regUsername').value.trim();
    const password = el('regPassword').value;
    if (!name || !username || !password) { showMsg('Please fill all fields', true); return; }
    try {
        const res = await apiPost('/accounts/register', { name, username, password });
        showMsg('Account created. You may now login.');
        showRegister(false);
        el('regName').value = el('regUsername').value = el('regPassword').value = '';
    } catch (err) {
        showMsg(err.error || 'Registration failed', true);
    }
});

// login
el('loginBtn').addEventListener('click', async ()=>{
    const username = el('loginUsername').value.trim();
    const password = el('loginPassword').value;
    if (!username || !password) { showMsg('Enter credentials', true); return; }
    try {
        await apiPost('/accounts/login', { username, password });
        showMsg('Logged in');
        await refreshProfile(); // show profile area
    } catch (err) {
        showMsg(err.error || 'Login failed', true);
    }
});

// forgot
el('showForgot').addEventListener('click', ()=> showForgot(true));
el('hideForgotBtn').addEventListener('click', ()=> showForgot(false));
el('forgotBtn').addEventListener('click', async ()=>{
    const username = el('forgotUsername').value.trim();
    if (!username) { showMsg('Enter username', true); return; }
    try {
        const res = await apiPost('/accounts/forgot', { username });
        el('forgotResult').style.display = 'block';
        el('forgotResult').textContent = JSON.stringify(res, null, 2);
        showMsg('Reset token generated (shown below).');
        // Show reset box now that a token has been generated
        el('resetBox').style.display = 'block';
    } catch (err) {
        showMsg(err.error || 'Failed', true);
    }
});

// reset using token
el('resetBtn').addEventListener('click', async ()=>{
    const username = el('resetUsername').value.trim();
    const token = el('resetToken').value.trim();
    const newpw = el('resetNewpw').value;
    if (!username || !token || !newpw) { showMsg('Fill all reset fields', true); return; }
    try {
        await apiPost('/accounts/reset', { username, token, new_password: newpw });
        showMsg('Password reset. You may now login.');
        el('resetBox').style.display = 'none';  // hide the Reset Password box after success
        el('resetUsername').value = el('resetToken').value = el('resetNewpw').value = '';
    } catch (err) {
        showMsg(err.error || 'Reset failed', true);
    }
});

// profile helpers
async function refreshProfile() {
    try {
        const who = await apiGet('/accounts/whoami');
        if (who.authenticated) {
            const me = (await apiGet('/accounts/profile')).user;
            el('profileArea').style.display = 'block';
            el('authArea').style.display = 'none';
            el('meUsername').textContent = me.username;
            el('meName').textContent = me.name;
        } else {
            el('profileArea').style.display = 'none';
            el('authArea').style.display = 'block';
        }
    } catch (err) {
        el('profileArea').style.display = 'none';
        el('authArea').style.display = 'block';
    }
}

el('saveProfileBtn').addEventListener('click', async ()=>{
    const newName = el('newName').value.trim();
    const newUsername = el('newUsername').value.trim();
    try {
        const res = await fetch('/accounts/profile', {
            method: 'PUT',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ name: newName || undefined, username: newUsername || undefined })
        });
        const json = await res.json();
        if (!res.ok) throw json;
        showMsg('Profile updated');
        el('newName').value = el('newUsername').value = '';
        await refreshProfile();
    } catch (err) {
        showMsg(err.error || 'Update failed', true);
    }
});

el('changePwBtn').addEventListener('click', async ()=>{
    const current = el('currentPw').value;
    const newpw = el('newPw').value;
    if (!current || !newpw) { showMsg('Fill both fields', true); return; }
    try {
        const res = await fetch('/accounts/change_password', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ current_password: current, new_password: newpw })
        });
        const json = await res.json();
        if (!res.ok) throw json;
        showMsg('Password changed');
        el('currentPw').value = el('newPw').value = '';
    } catch (err) {
        showMsg(err.error || 'Change password failed', true);
    }
});

el('logoutBtn').addEventListener('click', async ()=>{
    await apiPost('/accounts/logout', {});
    showMsg('Logged out');
    await refreshProfile();
});

// initialize view
document.addEventListener('DOMContentLoaded', ()=> {
    // ensure boxes start hidden
    showRegister(false);
    showForgot(false);
    refreshProfile();
});
