/* =================================
   LIFE OS
   One state object, saved in this browser's localStorage, and a set of
   render functions that draw every section from that state.
   No server, no account: the data never leaves the visitor's browser.
================================= */

const STORAGE_KEY = "lifeOS";
const STATE_VERSION = 2;
const WEATHER_PLACE = { name: "Beni Suef", latitude: 29.0661, longitude: 31.0994 };
const LIST_LIMIT = 3;

// =================================
// HELPERS
// =================================

function pad(n) {
    return String(n).padStart(2, "0");
}

// Local calendar day as YYYY-MM-DD (toISOString would shift the day by timezone).
function dayKey(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return dayKey(d);
}

function parseDay(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
}

function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
}

function formatDuration(seconds) {
    const total = Math.floor(seconds / 60);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatClock(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function formatMoney(amount) {
    return amount.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " EGP";
}

function formatDate(key) {
    return parseDay(key).toLocaleDateString("en-US", { day: "numeric", month: "long" });
}

// Strictly increasing ids, so "newest first" ordering is always reliable.
let lastId = 0;
function newId() {
    lastId = Math.max(lastId + 1, Date.now());
    return lastId;
}

const $ = (id) => document.getElementById(id);

// =================================
// STATE
// =================================

function sampleData() {
    const now = Date.now();
    return {
        version: STATE_VERSION,
        demo: true,
        tasks: [
            { id: 1, title: "Finish HTML structure", priority: "low", completed: true, createdAt: now, completedAt: now },
            { id: 2, title: "Build dashboard UI", priority: "high", completed: false, createdAt: now },
            { id: 3, title: "Review JavaScript", priority: "medium", completed: false, createdAt: now },
            { id: 4, title: "Plan tomorrow", priority: "low", completed: false, createdAt: now }
        ],
        goals: [
            { id: 11, title: "Learn JavaScript", icon: "💻", progress: 80, deadline: addDays(20) },
            { id: 12, title: "Fitness Goal", icon: "🏋️", progress: 65, deadline: addDays(45) },
            { id: 13, title: "Read 10 Books", icon: "📚", progress: 40, deadline: addDays(120) }
        ],
        events: [
            { id: 21, title: "Front-End Project", date: addDays(1), time: "10:00", detail: "Project Deadline" },
            { id: 22, title: "Study Session", date: addDays(3), time: "17:30", detail: "JavaScript" },
            { id: 23, title: "Gym Training", date: addDays(7), time: "19:00", detail: "Training" }
        ],
        notes: [
            { id: 31, icon: "📝", title: "Life OS Project", body: "Finish the dashboard and start JavaScript...", createdAt: now },
            { id: 32, icon: "💡", title: "Project Ideas", body: "Think about new features for the portfolio.", createdAt: now - 86400000 },
            { id: 33, icon: "📚", title: "Study Notes", body: "Review JavaScript DOM and Local Storage.", createdAt: now - 3 * 86400000 }
        ],
        expenses: [
            { id: 41, title: "Groceries", amount: 420, category: "Food", date: dayKey() },
            { id: 42, title: "Internet bill", amount: 250, category: "Bills", date: dayKey() },
            { id: 43, title: "Transport", amount: 180, category: "Transport", date: dayKey() }
        ],
        focus: {}
    };
}

function emptyData() {
    return { version: STATE_VERSION, demo: false, tasks: [], goals: [], events: [], notes: [], expenses: [], focus: {} };
}

function loadState() {
    let saved = null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        saved = raw ? JSON.parse(raw) : null;
    } catch (error) {
        saved = null; // storage blocked or corrupted JSON: start fresh
    }

    if (!saved || typeof saved !== "object") {
        return sampleData(); // first visit: show clearly labelled sample data
    }

    // Data saved by the earlier version of Life OS (tasks only): keep it, no sample data.
    const base = emptyData();
    for (const key of ["tasks", "goals", "events", "notes", "expenses"]) {
        if (Array.isArray(saved[key])) base[key] = saved[key];
    }
    if (saved.focus && typeof saved.focus === "object") base.focus = saved.focus;
    base.demo = saved.version === STATE_VERSION ? Boolean(saved.demo) : false;
    return base;
}

const state = loadState();

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        /* storage full or blocked: the page keeps working for this visit */
    }
}

// =================================
// FOCUS TIMER
// =================================

let focusStartedAt = null;
let focusTicker = null;

function focusSecondsToday() {
    const saved = state.focus[dayKey()] || 0;
    const running = focusStartedAt ? (Date.now() - focusStartedAt) / 1000 : 0;
    return saved + running;
}

function commitFocus() {
    if (!focusStartedAt) return;
    const key = dayKey();
    state.focus[key] = (state.focus[key] || 0) + (Date.now() - focusStartedAt) / 1000;
    focusStartedAt = Date.now();
    saveState();
}

function toggleFocus() {
    if (focusStartedAt) {
        commitFocus();
        focusStartedAt = null;
        clearInterval(focusTicker);
        focusTicker = null;
    } else {
        focusStartedAt = Date.now();
        focusTicker = setInterval(renderFocus, 1000);
    }
    renderFocus();
}

function renderFocus() {
    const seconds = focusSecondsToday();
    $("focusClock").textContent = formatClock(seconds);
    $("focusToggle").textContent = focusStartedAt ? "Pause" : "Start focus";
    $("focusToggle").setAttribute("aria-pressed", focusStartedAt ? "true" : "false");
    $("statFocus").textContent = formatDuration(seconds);
    $("prodFocus").textContent = formatDuration(seconds);
}

window.addEventListener("pagehide", commitFocus);

// =================================
// RENDER
// =================================

function emptyMessage(text) {
    return `<p class="empty-state">${esc(text)}</p>`;
}

function renderTasks() {
    const list = $("taskList");
    if (!state.tasks.length) {
        list.innerHTML = emptyMessage("No tasks yet. Add your first one.");
        return;
    }
    list.innerHTML = state.tasks.map((task) => `
        <div class="task-item ${task.completed ? "completed" : ""}">
            <button class="task-check" data-action="toggle-task" data-id="${task.id}"
                aria-label="${task.completed ? "Mark as not done" : "Mark as done"}: ${esc(task.title)}">
                ${task.completed ? "✓" : ""}
            </button>
            <div class="task-content">
                <strong>${esc(task.title)}</strong>
                <span>${task.completed ? "Completed" : "To do"}</span>
            </div>
            <span class="task-priority ${esc(task.priority)}">${esc(task.priority)}</span>
            <button class="task-delete" data-action="delete-task" data-id="${task.id}"
                aria-label="Delete task: ${esc(task.title)}">🗑️</button>
        </div>`).join("");
}

function renderGoals() {
    const list = $("goalsList");
    if (!state.goals.length) {
        list.innerHTML = emptyMessage("No goals yet. Set one to track.");
        $("viewAllGoals").hidden = true;
        return;
    }
    const shown = showAll.goals ? state.goals : state.goals.slice(0, LIST_LIMIT);
    list.innerHTML = shown.map((goal) => `
        <div class="goal-item">
            <div class="goal-top">
                <div class="goal-name">
                    <span class="goal-icon">${esc(goal.icon || "🎯")}</span>
                    <strong>${esc(goal.title)}</strong>
                </div>
                <span>${goal.progress}%</span>
            </div>
            <div class="goal-progress"><div class="goal-progress-fill" style="width: ${goal.progress}%;"></div></div>
            <div class="item-row">
                <small>${goal.deadline ? "Deadline: " + esc(formatDate(goal.deadline)) : "No deadline"}</small>
                <span class="item-actions">
                    <button type="button" class="mini-btn" data-action="goal-plus" data-id="${goal.id}"
                        ${goal.progress >= 100 ? "disabled" : ""} aria-label="Add 10% progress to ${esc(goal.title)}">+10%</button>
                    <button type="button" class="mini-btn" data-action="delete-goal" data-id="${goal.id}"
                        aria-label="Delete goal: ${esc(goal.title)}">✕</button>
                </span>
            </div>
        </div>`).join("");
    $("viewAllGoals").hidden = state.goals.length <= LIST_LIMIT;
    $("viewAllGoals").textContent = showAll.goals ? "Show less" : "View All";
}

function renderEvents() {
    const list = $("upcomingList");
    const today = dayKey();
    const upcoming = state.events
        .filter((event) => event.date >= today)
        .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))
        .slice(0, 5);
    if (!upcoming.length) {
        list.innerHTML = emptyMessage("Nothing coming up. Add an event.");
        return;
    }
    list.innerHTML = upcoming.map((event) => {
        const date = parseDay(event.date);
        const month = date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
        const meta = [event.time, event.detail].filter(Boolean).join(" • ");
        return `
        <div class="upcoming-item">
            <div class="upcoming-date"><strong>${date.getDate()}</strong><span>${month}</span></div>
            <div class="upcoming-content">
                <strong>${esc(event.title)}</strong>
                <span>${esc(meta || "All day")}</span>
            </div>
            <button type="button" class="mini-btn" data-action="delete-event" data-id="${event.id}"
                aria-label="Delete event: ${esc(event.title)}">✕</button>
        </div>`;
    }).join("");
}

function noteWhen(timestamp) {
    const days = Math.floor((new Date(dayKey()) - new Date(dayKey(new Date(timestamp)))) / 86400000);
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    return new Date(timestamp).toLocaleDateString("en-US", { day: "numeric", month: "long" });
}

function renderNotes() {
    const list = $("notesList");
    if (!state.notes.length) {
        list.innerHTML = emptyMessage("No notes yet. Write your first thought.");
        $("viewAllNotes").hidden = true;
        return;
    }
    const sorted = [...state.notes].sort((a, b) => b.createdAt - a.createdAt);
    const shown = showAll.notes ? sorted : sorted.slice(0, LIST_LIMIT);
    list.innerHTML = shown.map((note) => `
        <div class="note-item">
            <div class="note-icon">${esc(note.icon || "📝")}</div>
            <div class="note-content">
                <strong>${esc(note.title)}</strong>
                <span>${esc(note.body)}</span>
                <small>${esc(noteWhen(note.createdAt))}</small>
            </div>
            <button type="button" class="mini-btn" data-action="delete-note" data-id="${note.id}"
                aria-label="Delete note: ${esc(note.title)}">✕</button>
        </div>`).join("");
    $("viewAllNotes").hidden = state.notes.length <= LIST_LIMIT;
    $("viewAllNotes").textContent = showAll.notes ? "Show less" : "View All";
}

function monthExpenses() {
    const prefix = dayKey().slice(0, 7);
    return state.expenses.filter((expense) => expense.date.startsWith(prefix));
}

function renderExpenses() {
    const month = monthExpenses();
    const total = month.reduce((sum, expense) => sum + expense.amount, 0);

    const list = $("expensesList");
    if (!state.expenses.length) {
        list.innerHTML = emptyMessage("No expenses recorded.");
    } else {
        const recent = [...state.expenses].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 5);
        list.innerHTML = recent.map((expense) => `
        <div class="note-item">
            <div class="note-icon">💰</div>
            <div class="note-content">
                <strong>${esc(expense.title)} — ${esc(formatMoney(expense.amount))}</strong>
                <span>${esc(expense.category)}</span>
                <small>${esc(formatDate(expense.date))}</small>
            </div>
            <button type="button" class="mini-btn" data-action="delete-expense" data-id="${expense.id}"
                aria-label="Delete expense: ${esc(expense.title)}">✕</button>
        </div>`).join("");
    }

    const byCategory = {};
    for (const expense of month) {
        byCategory[expense.category] = (byCategory[expense.category] || 0) + expense.amount;
    }
    const rows = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    $("categoryList").innerHTML = rows.length
        ? rows.map(([category, amount]) => `
        <div class="goal-item">
            <div class="goal-top"><strong>${esc(category)}</strong><span>${esc(formatMoney(amount))}</span></div>
            <div class="goal-progress"><div class="goal-progress-fill" style="width: ${Math.round((amount / total) * 100)}%;"></div></div>
        </div>`).join("")
        : emptyMessage("No spending this month.");

    $("statExpenses").textContent = formatMoney(total);
}

function renderStats() {
    const today = dayKey();
    const completed = state.tasks.filter((task) => task.completed);
    const completedToday = completed.filter((task) => task.completedAt && dayKey(new Date(task.completedAt)) === today).length;
    const open = state.tasks.length - completed.length;
    const inProgress = state.goals.filter((goal) => goal.progress < 100).length;

    $("statTasks").textContent = state.tasks.length;
    $("statTasksSub").textContent = `${completedToday} completed today`;
    $("statGoals").textContent = state.goals.length;
    $("statGoalsSub").textContent = `${inProgress} in progress`;

    const score = state.tasks.length ? Math.round((completed.length / state.tasks.length) * 100) : 0;
    $("scoreValue").textContent = `${score}%`;
    $("scoreText").textContent = !state.tasks.length ? "Add a task to start"
        : score >= 80 ? "Great work!"
        : score >= 50 ? "Good progress"
        : score > 0 ? "Keep going" : "Let's begin";
    $("progressFill").style.width = `${score}%`;
    $("prodCompleted").textContent = completed.length;
    $("prodRemaining").textContent = open;
}

function renderDemoNote() {
    $("demoNote").hidden = !state.demo;
}

const showAll = { goals: false, notes: false };

function renderAll() {
    renderTasks();
    renderGoals();
    renderEvents();
    renderNotes();
    renderExpenses();
    renderStats();
    renderFocus();
    renderDemoNote();
}

// =================================
// ACTIONS (one delegated click handler)
// =================================

function change(mutator) {
    mutator();
    saveState();
    renderAll();
}

document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const id = Number(button.dataset.id);

    switch (button.dataset.action) {
        case "toggle-task":
            change(() => {
                const task = state.tasks.find((t) => t.id === id);
                if (!task) return;
                task.completed = !task.completed;
                task.completedAt = task.completed ? Date.now() : null;
            });
            break;
        case "delete-task": change(() => { state.tasks = state.tasks.filter((t) => t.id !== id); }); break;
        case "goal-plus":
            change(() => {
                const goal = state.goals.find((g) => g.id === id);
                if (goal) goal.progress = Math.min(100, goal.progress + 10);
            });
            break;
        case "delete-goal": change(() => { state.goals = state.goals.filter((g) => g.id !== id); }); break;
        case "delete-event": change(() => { state.events = state.events.filter((e) => e.id !== id); }); break;
        case "delete-note": change(() => { state.notes = state.notes.filter((n) => n.id !== id); }); break;
        case "delete-expense": change(() => { state.expenses = state.expenses.filter((e) => e.id !== id); }); break;
        default: break;
    }
});

// ---- Tasks form

$("addTaskBtn").addEventListener("click", () => {
    $("taskForm").classList.toggle("show");
    if ($("taskForm").classList.contains("show")) $("taskInput").focus();
});

function addTask() {
    const title = $("taskInput").value.trim();
    if (!title) {
        $("taskInput").focus();
        return;
    }
    change(() => {
        state.tasks.push({
            id: newId(),
            title,
            priority: $("taskPriority").value,
            completed: false,
            createdAt: Date.now()
        });
    });
    $("taskInput").value = "";
    $("taskPriority").value = "low";
    $("taskForm").classList.remove("show");
}

$("saveTaskBtn").addEventListener("click", addTask);
$("taskInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") addTask();
});

// ---- Focus, "view all" toggles

$("focusToggle").addEventListener("click", toggleFocus);
$("viewAllGoals").addEventListener("click", () => { showAll.goals = !showAll.goals; renderGoals(); });
$("viewAllNotes").addEventListener("click", () => { showAll.notes = !showAll.notes; renderNotes(); });

// ---- Add dialog (goal / event / note / expense)

const FORMS = {
    goal: {
        title: "New goal",
        fields: [
            { name: "title", label: "Goal", type: "text", required: true, maxlength: 80 },
            { name: "icon", label: "Icon", type: "select", options: ["🎯", "💻", "🏋️", "📚", "💰", "✈️"] },
            { name: "deadline", label: "Deadline (optional)", type: "date" }
        ],
        save(data) {
            state.goals.push({ id: newId(), title: data.title, icon: data.icon, progress: 0, deadline: data.deadline || "" });
        }
    },
    event: {
        title: "New event",
        fields: [
            { name: "title", label: "Event", type: "text", required: true, maxlength: 80 },
            { name: "date", label: "Date", type: "date", required: true, value: () => dayKey() },
            { name: "time", label: "Time (optional)", type: "time" },
            { name: "detail", label: "Details (optional)", type: "text", maxlength: 80 }
        ],
        save(data) {
            state.events.push({ id: newId(), title: data.title, date: data.date, time: data.time, detail: data.detail });
        }
    },
    note: {
        title: "New note",
        fields: [
            { name: "title", label: "Title", type: "text", required: true, maxlength: 80 },
            { name: "body", label: "Note", type: "textarea", required: true, maxlength: 400 }
        ],
        save(data) {
            state.notes.push({ id: newId(), icon: "📝", title: data.title, body: data.body, createdAt: Date.now() });
        }
    },
    expense: {
        title: "New expense (EGP)",
        fields: [
            { name: "title", label: "What was it?", type: "text", required: true, maxlength: 80 },
            { name: "amount", label: "Amount (EGP)", type: "number", required: true, min: "0.01", step: "0.01" },
            { name: "category", label: "Category", type: "select", options: ["Food", "Transport", "Bills", "Shopping", "Health", "Other"] },
            { name: "date", label: "Date", type: "date", required: true, value: () => dayKey() }
        ],
        save(data) {
            const amount = Number(data.amount);
            if (!Number.isFinite(amount) || amount <= 0) return;
            state.expenses.push({ id: newId(), title: data.title, amount, category: data.category, date: data.date });
        }
    }
};

let activeForm = null;

function openForm(kind) {
    const config = FORMS[kind];
    activeForm = kind;
    $("entryTitle").textContent = config.title;
    $("entryFields").innerHTML = config.fields.map((field) => {
        const id = `field-${field.name}`;
        const attrs = [
            `id="${id}"`, `name="${field.name}"`,
            field.required ? "required" : "",
            field.maxlength ? `maxlength="${field.maxlength}"` : "",
            field.min ? `min="${field.min}"` : "",
            field.step ? `step="${field.step}"` : "",
            field.value ? `value="${esc(field.value())}"` : ""
        ].filter(Boolean).join(" ");
        let control;
        if (field.type === "select") {
            control = `<select ${attrs}>${field.options.map((o) => `<option>${esc(o)}</option>`).join("")}</select>`;
        } else if (field.type === "textarea") {
            control = `<textarea ${attrs} rows="3"></textarea>`;
        } else {
            control = `<input type="${field.type}" ${attrs}>`;
        }
        return `<label for="${id}">${esc(field.label)}</label>${control}`;
    }).join("");
    $("entryDialog").showModal();
    const first = $("entryFields").querySelector("input, textarea, select");
    if (first) first.focus();
}

document.querySelectorAll("[data-open-form]").forEach((button) => {
    button.addEventListener("click", () => openForm(button.dataset.openForm));
});

$("entryForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!activeForm) return;
    const data = Object.fromEntries(new FormData($("entryForm")).entries());
    for (const key of Object.keys(data)) data[key] = String(data[key]).trim();
    change(() => FORMS[activeForm].save(data));
    $("entryDialog").close();
});

$("entryCancel").addEventListener("click", () => $("entryDialog").close());

// ---- Sample data

$("clearDemoBtn").addEventListener("click", () => {
    if (!confirm("Remove the sample data and start with an empty Life OS?")) return;
    Object.assign(state, emptyData());
    saveState();
    renderAll();
});

// =================================
// NAVIGATION
// =================================

const navLinks = document.querySelectorAll(".nav-link");

navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
        event.preventDefault();

        if (link.dataset.action === "settings") {
            if (confirm("Delete ALL data saved by Life OS in this browser?")) {
                Object.assign(state, emptyData());
                saveState();
                renderAll();
            }
            return;
        }

        navLinks.forEach((item) => item.classList.remove("active"));
        link.classList.add("active");

        const target = link.dataset.target && $(link.dataset.target);
        if (target) {
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        }
    });
});

// =================================
// DATE & TIME
// =================================

function updateDateTime() {
    const now = new Date();
    const container = document.querySelector(".topbar-date");
    if (!container) return;
    container.innerHTML = `
        <span>${now.toLocaleDateString("en-US", { weekday: "long" })}</span>
        <strong>${now.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}</strong>
    `;
}

// =================================
// WEATHER (Open-Meteo: free, no API key)
// =================================

const WEATHER_CODES = [
    [[0], "☀️", "Clear sky"],
    [[1, 2], "🌤️", "Mostly clear"],
    [[3], "☁️", "Cloudy"],
    [[45, 48], "🌫️", "Fog"],
    [[51, 53, 55, 56, 57], "🌦️", "Drizzle"],
    [[61, 63, 65, 66, 67, 80, 81, 82], "🌧️", "Rain"],
    [[71, 73, 75, 77, 85, 86], "❄️", "Snow"],
    [[95, 96, 99], "⛈️", "Thunderstorm"]
];

function describeWeather(code) {
    const match = WEATHER_CODES.find(([codes]) => codes.includes(code));
    return match ? { icon: match[1], label: match[2] } : { icon: "🌡️", label: "Unknown" };
}

async function loadWeather() {
    const url = "https://api.open-meteo.com/v1/forecast"
        + `?latitude=${WEATHER_PLACE.latitude}&longitude=${WEATHER_PLACE.longitude}`
        + "&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code"
        + "&wind_speed_unit=kmh";
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const { current } = await response.json();
        const { icon, label } = describeWeather(current.weather_code);
        $("weatherIcon").textContent = icon;
        $("weatherTemp").textContent = `${Math.round(current.temperature_2m)}°`;
        $("weatherLabel").textContent = label;
        $("weatherHumidity").textContent = `${Math.round(current.relative_humidity_2m)}%`;
        $("weatherWind").textContent = `${Math.round(current.wind_speed_10m)} km/h`;
        $("weatherFeels").textContent = `${Math.round(current.apparent_temperature)}°`;
    } catch (error) {
        $("weatherLabel").textContent = "Weather unavailable right now";
    }
}

// =================================
// START
// =================================

updateDateTime();
renderAll();
loadWeather();
