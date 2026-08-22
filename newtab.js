const STORAGE_KEY = 'taskboard_tasks';
const BG_KEY = 'taskboard_bg';

function loadTasks() {
  return new Promise(resolve => {
    chrome.storage.local.get(STORAGE_KEY, data => {
      const tasks = data[STORAGE_KEY] || [];
      tasks.forEach(t => { if (!t.createdAt) t.createdAt = Date.now(); });
      resolve(tasks);
    });
  });
}

function saveTasks(tasks) {
  chrome.storage.local.set({ [STORAGE_KEY]: tasks });
}

function formatTime(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isSameDay(ts, filter) {
  const d = new Date(ts);
  const f = new Date(filter);
  return d.getFullYear() === f.getFullYear() && d.getMonth() === f.getMonth() && d.getDate() === f.getDate();
}

function createTaskEl(task) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.draggable = true;
  card.dataset.id = task.id;

  const title = document.createElement('div');
  title.className = 'task-title';
  title.textContent = task.title;

  const time = document.createElement('div');
  time.className = 'task-time';
  time.textContent = formatTime(task.createdAt);

  const del = document.createElement('button');
  del.className = 'delete-btn';
  del.textContent = '×';
  del.addEventListener('click', e => {
    e.stopPropagation();
    removeTask(task.id);
  });

  card.appendChild(title);
  card.appendChild(time);
  card.appendChild(del);

  card.addEventListener('dragstart', e => {
    card.classList.add('dragging');
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
  });

  return card;
}

let currentDateFilter = null;

function render(tasks) {
  const statuses = ['todo', 'in-progress', 'in-review', 'done'];
  const filtered = currentDateFilter
    ? tasks.filter(t => isSameDay(t.createdAt, currentDateFilter))
    : tasks;
  statuses.forEach(status => {
    const list = document.querySelector(`.task-list[data-status="${status}"]`);
    list.innerHTML = '';
    const colTasks = filtered.filter(t => t.status === status);
    document.querySelector(`[data-count="${status}"]`).textContent = colTasks.length;
    colTasks.forEach(t => list.appendChild(createTaskEl(t)));
  });
}

let allTasks = [];

async function init() {
  allTasks = await loadTasks();
  render(allTasks);

  document.querySelectorAll('.add-btn').forEach(btn => {
    btn.addEventListener('click', () => addTask(btn.dataset.add));
  });

  document.querySelectorAll('.task-list').forEach(list => {
    list.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      list.closest('.column').classList.add('drag-over');
    });

    list.addEventListener('dragleave', e => {
      if (!list.contains(e.relatedTarget)) {
        list.closest('.column').classList.remove('drag-over');
      }
    });

    list.addEventListener('drop', e => {
      e.preventDefault();
      list.closest('.column').classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/plain');
      const newStatus = list.dataset.status;
      moveTask(taskId, newStatus);
    });
  });

  const dateInput = document.getElementById('dateFilter');
  const clearBtn = document.getElementById('clearFilter');

  dateInput.addEventListener('change', () => {
    if (dateInput.value) {
      currentDateFilter = dateInput.value;
      clearBtn.style.display = 'inline';
      render(allTasks);
    }
  });

  clearBtn.addEventListener('click', () => {
    currentDateFilter = null;
    dateInput.value = '';
    clearBtn.style.display = 'none';
    render(allTasks);
  });

  const bgUpload = document.getElementById('bgUpload');
  const clearBg = document.getElementById('clearBg');

  chrome.storage.local.get(BG_KEY, data => {
    if (data[BG_KEY]) {
      document.body.style.backgroundImage = `url(${data[BG_KEY]})`;
      clearBg.style.display = 'inline';
    }
  });

  bgUpload.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      chrome.storage.local.set({ [BG_KEY]: dataUrl });
      document.body.style.backgroundImage = `url(${dataUrl})`;
      clearBg.style.display = 'inline';
    };
    reader.readAsDataURL(file);
  });

  clearBg.addEventListener('click', () => {
    chrome.storage.local.remove(BG_KEY);
    document.body.style.backgroundImage = '';
    clearBg.style.display = 'none';
  });
}

function addTask(status) {
  const list = document.querySelector(`.task-list[data-status="${status}"]`);
  const existing = list.querySelector('.task-input');
  if (existing) return;

  const input = document.createElement('textarea');
  input.className = 'task-input';
  input.rows = 1;
  input.placeholder = 'Task title...';

  let submitted = false;

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitted = true;
      const title = input.value.trim();
      if (title) {
        allTasks.push({ id: Date.now().toString(), title, status, createdAt: Date.now() });
        saveTasks(allTasks);
        render(allTasks);
      }
    }
    if (e.key === 'Escape') {
      input.remove();
    }
  });

  input.addEventListener('blur', () => {
    if (submitted) return;
    const title = input.value.trim();
    if (title) {
      allTasks.push({ id: Date.now().toString(), title, status, createdAt: Date.now() });
      saveTasks(allTasks);
      render(allTasks);
    } else {
      input.remove();
    }
  });

  list.prepend(input);
  input.focus();
}

function moveTask(id, newStatus) {
  const task = allTasks.find(t => t.id === id);
  if (task && task.status !== newStatus) {
    task.status = newStatus;
    saveTasks(allTasks);
    render(allTasks);
  }
}

function removeTask(id) {
  allTasks = allTasks.filter(t => t.id !== id);
  saveTasks(allTasks);
  render(allTasks);
}

init();
