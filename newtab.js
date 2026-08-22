const STORAGE_KEY = 'taskboard_tasks';

function loadTasks() {
  return new Promise(resolve => {
    chrome.storage.local.get(STORAGE_KEY, data => {
      resolve(data[STORAGE_KEY] || []);
    });
  });
}

function saveTasks(tasks) {
  chrome.storage.local.set({ [STORAGE_KEY]: tasks });
}

function createTaskEl(task) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.draggable = true;
  card.dataset.id = task.id;

  const title = document.createElement('div');
  title.className = 'task-title';
  title.textContent = task.title;

  const del = document.createElement('button');
  del.className = 'delete-btn';
  del.textContent = '×';
  del.addEventListener('click', e => {
    e.stopPropagation();
    removeTask(task.id);
  });

  card.appendChild(title);
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

function render(tasks) {
  const statuses = ['todo', 'in-progress', 'in-review', 'done'];
  statuses.forEach(status => {
    const list = document.querySelector(`.task-list[data-status="${status}"]`);
    list.innerHTML = '';
    const filtered = tasks.filter(t => t.status === status);
    document.querySelector(`[data-count="${status}"]`).textContent = filtered.length;
    filtered.forEach(t => list.appendChild(createTaskEl(t)));
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
        allTasks.push({ id: Date.now().toString(), title, status });
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
      allTasks.push({ id: Date.now().toString(), title, status });
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
