# Google Calendar & Tasks Setup

Full integration with Google Calendar and Google Tasks via OAuth2.
This gives you automatic calendar discovery (new subscriptions like
holidays are picked up automatically) and read-only access to your
Google Tasks / To Do lists.

> **Time to complete:** ~10 minutes
>
> **Easier alternative:** If you only need calendar events (not tasks)
> and don't mind a 5-30 minute sync delay, use **Add Calendar Feed
> (ICS URL)** in the admin panel instead. See [ICS feed instructions](#ics-alternative) at the bottom.

---

## Part 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with the Google account that has your calendars
3. Click the project dropdown at the top left (it may say "Select a project" or show an existing project name)
4. Click **New Project**

   | Field | Value |
   |-------|-------|
   | Project name | `Family Calendar` |
   | Organization | No organization (or leave default) |

5. Click **Create**
6. Wait a few seconds, then select your new project from the dropdown

---

## Part 2: Enable the Calendar and Tasks APIs

1. In the left sidebar, go to **APIs & Services** > **Library**
   (or search "API Library" in the top search bar)
2. Search for **Google Calendar API**, click it, then click **Enable**
3. Go back to the Library, search for **Google Tasks API**, click it, then click **Enable**

> **Why both?** Calendar API provides your calendar events. Tasks API
> provides your Google Tasks / To Do lists that appear in the reminders
> sidebar.

---

## Part 3: Configure the OAuth Consent Screen

Before creating credentials, Google requires you to set up a consent screen
(the page users see when authorizing your app).

1. Go to **APIs & Services** > **OAuth consent screen** (left sidebar)
2. Select **External** as the user type, then click **Create**

   > "External" is the only option for personal Google accounts.
   > Don't worry about "unverified app" warnings — this app is just for you.

3. Fill in the required fields:

   | Field | Value |
   |-------|-------|
   | App name | `Family Calendar` |
   | User support email | Your email |
   | Developer contact email | Your email |

4. Click **Save and Continue**

### Scopes

1. Click **Add or Remove Scopes**
2. In the filter, search for and check these two scopes:

   | Scope | Description |
   |-------|-------------|
   | `Google Calendar API` `.../auth/calendar.readonly` | See and download your calendars |
   | `Google Tasks API` `.../auth/tasks.readonly` | See your tasks |

   > **Tip:** If the filter isn't finding them, paste the full scope URL:
   > `https://www.googleapis.com/auth/calendar.readonly`

3. Click **Update**, then **Save and Continue**

### Test Users

Since the app is "unverified", you need to add yourself as a test user.

1. Click **Add Users**
2. Enter your Google email address
3. Click **Add**, then **Save and Continue**

> **Important:** If family members use different Google accounts, add their
> emails here too. You can add up to 100 test users.

4. Click **Back to Dashboard**

---

## Part 4: Create OAuth2 Credentials

1. Go to **APIs & Services** > **Credentials** (left sidebar)
2. Click **+ Create Credentials** at the top, then select **OAuth client ID**
3. Fill in:

   | Field | Value |
   |-------|-------|
   | Application type | **Web application** |
   | Name | `Family Calendar` |

4. Under **Authorized redirect URIs**, click **+ Add URI** and enter:

   ```
   http://YOUR_SERVER_ADDRESS:3000/api/auth/google/callback
   ```

   Replace `YOUR_SERVER_ADDRESS` with your actual server address:

   | Setup | Example redirect URI |
   |-------|---------------------|
   | Local development (Mac) | `http://localhost:3000/api/auth/google/callback` |
   | Raspberry Pi on LAN | `http://192.168.1.100:3000/api/auth/google/callback` |
   | Pi with hostname | `http://familycal.local:3000/api/auth/google/callback` |

   > **Tip:** The admin panel shows the exact redirect URI to use.
   > Start the server first (`npm start`), go to `/admin` > Accounts >
   > Connect Google Calendar — the URI is displayed in Step 2.

5. Click **Create**

6. A dialog shows your **Client ID** and **Client Secret**. Keep this
   window open or click **Download JSON** — you'll need both values next.

   ```
   Client ID:     xxxxxxxxxxxx.apps.googleusercontent.com
   Client Secret: GOCSPX-xxxxxxxxxxxxxxxxxxxxxx
   ```

---

## Part 5: Connect in the Admin Panel

1. Open your calendar server: `http://YOUR_SERVER_ADDRESS:3000/admin`
2. Go to **Accounts** tab
3. Click **Connect Google Calendar**
4. Paste your **Client ID** and **Client Secret** from Part 4
5. Click **Authorize with Google**
6. Google's consent screen opens — sign in and click **Allow**

   > You may see a warning: "Google hasn't verified this app."
   > Click **Advanced** > **Go to Family Calendar (unsafe)**.
   > This is expected for personal/test apps.

7. You'll be redirected back to the admin panel with a success message
8. Your calendars and task lists will sync within 5 minutes (or restart the server for immediate sync)

---

## Part 6: Verify It's Working

**Check the admin panel:**
- Accounts tab should show "Google Calendar" with a green dot and the number of calendars found
- Click **Test** to re-verify the connection

**Check the display:**
- Calendar events should appear in the grid
- Google Tasks should appear in the reminders sidebar

**Check the server logs:**
```bash
# Look for successful sync messages
journalctl -u family-calendar --since "5 min ago" | grep -i google
# or if running locally:
# Look for lines like: [Sync] google: 42, google-tasks: 8
```

---

## Troubleshooting

### Authorization Errors

| Error | Fix |
|-------|-----|
| "Google hasn't verified this app" | Click **Advanced** > **Go to Family Calendar (unsafe)** — this is normal for personal apps |
| "redirect_uri_mismatch" | The redirect URI in Cloud Console doesn't match your server. Check the URI in Admin > Connect Google > Step 2 and make sure it's added in Cloud Console > Credentials > Edit |
| "Access blocked: This app's request is invalid" | The OAuth consent screen isn't configured. Complete Part 3 |
| No refresh token returned | Google only sends a refresh token on first authorization. Go to [myaccount.google.com/permissions](https://myaccount.google.com/permissions), remove "Family Calendar", then re-authorize |

### Sync Issues

| Symptom | Fix |
|---------|-----|
| Some calendars missing | New calendars are discovered automatically on each sync. Wait 5 minutes or restart the server |
| Shared calendars not showing | The calendar must be added to your Google Calendar (visible in the left sidebar on calendar.google.com) |
| Tasks not appearing | Make sure Google Tasks API is enabled (Part 2) and you authorized the `tasks.readonly` scope |
| "No Google credentials" in logs | Credentials may not have saved. Re-connect from Admin > Accounts |

### Re-Authorizing

If you need to start fresh:

1. Admin panel > Accounts > click **Disconnect** on the Google account
2. Go to [myaccount.google.com/permissions](https://myaccount.google.com/permissions) and remove "Family Calendar"
3. Re-connect from Admin > Accounts > Connect Google Calendar

---

## ICS Alternative

If setting up a Cloud project is too much hassle, you can add Google
Calendar events via an ICS feed URL instead:

1. Go to [calendar.google.com](https://calendar.google.com)
2. In the left sidebar, hover over the calendar you want > click the **three dots** > **Settings and sharing**
3. Scroll down to **Integrate calendar**
4. Copy the **Secret address in iCal format** (the URL ending in `basic.ics`)
5. In the admin panel > Accounts > **Add Calendar Feed (ICS URL)** > paste the URL

**Limitations:**
- Read-only (which is fine for a display)
- No Google Tasks (tasks require the full API)
- One URL per calendar (no auto-discovery)
- Sync delay: Google caches ICS feeds for 5-30 minutes
