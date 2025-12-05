// ---------------------------------------------
// Simple fetch helpers
// ---------------------------------------------
const $ = id => document.getElementById(id);

async function GET(url) {
    const r = await fetch(url);
    return r.json();
}
async function POST(url, data) {
    const r = await fetch(url, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(data)
    });
    return r.json();
}
async function PUT(url, data) {
    const r = await fetch(url, {
        method: "PUT",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(data)
    });
    return r.json();
}
async function DELETE_(url) {
    const r = await fetch(url, { method: "DELETE" });
    return r.json();
}

function snackbar(msg) {
    const bar = $("snackbar");
    bar.textContent = msg;
    bar.className = "show";
    setTimeout(() => bar.className = "", 3000);
}

// ---------------------------------------------
// State
// ---------------------------------------------
let currentListId = null;
let listsCache = []; // keep lists locally if needed

// ---------------------------------------------
// Initialize
// ---------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
    bindUI();
    await loadCollabLists();
});

// ---------------------------------------------
// Bind static UI events
// ---------------------------------------------
function bindUI() {

    $("createCollabBtn")?.addEventListener("click", async () => {
        const name = $("collabName").value.trim();
        if (!name) return snackbar("Enter a list name");
        const res = await POST("/collab/create", { name });
        if (res.error) return snackbar(res.error || "Failed");
        $("collabName").value = "";
        snackbar("List created");
        await loadCollabLists();
        if (res.id) selectList(res.id, name);
    });

    $("addTaskBtn")?.addEventListener("click", async () => {
        if (!currentListId) return snackbar("Select a list first");
        const title = $("newTask").value.trim();
        if (!title) return snackbar("Enter a task name");
        const due_date = $("newDueDate").value || "";
        const due_time = $("newDueTime").value || "";
        const priority = $("newPriority").value || "Mid";

        const res = await POST(`/collab/${currentListId}/add_task`, { title, due_date, due_time, priority });
        if (res.error) return snackbar(res.error);

        $("taskModal")?.classList.add("hidden");

        $("newTask").value = "";
        $("newDueDate").value = "";
        $("newDueTime").value = "";
        $("newPriority").value = "Mid";

        snackbar("Task added");
        await loadTasks();
    });

    // $("renameListBtn")?.addEventListener("click", async () => {
    //     if (!currentListId) return;
    //     const newName = prompt("New name for list:", $("currentListTitle").textContent);
    //     if (!newName) return;
    //     const r = await PUT(`/collab/${currentListId}/rename`, { name: newName });
    //     if (r.error) return snackbar(r.error);
    //     snackbar("List renamed");
    //     $("currentListTitle").textContent = newName;
    //     await loadCollabLists();
    // });

    // $("deleteListBtn")?.addEventListener("click", async () => {
    //     if (!currentListId) return;
    //     if (!confirm("Delete this list and its tasks?")) return;
    //     const r = await DELETE_(`/collab/${currentListId}/delete`);
    //     if (r.error) return snackbar(r.error);
    //     snackbar("List deleted");
    //     resetSelection();
    //     await loadCollabLists();
    // });

    $("backToPersonalBtn")?.addEventListener("click", () => {
        location.href = "/todo";
    });

    $("sortSelect")?.addEventListener("change", async () => {
        if (!currentListId) return;
        await loadTasks();
    });

    $("inlineAddCollabBtn")?.addEventListener("click", async () => {
        if (!currentListId) return snackbar("Select a list first");
        const username = $("inlineCollabInput").value.trim();
        if (!username) return snackbar("Enter username");
        const res = await POST(`/collab/${currentListId}/add_member`, { username });
        if (res.error) return snackbar(res.error);
        $("inlineCollabInput").value = "";
        snackbar("Collaborator added");
        await loadMembers();
    });

    // New "Add Task" button near list name
    $("openTaskPopupBtn")?.addEventListener("click", () => {
        $("taskModal")?.classList.remove("hidden");
    });

    $("closeTaskModal")?.addEventListener("click", () => {
        $("taskModal")?.classList.add("hidden");
    });

    // --- BACK TO PERSONAL TASKS ---
    $("backToPersonalBtn")?.addEventListener("click", () => {
        window.location.href = "/todo";
    });
}


// ---------------------------------------------
// Load lists: populate grid (first view) & vertical list (sidebar)
// ---------------------------------------------
async function loadCollabLists() {
    try {
        const res = await GET("/collab/lists");
        listsCache = res.lists || [];
        const grid = document.getElementById("listsGrid");
        const vertical = $("collabLists");

        grid.innerHTML = "";
        vertical.innerHTML = "";

        listsCache.forEach(l => {
            // GRID CARD
            const card = document.createElement("div");
            card.className = "list-card";
            card.dataset.id = l.id;
            card.innerHTML = `<div class="card-title">${escapeHtml(l.name)}</div>`;
            card.addEventListener("click", () => {
                // when clicked, move to vertical layout and select
                const wrapper = $("tasksWrapper");
                wrapper.classList.add("as-vertical");
                // show vertical panel
                $("gridListPanel").classList.add("hidden");
                $("verticalListPanel").classList.remove("hidden");
                // show collaborator section
                $("collabMemberSection").classList.remove("hidden");
                selectList(l.id, l.name);
            });
            grid.appendChild(card);

            // VERTICAL ROW
            const row = document.createElement("div");
            row.className = "list-item";
            row.dataset.id = l.id;
            row.innerHTML = `
                <div class="list-left">
                    <span class="list-name">${escapeHtml(l.name)}</span>
                </div>
                <div class="list-actions-inline">
                    <i class="fa-solid fa-pen edit-btn"></i>
                    <i class="fa-solid fa-trash del-btn"></i>
                </div>
            `;

            // click whole row to select
            row.addEventListener("click", (ev) => {
                // prevent double action when edit/delete clicked
                if (ev.target.classList.contains("edit-btn") || ev.target.classList.contains("del-btn")) return;
                selectList(l.id, l.name);
            });

            // edit
            row.querySelector(".edit-btn").addEventListener("click", async (ev) => {
                ev.stopPropagation();
                const newName = prompt("Enter new list name:", l.name);
                if (!newName) return;
                const r = await PUT(`/collab/${l.id}/rename`, { name: newName });
                if (r.error) return snackbar(r.error || "Failed");
                snackbar("List renamed");
                await loadCollabLists();
                if (currentListId === l.id) $("currentListTitle").textContent = newName;
            });

            // delete
            row.querySelector(".del-btn").addEventListener("click", async (ev) => {
                ev.stopPropagation();
                if (!confirm("Delete this list?")) return;
                const r = await DELETE_(`/collab/${l.id}/delete`);
                if (r.error) return snackbar(r.error || "Failed");
                snackbar("List deleted");
                if (currentListId === l.id) resetSelection();
                await loadCollabLists();
            });

            vertical.appendChild(row);
        });

        // If there is at least one list and none is selected, keep grid visible.
        // If currentListId exists (e.g., after creation), ensure it's selected.
        if (currentListId) {
            // ensure vertical mode shown (in case user refreshes)
            const wrapper = $("tasksWrapper");
            wrapper.classList.add("as-vertical");
            $("gridListPanel").classList.add("hidden");
            $("verticalListPanel").classList.remove("hidden");
            $("collabMemberSection").classList.remove("hidden");
            // highlight selected in vertical
            highlightSelectedInVertical();
        } else {
            // show grid panel (first load)
            $("gridListPanel").classList.remove("hidden");
            $("verticalListPanel").classList.add("hidden");
            $("collabMemberSection").classList.add("hidden");
            // hide right tasks area
            resetSelectionUI();
            document.body.classList.add("collab-bg-default");
            document.body.classList.remove("collab-bg-active");

        }

    } catch (err) {
        console.error("loadCollabLists error", err);
        snackbar("Failed to load lists");
    }
}

// ---------------------------------------------
// Select list (moves layout to vertical + loads tasks/members)
// ---------------------------------------------
async function selectList(listId, listName) {
    currentListId = listId;

    // show vertical layout + tasks panel
    const wrapper = $("tasksWrapper");
    wrapper.classList.add("as-vertical");
    $("gridListPanel").classList.add("hidden");
    $("verticalListPanel").classList.remove("hidden");
    $("collabMemberSection").classList.remove("hidden");

    // show list header and tools
    $("listHeader").classList.remove("hidden");
    // $("taskInputArea").classList.remove("hidden");
    $("sortBar").classList.remove("hidden");
    $("tasksRight").classList.add("visible");
    $("currentListTitle").textContent = listName;

    const addTaskBtn = $("openTaskPopupBtn");
        if (addTaskBtn) {
            addTaskBtn.onclick = () => {
                $("taskModal").classList.remove("hidden");
            };
        }

    highlightSelectedInVertical();

    document.body.classList.add("collab-bg-active");
    document.body.classList.remove("collab-bg-default");


    await loadMembers();
    await loadTasks();
}

// highlight selected in vertical panel
function highlightSelectedInVertical() {
    document.querySelectorAll("#collabLists .list-item").forEach(el => {
        el.classList.toggle("selected", el.dataset.id == currentListId);
        // if selected, bring to top / scroll into view
        if (el.dataset.id == currentListId) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    });
}

// reset selection state
function resetSelection() {
    currentListId = null;
    resetSelectionUI();
}
function resetSelectionUI() {
    $("listHeader").classList.add("hidden");
    // $("taskInputArea").classList.add("hidden");
    $("sortBar").classList.add("hidden");
    $("tasksRight").classList.remove("visible");

    const wrapper = $("tasksWrapper");
    wrapper.classList.remove("as-vertical");
    $("gridListPanel").classList.remove("hidden");
    $("verticalListPanel").classList.add("hidden");
    $("collabMemberSection").classList.add("hidden");
}

// ---------------------------------------------
// Load members for current list
// ---------------------------------------------
async function loadMembers() {
    if (!currentListId) return;
    try {
        const data = await GET(`/collab/${currentListId}/members`);
        // data: { members: [...], is_owner: bool }
        const box = $("collabMemberList");
        box.innerHTML = "";
        (data.members || []).forEach(u => {
            const pill = document.createElement("div");
            pill.className = "collab-tag";
            pill.innerHTML = `<i class="fa fa-user"></i><span>${escapeHtml(u)}</span>`;
            if (data.is_owner) {
                const rem = document.createElement("span");
                rem.className = "remove";
                rem.textContent = "×";
                rem.title = "Remove collaborator";
                rem.addEventListener("click", async () => {
                    if (!confirm(`Remove ${u} from collaborators?`)) return;
                    const r = await POST(`/collab/${currentListId}/remove_member`, { username: u });
                    if (r.error) return snackbar(r.error);
                    snackbar("Collaborator removed");
                    await loadMembers();
                });
                pill.appendChild(rem);
            }
            box.appendChild(pill);
        });
    } catch (err) {
        console.error("loadMembers err", err);
        snackbar("Failed to load collaborators");
    }
}

// ---------------------------------------------
// Load tasks for current list
// ---------------------------------------------
async function loadTasks() {
    if (!currentListId) return;

    const list = $("collabTaskList");
    list.innerHTML = "";

    // const tasks = await GET(`/collab/${currentListId}/tasks`);

    // 1️⃣ GET TASKS
    let tasks = await GET(`/collab/${currentListId}/tasks`);

    // 2️⃣ READ SORT OPTION
    const sortType = $("sortSelect").value;

    // 3️⃣ SORT BASED ON USER SELECTION
    if (sortType === "added") {
        tasks.sort((a, b) => new Date(a.date_added) - new Date(b.date_added));
    }
    else if (sortType === "due") {
        tasks.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    }
    else if (sortType === "priority") {
        const order = { High: 1, Mid: 2, Low: 3 };
        tasks.sort((a, b) => order[a.priority] - order[b.priority]);
    }

    tasks.forEach(t => {

        const li = document.createElement("li");
        li.classList.add("task-item", t.priority);


        li.innerHTML = `
            <div class="task-info ${t.done ? "done" : ""}">
                <label class="task-row">
                    <input type="checkbox" class="collab-check" data-id="${t.id}" ${t.done ? "checked" : ""}>
                    <span class="task-title">${t.title}</span>
                </label>

                <div class="task-meta">
                    ${t.due_date ? `<small>Due: ${t.due_date}${t.due_time ? " " + t.due_time : ""}</small>` : ""}
                    <span class="p-${t.priority}" style="margin-top:4px;">${t.priority}</span>
                    <small style="display:block;margin-top:4px;">
                        Added: ${formatDateTime(t.date_added)}
                    </small>

                </div>
            </div>

            <div class="task-buttons">
                <button class="edit-task-btn" data-id="${t.id}">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="delete-task-btn" data-id="${t.id}">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;

        list.appendChild(li);
    });

    // --- CHECK / TOGGLE DONE ---
    document.querySelectorAll(".collab-check").forEach(cb => {
        cb.addEventListener("change", async () => {
            const id = cb.dataset.id;
            await PUT(`/collab_task/${id}`, { done: cb.checked });
            loadTasks();
        });
    });

    // --- DELETE TASK ---
    document.querySelectorAll(".delete-task-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            await DELETE_(`/collab/${currentListId}/delete_task/${id}`);
            loadTasks();
        });
    });

    // --- EDIT TASK (OPEN MODAL) ---
    // --- FIXED EDIT TASK ---
    // --- EDIT TASK INLINE ---
    document.querySelectorAll(".edit-task-btn").forEach(btn => {
        btn.addEventListener("click", async (ev) => {
            ev.stopPropagation();
            const id = btn.dataset.id;
            // fetch tasks (route exists) and find the one we want
            const tasks = await GET(`/collab/${currentListId}/tasks`);
            const t = tasks.find(x => x.id == id);
            if (!t) return snackbar("Task not found");

            // find the li element to replace
            const li = btn.closest("li");
            if (!li) return;

            // Prevent multiple edits at once: if there is already an inline editor, bail
            if (document.querySelector(".inline-edit-form")) {
                // optional: focus the existing editor instead
                return snackbar("Finish current edit first");
            }

            // try to extract date and time from the server formatted due_date
            let dateVal = "";
            let timeVal = "";
            if (t.due_date) {
                // attempt to parse patterns like "MM-DD-YYYY" OR "MM-DD-YYYY HH:MM AM/PM" OR "YYYY-MM-DD" OR "YYYY-MM-DD HH:MM"
                // try ISO
                let iso = null;
                // common pattern: "MM-DD-YYYY HH:MM AM/PM"
                const ampm = t.due_date.match(/(\d{1,2}:\d{2}\s?(AM|PM|am|pm))/);
                if (ampm) {
                    timeVal = ampm[1];
                    // remove time part to get date text
                    iso = t.due_date.replace(ampm[0],"").trim();
                } else {
                    // try a yyyy-mm-dd pattern
                    const ymd = t.due_date.match(/(\d{4}-\d{2}-\d{2})/);
                    if (ymd) iso = ymd[1];
                    else {
                        // try mm-dd-yyyy
                        const mdy = t.due_date.match(/(\d{2}[-\/]\d{2}[-\/]\d{4})/);
                        if (mdy) {
                            // convert mm-dd-yyyy -> yyyy-mm-dd
                            const parts = mdy[1].split(/[-\/]/);
                            if (parts.length === 3) iso = `${parts[2]}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`;
                        }
                    }
                }
                if (iso) {
                    // if iso already yyyy-mm-dd
                    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) dateVal = iso;
                    else {
                        // try Date parse fallback
                        const dt = new Date(iso);
                        if (!isNaN(dt)) {
                            const y = dt.getFullYear();
                            const m = String(dt.getMonth()+1).padStart(2,'0');
                            const d = String(dt.getDate()).padStart(2,'0');
                            dateVal = `${y}-${m}-${d}`;
                        }
                    }
                }
                // if timeVal captured like "07:30 PM", convert to 24h for input[type=time]
                if (timeVal && /AM|PM|am|pm/.test(timeVal)) {
                    const tm = timeVal.trim().split(/\s+/)[0];
                    const [h, min] = tm.split(":").map(Number);
                    const isPM = /PM|pm/.test(timeVal);
                    let hour24 = h % 12 + (isPM ? 12 : 0);
                    timeVal = `${String(hour24).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
                } else if (timeVal && /^\d{1,2}:\d{2}$/.test(timeVal)) {
                    // already ok
                } else {
                    timeVal = "";
                }
            }

            // Build inline edit form
            li.classList.add("editing");
            const origHTML = li.innerHTML;
            li.innerHTML = `
                <div class="inline-edit-form" style="width:100%;">
                    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                        <label style="min-width:70px;">Task name</label>
                        <input type="text" class="inline-title" value="${escapeHtml(t.title)}" style="flex:1; padding:6px 10px; border-radius:8px; border:1px solid #ddd;">
                        
                        <label style="min-width:70px;">Due date</label>
                        <input type="date" class="inline-date" value="${dateVal}" style="padding:6px 10px; border-radius:8px; border:1px solid #ddd;">

                        <label style="min-width:70px;">Due time</label>
                        <input type="time" class="inline-time" value="${timeVal}" style="padding:6px 10px; border-radius:8px; border:1px solid #ddd;">

                        <label style="min-width:60px;">Priority</label>
                        <select class="inline-priority" style="padding:6px 10px; border-radius:8px; border:1px solid #ddd;">
                            <option value="High"${t.priority === "High" ? " selected":""}>High</option>
                            <option value="Mid"${t.priority === "Mid" ? " selected":""}>Mid</option>
                            <option value="Low"${t.priority === "Low" ? " selected":""}>Low</option>
                        </select>

                        <button class="btn save-inline" style="margin-left:6px;">Save</button>
                        <button class="btn danger cancel-inline">Cancel</button>
                    </div>
                </div>
            `;

            // Attach save / cancel listeners
            const saveBtn = li.querySelector(".save-inline");
            const cancelBtn = li.querySelector(".cancel-inline");

            cancelBtn.addEventListener("click", () => {
                li.classList.remove("editing");
                li.innerHTML = origHTML;
                // rebind events for this item (reload tasks is simplest)
                loadTasks();
            });

            saveBtn.addEventListener("click", async () => {
                const newTitle = li.querySelector(".inline-title").value.trim();
                const newDate = li.querySelector(".inline-date").value || "";
                const newTime = li.querySelector(".inline-time").value || "";
                const newPriority = li.querySelector(".inline-priority").value || "Mid";

                const payload = {
                    title: newTitle,
                    due_date: newDate,
                    due_time: newTime,
                    priority: newPriority
                };

                const res = await PUT(`/collab_task/${id}`, payload);
                if (res.error) {
                    snackbar(res.error);
                    return;
                }
                snackbar("Task updated");
                await loadTasks();
            });
        });
    });



}


// ---------------------------------------------
// Utilities
// ---------------------------------------------
function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return "";
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function openEditModal(taskId, t) {
    $("editModal").classList.remove("hidden");

    $("editTitle").value = t.title;
    $("editDueDate").value = t.due_date?.split(" ")[0] || "";
    $("editDueTime").value = t.due_date?.includes(":") ? t.due_date.split(" ")[1] : "";
    $("editPriority").value = t.priority;

    $("saveEditBtn").onclick = async () => {
        const payload = {
            title: $("editTitle").value,
            due_date: $("editDueDate").value,
            due_time: $("editDueTime").value,
            priority: $("editPriority").value
        };

        await PUT(`/collab_task/${taskId}`, payload);
        snackbar("Task updated");
        closeEditModal();
        loadTasks();
    };

    $("cancelEditBtn").onclick = closeEditModal;
}

function closeEditModal() {
    $("editModal").classList.add("hidden");
}

function formatDateTime(dt) {
    if (!dt) return "";

    const d = new Date(dt);  // safely parse backend timestamp

    if (isNaN(d)) return dt; // fallback if parsing fails

    return d.toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });
}


// document.addEventListener("DOMContentLoaded", () => {

//     const openBtn = document.getElementById("openTaskPopupBtn");
//     const closeBtn = document.getElementById("closeTaskModal");
//     const modal = document.getElementById("taskModal");
//     const backBtn = document.getElementById("backToPersonalBtn");

//     if (openBtn && modal) {
//         openBtn.addEventListener("click", () => {
//             modal.classList.remove("hidden");
//         });
//     }

//     if (closeBtn && modal) {
//         closeBtn.addEventListener("click", () => {
//             modal.classList.add("hidden");
//         });
//     }
//     if (backBtn) {
//         backBtn.addEventListener("click", () => {
//             window.location.href = "/todo";
//         });
//     }
// });

