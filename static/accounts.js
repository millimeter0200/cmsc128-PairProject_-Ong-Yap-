/********************************************
 * SIMPLE HELPERS
 ********************************************/
function el(id) {
    return document.getElementById(id);
}

function showTopAlert(msg) {
    const n = el("topLoginAlert");
    if (!n) return;
    n.style.display = "block";
    n.textContent = msg;
}

function hideTopAlert() {
    const n = el("topLoginAlert");
    if (!n) return;
    n.style.display = "none";
    n.textContent = "";
}

/********************************************
 * FETCH HELPERS
 ********************************************/
async function apiPost(url, data) {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    if (!err) return "Request failed";
    if (typeof err === "string") return err;
    if (err.error) return err.error;
    return JSON.stringify(err);
}

/********************************************
 * SCREEN HANDLING
 ********************************************/
function showBox(id) {
    ["loginBox", "registerBox", "forgotBox", "resetBox", "profileArea"].forEach(k => {
        const e = el(k);
        if (e) e.classList.add("hidden");
    });
    el(id)?.classList.remove("hidden");
}

function showLogin() { showBox("loginBox"); }
function showRegisterBox() { showBox("registerBox"); }
function showForgotBox() { showBox("forgotBox"); }
function showResetBox() { showBox("resetBox"); }
function showProfileArea() { showBox("profileArea"); }

/********************************************
 * LOGIN
 ********************************************/
async function loginHandler() {
    hideTopAlert();
    const username = el("loginUsername").value.trim();
    const password = el("loginPassword").value;

    if (!username || !password)
        return showTopAlert("Fill in all fields");

    try {
        const res = await apiPost("/accounts/login", { username, password });
        if (res.user) {
            await refreshProfile();
            window.location.href = "/todo";
        }
    } catch (err) {
        showTopAlert(normalizeErrorMessage(err));
    }
}

/********************************************
 * REGISTER
 ********************************************/
async function registerHandler() {
    hideTopAlert();
    const name = el("regName").value.trim();
    const username = el("regUsername").value.trim();
    const email = el("regEmail").value.trim();
    const pw = el("regPassword").value;
    const pwc = el("regPasswordConfirm").value;

    if (!name || !username || !email || !pw || !pwc)
        return showTopAlert("Fill all fields");

    if (pw !== pwc)
        return showTopAlert("Passwords do not match");

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email))
        return showTopAlert("Enter a valid email");

    try {
        await apiPost("/accounts/register", { name, username, email, password: pw });
        showTopAlert("Account created. You may now log in.");
        showLogin();
    } catch (err) {
        showTopAlert(normalizeErrorMessage(err));
    }
}

/********************************************
 * PROFILE
 ********************************************/
let originalName = "";
let originalUsername = "";
let originalEmail = "";

async function refreshProfile() {
    try {
        const who = await apiGet("/accounts/whoami");
        if (!who.authenticated) {
            showLogin();
            return false;
        }

        const prof = await apiGet("/accounts/profile");
        const user = prof.user;

        el("meName").textContent = user.name;
        el("meUsername").textContent = user.username;
        el("meEmail").textContent = user.email;

        originalName = user.name;
        originalUsername = user.username;
        originalEmail = user.email;

        showProfileArea();
        return true;
    } catch (err) {
        console.error(err);
        showTopAlert("Failed to load profile");
        showLogin();
        return false;
    }
}

function enableEditMode() {
    ["meName", "meUsername"].forEach(id => {
        const span = el(id);
        span.contentEditable = true;
        span.classList.add("editable-span");
    });

    el("editProfileBtn").classList.add("hidden");
    el("saveProfileBtn").classList.remove("hidden");
    el("cancelEditBtn").classList.remove("hidden");
}

function disableEditMode() {
    ["meName", "meUsername"].forEach(id => {
        const span = el(id);
        span.contentEditable = false;
        span.classList.remove("editable-span");
    });

    el("editProfileBtn").classList.remove("hidden");
    el("saveProfileBtn").classList.add("hidden");
    el("cancelEditBtn").classList.add("hidden");
}

function cancelEdit() {
    el("meName").textContent = originalName;
    el("meUsername").textContent = originalUsername;
    disableEditMode();
}

async function saveProfile() {
    hideTopAlert();

    const name = el("meName").textContent.trim();
    const username = el("meUsername").textContent.trim();

    try {
        const res = await fetch("/accounts/profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, username })
        });

        if (res.ok) {
            showTopAlert("Profile updated!");
            disableEditMode();
            refreshProfile();
        } else {
            const err = await res.json();
            showTopAlert(err.error || "Update failed");
        }
    } catch (err) {
        showTopAlert("Update failed");
    }
}

/********************************************
 * CHANGE PASSWORD — POPUP VERSION
 ********************************************/
function setupPasswordModal() {
    const openBtn = el("changePwBtn");
    const modal = el("changePasswordModal");
    const cancelBtn = el("modalCancelPwBtn");
    const saveBtn = el("modalSavePwBtn");

    if (openBtn)
        openBtn.addEventListener("click", () => {
            modal.classList.remove("hidden");
        });

    if (cancelBtn)
        cancelBtn.addEventListener("click", () => {
            modal.classList.add("hidden");
        });

    if (saveBtn)
        saveBtn.addEventListener("click", async () => {
            const current = el("cp_current").value.trim();
            const next = el("cp_new").value.trim();

            if (!current || !next) {
                alert("Please fill all fields.");
                return;
            }

            const res = await apiPost("/accounts/change_password", {
                current_password: current,
                new_password: next
            }).catch(err => err);

            if (res.error) {
                alert(res.error);
                return;
            }

            alert("Password updated successfully!");
            modal.classList.add("hidden");
        });
}

/********************************************
 * FORGOT / RESET PASSWORD
 ********************************************/
async function forgotPasswordHandler() {
    hideTopAlert();
    const username = el("forgotUsername").value.trim();
    const email = el("forgotEmail").value.trim();

    if (!username || !email)
        return showTopAlert("Enter both username and email");

    try {
        const res = await apiPost("/accounts/forgot", { username, email });
        showTopAlert(res.message || "Reset code sent.");
        showResetBox();
    } catch (err) {
        showTopAlert(normalizeErrorMessage(err));
    }
}

async function resetPasswordHandler() {
    hideTopAlert();

    const username = el("resetUsername").value.trim();
    const token = el("resetToken").value.trim();
    const newPw = el("resetNewPw").value.trim();

    if (!username || !token || !newPw)
        return showTopAlert("Fill all fields");

    try {
        const res = await apiPost("/accounts/reset", { username, token, new_password: newPw });
        showTopAlert(res.message || "Password reset.");
        showLogin();
    } catch (err) {
        showTopAlert(normalizeErrorMessage(err));
    }
}

/********************************************
 * LOGOUT
 ********************************************/
async function logout() {
    await apiPost("/accounts/logout", {});
    showLogin();
    showTopAlert("Logged out");
}

/********************************************
 * EVENT BINDING
 ********************************************/
function bind() {
    el("loginBtn")?.addEventListener("click", loginHandler);
    el("registerBtn")?.addEventListener("click", registerHandler);
    el("forgotBtn")?.addEventListener("click", forgotPasswordHandler);
    el("resetBtn")?.addEventListener("click", resetPasswordHandler);

    el("editProfileBtn")?.addEventListener("click", enableEditMode);
    el("saveProfileBtn")?.addEventListener("click", saveProfile);
    el("cancelEditBtn")?.addEventListener("click", cancelEdit);

    el("logoutBtn")?.addEventListener("click", logout);

    el("showRegisterLink")?.addEventListener("click", e => {
        e.preventDefault();
        showRegisterBox();
    });

    el("showForgotLink")?.addEventListener("click", e => {
        e.preventDefault();
        showForgotBox();
    });

    el("cancelRegister")?.addEventListener("click", showLogin);
    el("cancelReset")?.addEventListener("click", showLogin);

    el("backToTasksBtn")?.addEventListener("click", () => {
        window.location.href = "/todo";
    });
}

/********************************************
 * INIT
 ********************************************/
document.addEventListener("DOMContentLoaded", async () => {
    bind();
    setupPasswordModal();   // ← NEW POPUP
    const loggedIn = await refreshProfile();
    if (!loggedIn) showLogin();
});
