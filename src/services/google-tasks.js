/**
 * Google Tasks API integration.
 *
 * Fetches tasks from all configured Google Task lists and returns them
 * normalized to the same shape as Apple Reminders items so the frontend
 * can render both sources identically.
 *
 * Uses the same OAuth2 client as google-calendar.js (shared credentials).
 * Requires the `tasks.readonly` scope (requested during OAuth consent).
 */

import { google } from 'googleapis';
import { getGoogleCredentials } from './credential-store.js';

let oauth2Client = null;

function getAuth() {
  if (!oauth2Client) {
    const creds = getGoogleCredentials();
    if (!creds) throw new Error('No Google credentials configured');

    oauth2Client = new google.auth.OAuth2(creds.clientId, creds.clientSecret);
    oauth2Client.setCredentials({ refresh_token: creds.refreshToken });
  }
  return oauth2Client;
}

/** Reset the cached OAuth2 client (call after credential changes). */
export function resetGoogleTasksClient() {
  oauth2Client = null;
}

/**
 * Fetch tasks from all configured Google Task lists.
 * Returns an array of normalized reminder-shaped objects.
 */
export async function fetchGoogleTasks() {
  const creds = getGoogleCredentials();
  if (!creds) return [];

  // taskListIds may not exist on older credential stores (pre-Tasks integration)
  const taskListIds = creds.taskListIds;

  const auth = getAuth();
  const tasksApi = google.tasks({ version: 'v1', auth });

  // If no task lists stored yet, discover them dynamically
  let listIds = taskListIds;
  if (!listIds || listIds.length === 0) {
    try {
      const tlResult = await tasksApi.tasklists.list({ maxResults: 100 });
      listIds = (tlResult.data.items || []).map((tl) => tl.id);
    } catch (err) {
      console.error('[GoogleTasks] Failed to discover task lists:', err.message);
      return [];
    }
  }

  const allTasks = [];

  for (const listId of listIds) {
    try {
      // Fetch the list metadata for the list name
      const listMeta = await tasksApi.tasklists.get({ tasklist: listId });
      const listName = listMeta.data.title || listId;

      // Fetch incomplete tasks (showCompleted=false by default)
      // Also fetch completed tasks so user can see recent completions
      const response = await tasksApi.tasks.list({
        tasklist: listId,
        showCompleted: true,
        showHidden: false,
        maxResults: 100,
      });

      const tasks = (response.data.items || [])
        .filter((t) => t.title && t.title.trim()) // skip empty tasks
        .map((task) => ({
          id: `gtask:${task.id}`,
          title: task.title,
          notes: task.notes || null,
          dueDate: task.due || null, // RFC 3339, date-only (midnight UTC)
          isCompleted: task.status === 'completed',
          priority: 0, // Google Tasks has no priority field
          list: listName,
          source: 'google-tasks',
        }));

      allTasks.push(...tasks);
    } catch (err) {
      console.error(`[GoogleTasks] Error fetching list "${listId}":`, err.message);
    }
  }

  return allTasks;
}
