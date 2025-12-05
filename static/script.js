// script.js - updated: event listeners, inline edit with date/time pickers, undo delete

let lastDeletedTask = null;

// Helper: safely create an element with classes
function el(tag, className) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    return e;
}

function $(id) {
    return document.getElementById(id);
}

function formatDateTime(raw) {
    if (!raw) return "N/A";

    const d = new Date(raw);
    if (isNaN(d)) return raw; // fallback if backend string can't be parsed

    return d.toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });
}

function formatDue(date, time) {
    if (!date) return "N/A";

    // Case 1: time exists → return "YYYY-MM-DD HH:MM AM/PM"
    if (time) {
        const dt = new Date(`${date}T${time}`);
        if (!isNaN(dt)) {
            return dt.toLocaleString("en-US", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true
            });
        }
    }

    // Case 2: only date → format date only
    return date;
}


// loads tasks from backend, sorted by user selection
async function fetchTasks() {
    const sortSelect = document.getElementById('sortSelect');
    const sort = sortSelect ? sortSelect.value : 'added';
    const res = await fetch(`/tasks?sort=${sort}`);
    if (!res.ok) return showSnackbar('Failed to load tasks');
    const tasks = await res.json();
    renderTaskList(tasks);
}

// displays tasks in the UI with buttons(done, edit, delete)
// updates the frontend task list
function renderTaskList(tasks) {
    const ul = document.getElementById('taskList');
    ul.innerHTML = '';

    tasks.forEach(task => {
        const li = el('li');
        li.dataset.id = task.id;

        // priority classes
        if (task.priority === "High") li.classList.add("priority-high");
        else if (task.priority === "Mid") li.classList.add("priority-mid");
        else if (task.priority === "Low") li.classList.add("priority-low");
        if (task.done) li.classList.add("done");

        const info = el('div', 'task-info');
        const titleSpan = el('span', 'task-title');
        titleSpan.textContent = task.title;

        // Create checkbox to toggle done state
        const checkbox = el('input', 'toggle-checkbox');
        checkbox.type = 'checkbox';
        checkbox.checked = task.done; // show check if already done
        checkbox.title = 'Mark as done';

        // When checkbox is clicked, toggle the task
        checkbox.addEventListener('change', async () => {
            await toggleDone(task.id, task.done);
        });


        const meta = el('div', 'task-meta');
        const dueText = el('div');
        dueText.textContent = `Due: ${formatDue(task.due_date, task.due_time)}`;
        const addedText = el('small');
        addedText.textContent = `Added: ${formatDateTime(task.date_added)}`;


        meta.appendChild(dueText);
        meta.appendChild(addedText);

        info.appendChild(checkbox);
        info.appendChild(titleSpan);
        info.appendChild(meta);

        const buttons = el('div', 'task-buttons');

        const editBtn = el('button');
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.title = 'Edit task';
        editBtn.addEventListener('click', () => startEdit(li, task));

        const deleteBtn = el('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteBtn.title = 'Delete task';
        deleteBtn.addEventListener('click', () => deleteTask(task.id));

        buttons.appendChild(editBtn);
        buttons.appendChild(deleteBtn);

        li.appendChild(info);
        li.appendChild(buttons);
        ul.appendChild(li);
    });
}

// sends new task to backend
async function addTask() {
    const title = document.getElementById('taskInput').value.trim();
    const dueDate = document.getElementById('dueDateInput').value;
    const dueTime = document.getElementById('dueTimeInput').value;
    const priority = document.getElementById('priorityInput').value;

    if (!title) {
        showSnackbar('Please enter a task name');
        return;
    }

    const res = await fetch('/add', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ title, due_date: dueDate, due_time: dueTime, priority })
    });
    if (!res.ok) return showSnackbar('Failed to add task');
    // clear inputs
    document.getElementById('taskInput').value = '';
    document.getElementById('dueDateInput').value = '';
    document.getElementById('dueTimeInput').value = '';
    fetchTasks();
}

// marks/unmarks task as done.
async function toggleDone(id, done) {
    const res = await fetch(`/update/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ done: !done })
    });
    if (!res.ok) return showSnackbar('Failed to update');
    fetchTasks();
}

// allows editing task title, due date/time, and priority
function startEdit(li, task) {
    const info = li.querySelector('.task-info');
    info.innerHTML = ''; // clear current display

    // Title input
    const titleInput = el('input', 'edit-input');
    titleInput.type = 'text';
    titleInput.value = task.title || '';

    // Date & Time inputs
    const dateInput = el('input', 'edit-date');
    dateInput.type = 'date';
    const timeInput = el('input', 'edit-time');
    timeInput.type = 'time';

    if (task.due_date) {
        // due_date expected format: "YYYY-MM-DD HH:MM" or "YYYY-MM-DD"
        const parts = task.due_date.split(' ');
        if (parts[0] && /^\d{4}-\d{2}-\d{2}$/.test(parts[0])) dateInput.value = parts[0];
        if (parts[1] && /^\d{1,2}:\d{2}$/.test(parts[1])) timeInput.value = parts[1];
    }

    // Priority select
    const prioritySelect = el('select', 'edit-priority');
    ['High', 'Mid', 'Low'].forEach(p => {
        const opt = el('option');
        opt.value = p;
        opt.textContent = p;
        if (p === task.priority) opt.selected = true;
        prioritySelect.appendChild(opt);
    });

    // Save & Cancel buttons
    const saveBtn = el('button', 'save-btn');
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', async () => {
        const newTitle = titleInput.value.trim();
        const newDate = dateInput.value;
        const newTime = timeInput.value;
        const newPriority = prioritySelect.value;
        if (!newTitle) {
            showSnackbar('Title cannot be empty');
            return;
        }
        const res = await fetch(`/update/${task.id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ title: newTitle, due_date: newDate, due_time: newTime, priority: newPriority })
        });
        if (!res.ok) {
            showSnackbar('Failed to save changes');
            return;
        }
        fetchTasks();
    });

    const cancelBtn = el('button', 'cancel-btn');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
        fetchTasks();
    });

    // Build editing UI
    info.appendChild(titleInput);
    const smallWrap = el('div', 'edit-datetime');
    smallWrap.appendChild(dateInput);
    smallWrap.appendChild(timeInput);
    smallWrap.appendChild(prioritySelect);
    info.appendChild(smallWrap);
    info.appendChild(saveBtn);
    info.appendChild(cancelBtn);
}

// Delete with confirmation + store last deleted for Undo
async function deleteTask(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;

    // get the task before deleting so we can undo
    const getRes = await fetch(`/task/${id}`);
    if (!getRes.ok) return showSnackbar('Failed to fetch task to delete');
    lastDeletedTask = await getRes.json();

    const res = await fetch(`/delete/${id}`, { method: 'DELETE' });
    if (!res.ok) return showSnackbar('Delete failed');
    fetchTasks();
    showSnackbarWithUndo('Task deleted');
}

// restores deleted task
async function undoDelete() {
    if (!lastDeletedTask) return;
    await fetch('/add', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            title: lastDeletedTask.title,
            // split due_date into date/time parts if possible
            due_date: (lastDeletedTask.due_date || '').split(' ')[0] || '',
            due_time: (lastDeletedTask.due_date || '').split(' ')[1] || '',
            priority: lastDeletedTask.priority
        })
    });
    lastDeletedTask = null;
    fetchTasks();
}

if ($('renameListBtn')) {
    $('renameListBtn').onclick = async () => {
        const newName = prompt("Enter new list name:");
        if (!newName) return;

        await PUT(`/collab/${currentListId}/rename`, { name: newName });
        snackbar("List renamed");
        loadCollabLists();
    };
}

if ($('deleteListBtn')) {
    $('deleteListBtn').onclick = async () => {
        if (!confirm("Delete this collaborative list?")) return;

        await DELETE(`/collab/${currentListId}/delete`);
        snackbar("List deleted");

        currentListId = null;
        loadCollabLists();

        $('listHeader')?.classList.add('hidden');
        $('collabTools')?.classList.add('hidden');
        $('sortBar')?.classList.add('hidden');
        $('taskInputArea')?.classList.add('hidden');
        $('collabTaskList').innerHTML = "";
    };
}



// snackbar helpers: show success/error messages or undo option
function showSnackbar(message) {
    const snackbar = document.getElementById('snackbar');
    snackbar.innerHTML = message;
    snackbar.className = 'show';
    setTimeout(() => { snackbar.className = snackbar.className.replace('show', ''); }, 4000);
}

function showSnackbarWithUndo(message) {
    const snackbar = document.getElementById('snackbar');
    snackbar.innerHTML = `${message} <span id="undo" class="undo-link">Undo</span>`;
    snackbar.className = 'show';
    const undoEl = document.getElementById('undo');
    if (undoEl) undoEl.addEventListener('click', undoDelete);
    setTimeout(() => { snackbar.className = snackbar.className.replace('show', ''); }, 5000);
}

// event bindings: runs code when DOM is ready (add button, sort dropdown, initial fetch)
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('addBtn').addEventListener('click', addTask);
    document.getElementById('sortSelect').addEventListener('change', fetchTasks);

    // ⭐ FIXED: Go to collaborative lists
    const collabBtn = document.getElementById('goToCollabBtn');
    if (collabBtn) {
        collabBtn.addEventListener('click', () => {
            window.location.href = "/collab";
        });
    }

    fetchTasks();
});


// --- ACCOUNT BUTTON ---
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('profileBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      window.location.href = '/accounts'; 
    });
  }
});

