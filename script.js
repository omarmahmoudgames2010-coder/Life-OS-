/* =================================
   LIFE OS - JAVASCRIPT FOUNDATION
================================= */

// Application State
const appState = {
    tasks: [],
    notes: [],
    goals: [],
    expenses: [],
    events: [],
    focusSessions: 0
};


// =================================
// DOM ELEMENTS
// =================================

const navLinks = document.querySelectorAll(".nav-link");


// =================================
// NAVIGATION
// =================================

navLinks.forEach(link => {

    link.addEventListener("click", (event) => {

        event.preventDefault();

        navLinks.forEach(item => {
            item.classList.remove("active");
        });

        link.classList.add("active");

    });

});


// =================================
// DATE & TIME
// =================================

function updateDateTime() {

    const now = new Date();

    const dayName = now.toLocaleDateString("en-US", {
        weekday: "long"
    });

    const date = now.toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });

    const dateContainer = document.querySelector(".topbar-date");

    if (dateContainer) {

        dateContainer.innerHTML = `
            <span>${dayName}</span>
            <strong>${date}</strong>
        `;

    }
}

updateDateTime();


// =================================
// LOCAL STORAGE
// =================================

function saveData() {

    localStorage.setItem(
        "lifeOS",
        JSON.stringify(appState)
    );

}


function loadData() {

    const savedData = localStorage.getItem("lifeOS");

    if (!savedData) {
        return;
    }

    const parsedData = JSON.parse(savedData);

    Object.assign(appState, parsedData);

}


loadData();


// =================================
// INITIALIZE APP
// =================================

function initializeApp() {

    console.log("Life OS initialized successfully 🚀");

    console.log("Current state:", appState);

}


initializeApp();
// =================================
// TASK FORM
// =================================

const addTaskBtn = document.getElementById("addTaskBtn");
const taskForm = document.getElementById("taskForm");

addTaskBtn.addEventListener("click", () => {

    taskForm.classList.toggle("show");

});
// =================================
// TASK CREATION
// =================================

const taskInput = document.getElementById("taskInput");
const taskPriority = document.getElementById("taskPriority");
const saveTaskBtn = document.getElementById("saveTaskBtn");
const taskList = document.querySelector(".task-list");

saveTaskBtn.addEventListener("click", addTask);

function addTask() {

    const title = taskInput.value.trim();
    const priority = taskPriority.value;

    if (!title) {
        taskInput.focus();
        return;
    }

    const task = {
        id: Date.now(),
        title: title,
        priority: priority,
        completed: false,
        createdAt: new Date().toISOString()
    };

    appState.tasks.push(task);

    saveData();

    renderTasks();

    taskInput.value = "";
    taskPriority.value = "low";

    taskForm.classList.remove("show");
}


// =================================
// RENDER TASKS
// =================================

function renderTasks() {

    taskList.innerHTML = "";

    appState.tasks.forEach(task => {

        const taskItem = document.createElement("div");

        taskItem.className =
            `task-item ${task.completed ? "completed" : ""}`;

        taskItem.innerHTML = `
            <button class="task-check" data-id="${task.id}">
                ${task.completed ? "✓" : ""}
            </button>

            <div class="task-content">
                <strong>${task.title}</strong>
                <span>
                    ${task.completed ? "Completed" : "Added just now"}
                </span>
            </div>

            <span class="task-priority ${task.priority}">
                ${task.priority}
            </span>

            <button class="task-delete" data-id="${task.id}">
                🗑️
            </button>
        `;

        taskList.appendChild(taskItem);

    });

    setupTaskActions();
}
function setupTaskActions() {

    const checkButtons =
        document.querySelectorAll(".task-check");

    const deleteButtons =
        document.querySelectorAll(".task-delete");


    checkButtons.forEach(button => {

        button.addEventListener("click", () => {

            const taskId = Number(button.dataset.id);

            const task = appState.tasks.find(
                task => task.id === taskId
            );

            if (!task) return;

            task.completed = !task.completed;

            saveData();

            renderTasks();

        });

    });


    deleteButtons.forEach(button => {

        button.addEventListener("click", () => {

            const taskId = Number(button.dataset.id);

            appState.tasks =
                appState.tasks.filter(
                    task => task.id !== taskId
                );

            saveData();

            renderTasks();

        });

    });

}