/**
 * Renders the reminders sidebar panel.
 * Shows incomplete reminders first (sorted by due date), then completed ones.
 * Merges items from Apple Reminders (via Shortcuts webhook) and Google Tasks
 * (polled during sync cycle).
 *
 * All text content uses textContent for safe DOM insertion.
 */

function renderReminders(remindersData) {
  const listEl = document.getElementById('reminders-list');
  const metaEl = document.getElementById('reminders-meta');

  if (!remindersData || !remindersData.items || remindersData.items.length === 0) {
    if (remindersData && remindersData.lastSyncedAt) {
      listEl.textContent = '';
      const msg = document.createElement('div');
      msg.className = 'no-events';
      msg.textContent = 'No reminders';
      listEl.appendChild(msg);
    }
    updateRemindersMeta(remindersData, metaEl);
    return;
  }

  // Sort: incomplete first (by due date), then completed
  const items = [...remindersData.items].sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
    if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });

  const fragment = document.createDocumentFragment();

  for (const item of items) {
    const dueInfo = formatDueDate(item.dueDate);
    const priorityClass = getPriorityClass(item.priority);
    const isGoogleTask = item.source === 'google-tasks';

    const el = document.createElement('div');
    el.className = 'reminder-item' + (item.isCompleted ? ' is-completed' : '');

    const checkbox = document.createElement('div');
    checkbox.className = 'reminder-checkbox' + (isGoogleTask ? ' google-task' : '');

    const content = document.createElement('div');
    content.className = 'reminder-content';

    const title = document.createElement('div');
    title.className = 'reminder-title' + (priorityClass ? ' ' + priorityClass : '');
    title.textContent = item.title;
    content.appendChild(title);

    if (dueInfo) {
      const due = document.createElement('div');
      due.className = 'reminder-due' + (dueInfo.overdue ? ' is-overdue' : '');
      due.textContent = dueInfo.text;
      content.appendChild(due);
    }

    if (item.list) {
      const listLabel = document.createElement('div');
      listLabel.className = 'reminder-list-label';
      listLabel.textContent = item.list;
      content.appendChild(listLabel);
    }

    if (item.notes) {
      const notes = document.createElement('div');
      notes.className = 'reminder-notes';
      notes.textContent = item.notes;
      content.appendChild(notes);
    }

    el.appendChild(checkbox);
    el.appendChild(content);
    fragment.appendChild(el);
  }

  listEl.textContent = '';
  listEl.appendChild(fragment);
  updateRemindersMeta(remindersData, metaEl);
}

function updateRemindersMeta(data, el) {
  if (!data || !data.lastSyncedAt) {
    el.textContent = '';
    return;
  }
  const ago = formatRelativeTime(data.lastSyncedAt);
  const parts = ['Synced ' + ago];
  if (data.syncedBy) parts[0] += ' by ' + data.syncedBy;
  el.textContent = parts[0];
}

function getPriorityClass(priority) {
  if (priority === 1) return 'priority-high';
  if (priority === 5) return 'priority-medium';
  return '';
}
