// =============================
// GLOBAL SELECTORS & VARIABLES
// =============================
const taskTable = document.getElementById("taskTable");
const addBtn = document.getElementById("addBtn");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");
const daySelect = document.getElementById("daySelect");

const alarmAudio = document.getElementById("alarmTone");
const doneSound = document.getElementById("doneSound");

const modal = document.getElementById("alarmModal");
const modalTaskName = document.getElementById("modalTaskName");
const modalStatus = document.getElementById("modalStatus");
const closeModalBtn = document.getElementById("closeModalBtn");

const display = document.getElementById("display");

let completedPlayed = false;
let seconds = 0;
let swInterval = null;

let lastAlarmKey = "";
let lastCheckedMinute = null;

// =============================
// 1. DATA SAVE / LOAD
// =============================
function saveToLocal() {
    const rows = [];

    document.querySelectorAll("#taskTable tr").forEach((tr) => {
        rows.push({
            task: tr.cells[0].innerText.trim(),
            start: tr.cells[1].querySelector("input").value,
            finish: tr.cells[2].querySelector("input").value,
            alarm: tr.cells[3].querySelector(".alarm").checked,
            done: tr.cells[4].querySelector(".done").checked
        });
    });

    localStorage.setItem("neonTimeTable", JSON.stringify({
        selectedDay: daySelect.value,
        tasks: rows
    }));
}

function loadFromLocal() {
    const saved = JSON.parse(localStorage.getItem("neonTimeTable"));

    if (!saved) {
        createNewRow();
        return;
    }

    daySelect.value = saved.selectedDay;
    taskTable.innerHTML = "";

    saved.tasks.forEach(t =>
        createNewRow(t.task, t.start, t.finish, t.alarm, t.done)
    );

    if (saved.tasks.length === 0) createNewRow();

    updateProgress();
}

// =============================
// 2. TASK MANAGEMENT
// =============================
function escapeHtml(str) {
    return str.replace(/[&<>"']/g, m => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[m]));
}

function createNewRow(task = "task", start = "08:00", finish = "09:00", alarm = false, done = false) {
    const row = taskTable.insertRow();

    row.innerHTML = `
        <td contenteditable="true">${escapeHtml(task)}</td>
        <td><input type="time" value="${start}"></td>
        <td><input type="time" value="${finish}"></td>
        <td><input type="checkbox" class="alarm" ${alarm ? "checked" : ""}></td>
        <td><input type="checkbox" class="done" ${done ? "checked" : ""}></td>
        <td class="countdown">--</td>
        <td><button class="deleteBtn">✖</button></td>
    `;

    if (done) row.classList.add("task-done");

    updateProgress();
}

// Add row
addBtn.onclick = () => {
    createNewRow();
    saveToLocal();
};

// Delete row
document.addEventListener("click", e => {
    if (e.target.classList.contains("deleteBtn")) {
        e.target.closest("tr").remove();
        if (!taskTable.querySelector("tr")) createNewRow();
        updateProgress();
        saveToLocal();
    }
});

// Done toggle
document.addEventListener("change", e => {
    if (e.target.classList.contains("done")) {
        const row = e.target.closest("tr");
        row.classList.toggle("task-done", e.target.checked);
        updateProgress();
        saveToLocal();
    }
});

// Auto save
document.addEventListener("input", e => {
    if (e.target.closest("#taskTable")) saveToLocal();
});

saveBtn.onclick = () => {
    saveToLocal();
    window.print();
};

resetBtn.onclick = () => {
    taskTable.innerHTML = "";
    createNewRow();
    lastAlarmKey = "";
    saveToLocal();
};

// =============================
// 3. PROGRESS
// =============================
function updateProgress() {
    const total = document.querySelectorAll(".done").length;
    const done = document.querySelectorAll(".done:checked").length;

    const percent = total ? Math.round((done / total) * 100) : 0;

    document.getElementById("progressText").innerText = `Progress: ${percent}%`;

    const circle = document.querySelector(".progress-ring");
    const radius = 80;
    const circumference = 2 * Math.PI * radius;

    circle.style.strokeDasharray = circumference;
    circle.style.strokeDashoffset =
        circumference - (percent / 100) * circumference;

    if (percent === 100 && !completedPlayed) {
        doneSound.play().catch(() => {});
        completedPlayed = true;
    }

    if (percent < 100) completedPlayed = false;
}

// =============================
// 4. TIME HELPERS
// =============================
function getNowMinutes() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
}

function timeToMinutes(time) {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
}

// =============================
// 5. COUNTDOWN SYSTEM
// =============================
function updateCountdowns() {
    const nowMin = getNowMinutes();

    document.querySelectorAll("#taskTable tr").forEach((row) => {
        const cell = row.querySelector(".countdown");

        const start = timeToMinutes(row.cells[1].querySelector("input").value);
        const finish = timeToMinutes(row.cells[2].querySelector("input").value);
        const done = row.querySelector(".done").checked;

        if (done) {
            cell.innerText = "Done";
            return;
        }

        if (nowMin < start) {
            cell.innerText = `Starts in ${start - nowMin} min`;
        }
        else if (nowMin >= start && nowMin < finish) {
            cell.innerText = `Ends in ${finish - nowMin} min`;
        }
        else {
            cell.innerText = "Finished";
            cell.classList.add("finished");     
        }
    });
}

// =============================
// 6. ALARM SYSTEM (FIXED)
// =============================
function checkAlarms() {
    const now = new Date();
    const today = now.toLocaleDateString("en-US", { weekday: "long" });

    if (today !== daySelect.value) return;

    const nowMin = getNowMinutes();

    // reset per minute
    if (lastCheckedMinute !== nowMin) {
        lastCheckedMinute = nowMin;
        lastAlarmKey = "";
    }

    document.querySelectorAll("#taskTable tr").forEach((row, i) => {
        const task = row.cells[0].innerText.trim() || `Task ${i + 1}`;
        const start = timeToMinutes(row.cells[1].querySelector("input").value);
        const finish = timeToMinutes(row.cells[2].querySelector("input").value);
        const alarmOn = row.querySelector(".alarm").checked;
        const done = row.querySelector(".done").checked;

        if (!alarmOn || done) return;

        if (nowMin >= start && nowMin < start + 1) {
            triggerAlarm(task, "Starts Now!", `start-${i}-${start}`);
        }

        if (nowMin >= finish && nowMin < finish + 1) {
            triggerAlarm(task, "Finished Now!", `finish-${i}-${finish}`);
        }
    });
}

function triggerAlarm(task, status, key) {
    if (lastAlarmKey === key) return;

    lastAlarmKey = key;

    alarmAudio.currentTime = 0;
    alarmAudio.play().catch(() => {});

    modalTaskName.innerText = task;
    modalStatus.innerText = status;

    modal.style.display = "flex";
    document.body.classList.add("modal-active");
}

// Close modal
closeModalBtn.onclick = () => {
    alarmAudio.pause();
    alarmAudio.currentTime = 0;

    modal.style.display = "none";
    document.body.classList.remove("modal-active");
};

// =============================
// 7. STOPWATCH
// =============================
function formatTime(sec) {
    const h = String(Math.floor(sec / 3600)).padStart(2, "0");
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
}

document.getElementById("startSW").onclick = () => {
    if (!swInterval) {
        swInterval = setInterval(() => {
            seconds++;
            display.innerText = formatTime(seconds);
        }, 1000);
    }
};

document.getElementById("pauseSW").onclick = () => {
    clearInterval(swInterval);
    swInterval = null;
};

document.getElementById("resetSW").onclick = () => {
    clearInterval(swInterval);
    swInterval = null;
    seconds = 0;
    display.innerText = "00:00:00";
};

// =============================
// 8. INIT & INTERVALS
// =============================
document.getElementById("cornerNeon").onclick = () =>
    document.body.classList.toggle("neon-off");

window.onload = () => {
    loadFromLocal();
    updateCountdowns();
    checkAlarms();
    updateLiveClock();
setInterval(updateLiveClock, 1000);
};

// intervals
setInterval(checkAlarms, 10000);
setInterval(updateCountdowns, 5000);

// unlock audio
document.addEventListener("click", () => {
    [alarmAudio, doneSound].forEach(a => {
        a.play().then(() => {
            a.pause();
            a.currentTime = 0;
        }).catch(() => {});
    });
}, { once: true });

//LiveClock

function updateLiveClock() {
    const now = new Date();

    // TIME
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    const ampm = hours >= 12 ? "PM" : "AM";

    hours = hours % 12;
    hours = hours ? hours : 12;

    const timeString = `${hours}:${minutes} ${ampm}`;

    // DATE + DAY
    const options = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
    const dateString = now.toLocaleDateString("en-US", options);

    // SET
    document.getElementById("liveClock").innerText = timeString;
    document.getElementById("liveDate").innerText = dateString;
}