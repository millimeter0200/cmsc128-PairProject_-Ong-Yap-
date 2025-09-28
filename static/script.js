let lastDeleted = null;

async function fetchTasks() {
    const res = await fetch('/tasks');
    const tasks = await res.json();
    const list = document.getElementById('taskList');
    list.innerHTML = '';
    tasks.forEach(task => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span style="color:${task.priority === 'High' ? 'red' : task.priority === 'Low' ? 'green' : 'orange'}">
              [${task.priority}]
            </span>
            <span style="${task.done ? 'text-decoration: line-through;' : ''}">${task.title}</span> (Due: ${task.due_date || "N/A"})
            <button onclick="deleteTask(${task.id})">Delete</button>
            <button onclick="markDone(${task.id}, ${task.done})">${task.done ? "Undo" : "Done"}</button>
        `;
        list.appendChild(li);
    });
}

async function addTask() {
    const title = document.getElementById('taskInput').value;
    const dueDate = document.getElementById('dueDateInput').value;
    const priority = document.getElementById('priorityInput').value;

    if (!title) {
        showSnackbar('Please enter a task title', false);
        return;
    }

    await fetch('/add', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({title, due_date: dueDate, priority})
    });
    document.getElementById('taskInput').value = '';
    document.getElementById('dueDateInput').value = '';
    fetchTasks();
    showSnackbar('You have successfully added a task', false);
}

async function deleteTask(id) {
    const res = await fetch(`/task/${id}`);
    const task = await res.json();
    lastDeleted = task;
    await fetch(`/delete/${id}`, {method: 'DELETE'});
    fetchTasks();
    showSnackbar('Task deleted', true);
}

async function markDone(id, done) {
    await fetch(`/update/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({done: !done})
    });
    fetchTasks();
}

function showSnackbar(message, withUndo) {
    const snackbar = document.getElementById('snackbar');
    snackbar.innerHTML = message;
    if (withUndo) {
        snackbar.innerHTML += `<span id="undo" onclick="undoDelete()">Undo</span>`;
    }
    snackbar.className = 'show';
    setTimeout(() => { 
        snackbar.className = snackbar.className.replace('show', ''); 
    }, 5000); // 5 seconds visibility
}

async function undoDelete() {
    if (lastDeleted) {
        await fetch('/add', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                title: lastDeleted.title,
                due_date: lastDeleted.due_date,
                priority: lastDeleted.priority
            })
        });
        lastDeleted = null;
        fetchTasks();
        const snackbar = document.getElementById('snackbar');
        snackbar.className = snackbar.className.replace('show', '');
    }
}

fetchTasks();