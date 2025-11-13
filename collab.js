let currentView = 'personal';
let currentCollabId = null;
let collabLists = [];
let currentUser = null;

// Get current user info
fetch('/accounts/whoami').then(r => r.json()).then(data => {
  if (!data.authenticated) window.location.href = '/accounts';
  currentUser = data.user;
  loadTasks();
});

// Switch between Personal and Collaborative TDL
document.getElementById('tdlSwitch').addEventListener('change', e => {
  currentView = e.target.value;
  if (currentView === 'collab') {
    document.getElementById('collabSelectContainer').style.display = 'block';
    loadCollabLists();
  } else {
    document.getElementById('collabSelectContainer').style.display = 'none';
    document.getElementById('addMemberContainer').style.display = 'none';
    currentCollabId = null;
    loadTasks();
  }
});

// Load collaborative lists the user belongs to
function loadCollabLists() {
  fetch('/collab/lists').then(r => r.json()).then(data => {
    collabLists = data.lists;
    let select = document.getElementById('collabLists');
    select.innerHTML = '';
    collabLists.forEach(list => {
      let option = document.createElement('option');
      option.value = list.id;
      option.textContent = list.name + (list.owner_id === currentUser.id ? ' (You)' : '');
      select.appendChild(option);
    });
    if (collabLists.length) {
      currentCollabId = collabLists[0].id;
      select.value = currentCollabId;
      loadTasks();
      checkOwner();
    } else {
      document.getElementById('tasksContainer').innerHTML = '<p>No collaborative lists.</p>';
    }
  });
}

// Detect owner for adding members
function checkOwner() {
  const list = collabLists.find(l => l.id == currentCollabId);
  if (list.owner_id === currentUser.id) {
    document.getElementById('addMemberContainer').style.display = 'block';
    loadMembers();
  } else {
    document.getElementById('addMemberContainer').style.display = 'none';
  }
}

// Change collaborative list
document.getElementById('collabLists').addEventListener('change', e => {
  currentCollabId = e.target.value;
  loadTasks();
  checkOwner();
});

// Add new collaborative list
document.getElementById('newCollabBtn').addEventListener('click', () => {
  const name = prompt('Enter new collaborative list name:');
  if (!name) return;
  fetch('/collab/create', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({name})
  }).then(r => r.json()).then(() => loadCollabLists());
});

// Add member
document.getElementById('addMemberBtn').addEventListener('click', () => {
  const username = document.getElementById('newMember').value.trim();
  if (!username) return;
  fetch(`/collab/${currentCollabId}/add_member`, {
    method: 'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({username})
  }).then(r => r.json()).then(data => {
    alert(data.message || data.error);
    document.getElementById('newMember').value = '';
    loadMembers();
  });
});

// Load members for current collaborative list
function loadMembers() {
  fetch('/collab/lists').then(r => r.json()).then(data => {
    const list = data.lists.find(l => l.id == currentCollabId);
    const membersContainer = document.getElementById('memberList');
    membersContainer.innerHTML = '';
    if (list) {
      // For simplicity, show usernames of all members
      fetch(`/collab/lists`).then(r => r.json()).then(all => {
        all.lists.forEach(l => {
          if (l.id == currentCollabId) {
            let span = document.createElement('span');
            span.textContent = currentUser.username + ' (You)'; // at least owner
            membersContainer.appendChild(span);
          }
        });
      });
    }
  });
}

// Load tasks
function loadTasks() {
  const container = document.getElementById('tasksContainer');
  container.innerHTML = '';
  let url;
  if (currentView === 'personal') url = '/tasks';
  else if (currentView === 'collab') url = `/collab/${currentCollabId}/tasks`;
  else return;

  fetch(url).then(r => r.json()).then(data => {
    if (!data.length) container.innerHTML = '<p>No tasks yet.</p>';
    data.forEach(task => {
      const div = document.createElement('div');
      div.className = 'task' + (task.done ? ' done' : '');
      div.innerHTML = `<span>${task.title}</span>
                       <div>
                        <button class="toggleBtn">✓</button>
                        <button class="deleteBtn">🗑</button>
                       </div>`;
      container.appendChild(div);

      // Toggle done
      div.querySelector('.toggleBtn').addEventListener('click', () => {
        const id = task.id;
        fetch(currentView==='personal'?`/update/${id}`:`/collab_task/${id}`, {
          method:'PUT',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({done: !task.done})
        }).then(()=>loadTasks());
      });

      // Delete task
      div.querySelector('.deleteBtn').addEventListener('click', () => {
        const id = task.id;
        fetch(currentView==='personal'?`/delete/${id}`:`/collab_task/${id}`, {method:'DELETE'})
        .then(()=>loadTasks());
      });
    });
  });
}

// Add task
document.getElementById('addTaskBtn').addEventListener('click', () => {
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) return;
  let url = currentView==='personal'?'/add':`/collab/${currentCollabId}/add_task`;
  fetch(url, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({title})
  }).then(()=>{ document.getElementById('taskTitle').value=''; loadTasks(); });
});
