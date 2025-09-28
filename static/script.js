let taskList = JSON.parse(localStorage.getItem('tasks')) || [];

function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(taskList));
}

function renderTasks() {
    const ul = document.getElementById('taskList');
    ul.innerHTML = '';

    taskList.forEach((task, index) => {
        const li = document.createElement('li');

        // ✅ Add priority classes
        if (task.priority === "High") {
            li.classList.add("priority-high");
        } else if (task.priority === "Mid") {
            li.classList.add("priority-mid");
        } else if (task.priority === "Low") {
            li.classList.add("priority-low");
        }

        if (task.done) {
            li.classList.add("done");
        }

        li.innerHTML = `
            <span>${task.text} - ${task.due} [${task.priority}]</span>
            <div class="task-buttons">
                <button onclick="toggleDone(${index})"><i class="fas fa-check"></i></button>
                <button onclick="deleteTask(${index})"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
        ul.appendChild(li);
    });
}

function addTask() {
    const textInput = document.getElementById('taskInput');
    const dueInput = document.getElementById('dueDateInput');
    const priorityInput = document.getElementById('priorityInput');

    if (!textInput.value) return;

    taskList.push({
        text: textInput.value,
        due: dueInput.value,
        priority: priorityInput.value,
        done: false
    });

    textInput.value = '';
    dueInput.value = '';
    saveTasks();
    renderTasks();
}

function toggleDone(index) {
    taskList[index].done = !taskList[index].done;
    saveTasks();
    renderTasks();
}

function deleteTask(index) {
    taskList.splice(index, 1);
    saveTasks();
    renderTasks();
    showSnackbar('Task deleted');
}

function showSnackbar(message) {
    const snackbar = document.getElementById('snackbar');
    snackbar.textContent = message;
    snackbar.className = 'show';
    setTimeout(() => { snackbar.className = snackbar.className.replace('show', ''); }, 3000);
}

renderTasks();
