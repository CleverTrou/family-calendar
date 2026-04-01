/**
 * Microsoft To Do (Tasks) integration via Graph API.
 *
 * Fetches tasks from all To Do lists and returns them normalized
 * to the same shape as Apple Reminders and Google Tasks so the
 * frontend can render all sources identically.
 *
 * Uses the shared microsoft-graph.js helper for auth and API calls.
 */

import { graphGet, graphGetAll } from './microsoft-graph.js';
import { getAccount, setAccount } from './credential-store.js';

const ACCOUNT_KEY = 'microsoft:default';

/**
 * Map Microsoft importance to a numeric priority.
 * Microsoft uses: "low", "normal", "high"
 * Our reminders use: 0 (none), 1 (high), 5 (medium), 9 (low)
 */
function mapPriority(importance) {
  switch (importance) {
    case 'high':   return 1;
    case 'normal': return 5;
    case 'low':    return 9;
    default:       return 0;
  }
}

/**
 * Fetch tasks from all Microsoft To Do lists.
 * Returns an array of normalized reminder-shaped objects.
 */
export async function fetchMicrosoftTasks() {
  const account = getAccount(ACCOUNT_KEY);
  if (!account) return [];

  // Discover task lists
  let taskLists;
  try {
    const data = await graphGet(ACCOUNT_KEY, '/me/todo/lists', {
      $top: '100',
    });
    taskLists = data.value || [];

    // Store task list metadata for admin panel visibility toggles
    const storedLists = taskLists.map((tl) => ({
      id: tl.id,
      name: tl.displayName,
    }));
    setAccount(ACCOUNT_KEY, { taskLists: storedLists });
  } catch (err) {
    console.error('[MicrosoftTasks] Failed to discover task lists:', err.message);
    return [];
  }

  const allTasks = [];

  for (const list of taskLists) {
    try {
      const tasks = await graphGetAll(
        ACCOUNT_KEY,
        `/me/todo/lists/${list.id}/tasks`,
        {
          $top: '100',
          $select: 'id,title,body,dueDateTime,importance,status,completedDateTime',
          $filter: "status ne 'completed'",
        },
      );

      const mapped = tasks
        .filter((t) => t.title && t.title.trim())
        .map((task) => ({
          id: `mstodo:${task.id}`,
          title: task.title,
          notes: task.body?.content || null,
          dueDate: task.dueDateTime?.dateTime
            ? task.dueDateTime.dateTime.split('T')[0]
            : null,
          isCompleted: task.status === 'completed',
          priority: mapPriority(task.importance),
          list: list.displayName,
          source: 'microsoft-tasks',
        }));

      allTasks.push(...mapped);
    } catch (err) {
      console.error(`[MicrosoftTasks] Error fetching list "${list.displayName}":`, err.message);
    }
  }

  return allTasks;
}

/** Reset function for consistency with other services. */
export function resetMicrosoftTasksClient() {
  // No persistent client to reset
}
