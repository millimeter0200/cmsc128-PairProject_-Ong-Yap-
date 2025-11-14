function el(id) { return document.getElementById(id); }

let currentCollabListId = null;  // track selected list

function showMessage(msg, isError=false) {
    const a = el('collabAlert');
    a.style.color = isError ? 'red' : 'green';
    a.textContent = msg;
    setTimeout(() => { a.textContent = ''; }, 4000);
}

/* --- API helpers --- */
async function apiPost(url, data) {
    const res = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
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

/* --- Load users for collaborator dropdown --- */
async function loadUsers() {
    try {
        const resp = await apiGet('/accounts/users'); // backend returns array of users
        const select = el('collabUserSelect');
        select.innerHTML = '<option value="">-- Select a user --</option>';
        resp.users.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.username;
            opt.textContent = u.username;
            select.appendChild(opt);
        });
    } catch (err) {
        showMessage('Failed to load users', true);
    }
}

/* --- Load collaborative lists --- */
async function loadCollabLists() {
    try {
        const resp = await apiGet('/collab/lists');
        const container = el('collabLists');
        container.innerHTML = '';
        resp.lists.forEach(list => {
            const div = document.createElement('div');
            div.textContent = list.name;
            div.dataset.id = list.id;
            div.addEventListener('click', (e) => selectCollabList(list, e));
            container.appendChild(div);
        });
    } catch (err) {
        showMessage('Failed to load collaborative lists', true);
    }
}

/* --- Select a list --- */
async function selectCollabList(list, event) {
    currentCollabListId = list.id;
    el('currentListTitle').textContent = list.name;

    // highlight selected list
    el('collabLists').querySelectorAll('div').forEach(div => div.classList.remove('selected'));
    event.currentTarget.classList.add('selected');

    el('taskInputArea').classList.remove('hidden');
    await loadTasks(list.id);
}

/* --- Load tasks for a list --- */
async function loadTasks(listId) {
    try {
        const tasks = await apiGet(`/collab/${listId}/tasks`);
        const container = el('collabTasks');
        container.innerHTML = '';
        tasks.forEach(task => {
            const div = document.createElement('div');
            div.textContent = task.title + (task.done ? ' ✅' : '');
            container.appendChild(div);
        });
    } catch (err) {
        showMessage('Failed to load tasks', true);
    }
}

/* --- Create new collab list --- */
el('createCollabBtn').addEventListener('click', async () => {
    const name = el('collabName').value.trim();
    if (!name) return showMessage('Enter a list name', true);

    try {
        const res = await apiPost('/collab/create', { name });
        console.log(res); // log response from backend
        showMessage('Collaborative list successfully created!');
        el('collabName').value = '';
        await loadCollabLists();
    } catch (err) {
        console.error(err); // log error
        showMessage(err.error || 'Failed to create list', true);
    }

});

/* --- Add collaborator --- */
el('addCollabBtn').addEventListener('click', async () => {
    const username = el('collabUserSelect').value;
    if (!username) return showMessage('Select a user', true);
    if (!currentCollabListId) return showMessage('Select a list first', true);

    try {
        await apiPost(`/collab/${currentCollabListId}/add_member`, { username });
        showMessage('Collaborator successfully added!');
    } catch (err) {
        showMessage(err.error || 'User does not exist', true);
    }
});

/* --- Add task --- */
el('addTaskBtn').addEventListener('click', async () => {
    const title = el('newTask').value.trim();
    if (!title) return showMessage('Enter a task', true);
    if (!currentCollabListId) return showMessage('Select a list first', true);

    try {
        await apiPost(`/collab/${currentCollabListId}/add_task`, { title });
        el('newTask').value = '';
        await loadTasks(currentCollabListId);
    } catch (err) {
        showMessage(err.error || 'Failed to add task', true);
    }
});

/* --- Back to personal task list --- */
el('backToPersonalBtn').addEventListener('click', () => {
    window.location.href = '/todo';
});

/* --- INIT --- */
document.addEventListener('DOMContentLoaded', async () => {
    await loadUsers();
    await loadCollabLists();
});
