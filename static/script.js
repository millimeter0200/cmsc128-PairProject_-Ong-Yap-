// script.js - updated: event listeners, inline edit with date/time pickers, undo delete

let lastDeletedTask = null;

// Helper: safely create an element with classes
function el(tag, className) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    return e;
}

async function fetchTasks() {
    const sortSelect = document.getElementById('sortSelect');
    const sort = sortSelect ? sortSelect.value : 'added';
    const res = await fetch(`/tasks?sort=${sort}`);
    if (!res.ok) return showSnackbar('Failed to load tasks');
    const tasks = await res.json();
    renderTaskList(tasks);
}

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

        const meta = el('div', 'task-meta');
        const dueText = el('div');
        dueText.textContent = `Due: ${task.due_date || "N/A"}`;
        const addedText = el('small');
        addedText.textContent = `Added: ${task.date_added}`;

        meta.appendChild(dueText);
        meta.appendChild(addedText);

        info.appendChild(titleSpan);
        info.appendChild(meta);

        const buttons = el('div', 'task-buttons');

        const doneBtn = el('button');
        doneBtn.innerHTML = '<i class="fas fa-check"></i>';
        doneBtn.title = 'Toggle done';
        doneBtn.addEventListener('click', async () => {
            await toggleDone(task.id, task.done);
        });

        const editBtn = el('button');
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.title = 'Edit task';
        editBtn.addEventListener('click', () => startEdit(li, task));

        const deleteBtn = el('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteBtn.title = 'Delete task';
        deleteBtn.addEventListener('click', () => deleteTask(task.id));

        buttons.appendChild(doneBtn);
        buttons.appendChild(editBtn);
        buttons.appendChild(deleteBtn);

        li.appendChild(info);
        li.appendChild(buttons);
        ul.appendChild(li);
    });
}

// Add
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

// Toggle done
async function toggleDone(id, done) {
    const res = await fetch(`/update/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ done: !done })
    });
    if (!res.ok) return showSnackbar('Failed to update');
    fetchTasks();
}

// Start inline edit - replaces info area with inputs
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

// Undo delete (recreate)
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

// Snackbar helpers
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

// Event bindings
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('addBtn').addEventListener('click', addTask);
    document.getElementById('sortSelect').addEventListener('change', fetchTasks);
    fetchTasks();
});
