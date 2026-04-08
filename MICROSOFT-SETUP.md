# Microsoft Calendar & To Do Setup

Full integration with Microsoft Outlook Calendar and Microsoft To Do
via OAuth2. This gives you automatic calendar discovery and read-only
access to your task lists.

> **Time to complete:** ~10 minutes
>
> **Easier alternative:** If you only need calendar events (not tasks)
> and don't mind a sync delay, use **Add Calendar Feed (ICS URL)** in
> the admin panel instead. See [ICS feed instructions](#ics-alternative) at the bottom.
>
> **No Azure subscription needed.** App registrations are free for all
> Microsoft accounts (personal, work, and school).

---

## Part 1: Register an App in Azure

1. Go to [Azure App Registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Sign in with the Microsoft account that has your calendars

   > **First time in Azure?** You may see a welcome screen or be asked
   > to set up a directory. Just follow the prompts — no paid
   > subscription or credit card is required for app registrations.

3. Click **+ New registration** at the top

4. Fill in:

   | Field | Value |
   |-------|-------|
   | Name | `Family Calendar` |
   | Supported account types | Choose based on your account type (see below) |
   | Redirect URI | (leave blank for now — we'll add it in Part 3) |

   **Which account type?**

   | Your situation | Choose |
   |---------------|--------|
   | Personal Microsoft/Outlook.com account only | **Personal Microsoft accounts only** |
   | Work or school (Microsoft 365) account only | **Accounts in this organizational directory only** |
   | Both personal and work/school | **Accounts in any organizational directory and personal Microsoft accounts** |

   > **Not sure?** Pick "Accounts in any organizational directory and
   > personal Microsoft accounts" — it works for all account types.

5. Click **Register**

6. You'll land on the app's **Overview** page. Note the **Application (client) ID** — you'll need it later:

   ```
   Application (client) ID:  xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```

---

## Part 2: Create a Client Secret

1. In the left sidebar of your app, click **Certificates & secrets**
2. Click **+ New client secret**
3. Fill in:

   | Field | Value |
   |-------|-------|
   | Description | `Family Calendar` |
   | Expires | **24 months** (maximum) |

4. Click **Add**

5. **Immediately copy the "Value" column** (not the "Secret ID"):

   ```
   Value:     xxxx~xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   Secret ID: (ignore this one)
   ```

   > **Important:** The secret value is only shown once. If you navigate
   > away without copying it, you'll need to create a new one.

---

## Part 3: Add the Redirect URI

1. In the left sidebar, click **Authentication**
2. Under **Platform configurations**, click **+ Add a platform**
3. Select **Web**
4. Enter the redirect URI:

   ```
   http://YOUR_SERVER_ADDRESS:3000/api/auth/microsoft/callback
   ```

   Replace `YOUR_SERVER_ADDRESS` with your actual server address:

   | Setup | Example redirect URI |
   |-------|---------------------|
   | Local development (Mac) | `http://localhost:3000/api/auth/microsoft/callback` |
   | Raspberry Pi on LAN | `http://192.168.1.100:3000/api/auth/microsoft/callback` |
   | Pi with hostname | `http://familycal.local:3000/api/auth/microsoft/callback` |

   > **Tip:** The admin panel shows the exact redirect URI to use.
   > Start the server first (`npm start`), go to `/admin` > Accounts >
   > Connect Microsoft Calendar — the URI is displayed in Step 2.

5. Click **Configure**

---

## Part 4: Verify API Permissions

Azure apps come with `User.Read` permission by default. You need to add
Calendar and Tasks permissions.

1. In the left sidebar, click **API permissions**
2. Click **+ Add a permission**
3. Select **Microsoft Graph**
4. Select **Delegated permissions**
5. Search for and check these permissions:

   | Permission | Description |
   |-----------|-------------|
   | `Calendars.Read` | Read your calendars |
   | `Tasks.Read` | Read your tasks and task lists |
   | `User.Read` | Sign in and read your profile (already added by default) |

6. Click **Add permissions**

Your permissions list should look like:

```
┌─────────────────────────────────────────┐
│  API / Permissions name     Status      │
├─────────────────────────────────────────┤
│  Calendars.Read             Granted     │
│  Tasks.Read                 Granted     │
│  User.Read                  Granted     │
└─────────────────────────────────────────┘
```

> **Note:** For personal Microsoft accounts, these permissions do not
> require admin consent. For work/school accounts, your IT admin may
> need to grant consent — check the "Status" column.

---

## Part 5: Connect in the Admin Panel

1. Open your calendar server: `http://YOUR_SERVER_ADDRESS:3000/admin`
2. Go to **Accounts** tab
3. Click **Connect Microsoft Calendar**
4. Paste your **Application (Client) ID** (from Part 1) and **Client Secret Value** (from Part 2)
5. Click **Authorize with Microsoft**
6. Microsoft's sign-in page opens — sign in and click **Accept**
7. You'll be redirected back to the admin panel with a success message
8. Your calendars and task lists will sync within 5 minutes (or restart the server for immediate sync)

---

## Part 6: Verify It's Working

**Check the admin panel:**
- Accounts tab should show "Microsoft Calendar" with a green dot and the number of calendars found
- Click **Test** to re-verify the connection

**Check the display:**
- Calendar events should appear in the grid
- Microsoft To Do tasks should appear in the reminders sidebar

**Check the server logs:**
Go to Admin > System tab > **Server Logs** and look for lines like:
`[Sync] microsoft: 18, microsoft-tasks: 5`

Use the level filter to show only errors if something isn't working.

---

## Troubleshooting

### Authorization Errors

| Error | Fix |
|-------|-----|
| "redirect_uri does not match" | The redirect URI in Azure doesn't match your server. Check Admin > Connect Microsoft > Step 2, then update it in Azure > Authentication |
| "AADSTS700016: Application not found" | Wrong Client ID. Copy it from Azure > App Registrations > your app > Overview |
| "AADSTS7000215: Invalid client secret" | Secret may have expired or you copied the Secret ID instead of the Value. Create a new secret (Part 2) |
| "Need admin approval" | Your work/school admin hasn't consented. Ask them to approve, or use a personal Microsoft account |
| "invalid_scope" or "Tasks.Read" error | If using a work/school account, Microsoft To Do permissions may be restricted. Calendar will still work without Tasks.Read |

### Sync Issues

| Symptom | Fix |
|---------|-----|
| Some calendars missing | New calendars are discovered on each sync. Wait 5 minutes or restart |
| Shared calendars not showing | The calendar must be added to your Outlook (visible in the sidebar on outlook.com) |
| Tasks not appearing | Verify `Tasks.Read` permission is in Azure > API permissions and status shows "Granted" |
| "Token refresh failed" in logs | Secret may have expired. Create a new one in Azure (Part 2), disconnect, and re-connect |

### Client Secret Expiration

Azure client secrets expire (max 24 months). When your secret expires:

1. Go to [Azure App Registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) > your app > **Certificates & secrets**
2. Create a new client secret (Part 2)
3. In the admin panel, **Disconnect** the Microsoft account
4. **Re-connect** with the same Client ID and the new secret

> **Reminder:** Set a calendar reminder for the expiration date so you
> don't lose sync unexpectedly.

### Re-Authorizing

If you need to start fresh:

1. Admin panel > Accounts > click **Disconnect** on the Microsoft account
2. Go to [account.microsoft.com/consent](https://account.microsoft.com/consent) (for personal accounts) or your organization's enterprise apps page and remove "Family Calendar"
3. Re-connect from Admin > Accounts > Connect Microsoft Calendar

---

## ICS Alternative

If setting up an Azure app is too much hassle, you can add Outlook
calendar events via an ICS feed URL instead:

1. Go to [outlook.com](https://outlook.com) and sign in
2. Click the **gear icon** (top right) > **View all Outlook settings**
3. Go to **Calendar** > **Shared calendars**
4. Under **Publish a calendar**, select the calendar and choose **Can view all details**
5. Click **Publish**
6. Copy the **ICS** link (not the HTML one)
7. In the admin panel > Accounts > **Add Calendar Feed (ICS URL)** > paste the URL

**Limitations:**
- Read-only (which is fine for a display)
- No Microsoft To Do tasks (tasks require the full API)
- One URL per calendar (no auto-discovery)
- Publishing must be enabled per calendar
