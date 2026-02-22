# Apple Shortcuts Setup for Reminders Sync

Since Apple dropped CalDAV support for Reminders in iOS 13, we use an
Apple Shortcut on each iPhone to periodically push reminder data to
the calendar display's webhook endpoint.

> **Time to complete:** ~10 minutes per phone

---

## Part 1: Create a New Shortcut

### 1.1 Open the Shortcuts App

Find the **Shortcuts** app on your iPhone. It has a blue and pink
overlapping-squares icon. If you can't find it, swipe down on your
Home Screen and type "Shortcuts" into the search bar.

### 1.2 Tap the + Button

In the top-right corner, tap the **+** button to create a new Shortcut.

```
┌─────────────────────────────────┐
│  Shortcuts           All  (+)   │
│─────────────────────────────────│
│                                 │
│   Your existing shortcuts       │
│   will appear here...           │
│                                 │
│                     Tap (+) ──► │
└─────────────────────────────────┘
```

### 1.3 Name Your Shortcut

At the very top of the new shortcut editor, you'll see a down-arrow
**⌄** next to the default name. Tap it, then tap **Rename**. Type:

```
Sync Family Reminders
```

Tap **Done** on the keyboard.

```
┌─────────────────────────────────┐
│  ◄  Sync Family Reminders  ⌄   │
│─────────────────────────────────│
│                                 │
│  Search for apps and actions    │
│                                 │
│  (empty — we'll add actions     │
│   in the next steps)            │
│                                 │
└─────────────────────────────────┘
```

---

## Part 2: Add the "Find Reminders" Action

This is the action that reads your Family Reminders list.

### 2.1 Add the Action

Tap the **search bar** at the bottom of the shortcut editor that says
**"Search for apps and actions"**. Type:

```
Find Reminders
```

Tap **Find Reminders** when it appears in the search results. It has
a Reminders app icon (a blue circle with a white checklist).

### 2.2 Configure the Filter

You should now see the action card in your shortcut:

```
┌─────────────────────────────────┐
│  🔵 Find Reminders              │
│                                 │
│  Find  [All Reminders]          │
│                                 │
│  + Add Filter         Sort By ▸ │
└─────────────────────────────────┘
```

**Add a filter to only get Family reminders:**

1. Tap **Add Filter**
2. You'll see a row of filter options appear. The first dropdown
   defaults to "Reminder". Tap it and change it to **List**
3. The filter now reads: `List  is  ______`
4. Tap the blank value on the right — your Reminders lists will appear
5. Select **Family** from the list

**Add another filter to exclude completed items (recommended):**

1. Tap **Add Filter** again
2. Change the first dropdown to **Is Completed**
3. Set the condition to **is No**

Your action card should now look like:

```
┌─────────────────────────────────┐
│  🔵 Find Reminders              │
│                                 │
│  Find  [All Reminders]  where   │
│                                 │
│  [List]       [is]  [Family]    │
│  [Is Completed] [is] [No]       │
│                                 │
│  + Add Filter         Sort By ▸ │
└─────────────────────────────────┘
```

---

## Part 3: Add the Loop

We need to go through each reminder and build a JSON string for it.

### 3.1 Add a "Repeat with Each" Action

Tap the search bar again and type:

```
Repeat with Each
```

Tap it when it appears. This creates a loop block. The action
should automatically connect to the output of "Find Reminders":

```
┌─────────────────────────────────┐
│  🔁 Repeat with each item in    │
│     [Reminders]                  │
│                                 │
│    (empty — we'll add actions   │
│     inside here next)           │
│                                 │
│  End Repeat                     │
└─────────────────────────────────┘
```

> **Check:** The word **"Reminders"** at the top of the loop should be
> highlighted in a colored bubble — this means it's connected to the
> output of the Find Reminders action above. If it says something else,
> tap it and select **Reminders** from the list.

### 3.2 Add a "Format Date" Action INSIDE the Loop

We need to convert each reminder's due date into a format the
server understands. **Make sure you add this action INSIDE the loop**
(between "Repeat with each" and "End Repeat").

1. Tap the search bar and type: **Format Date**
2. Tap the **Format Date** action when it appears

You'll see:

```
│  🔁 Repeat with each item in    │
│     [Reminders]                  │
│                                 │
│  ┌─────────────────────────────┐│
│  │  📅 Format Date              ││
│  │                              ││
│  │  Format [Current Date]       ││
│  │  as  [Short]                 ││
│  └─────────────────────────────┘│
```

3. Tap **"Current Date"** (the blue variable bubble) — a pop-up will
   appear with variable options
4. Scroll up in the pop-up and tap **"Repeat Item"** — this is the
   current reminder in the loop
5. After selecting Repeat Item, tap the **blue** Repeat Item bubble
   again. A sheet will appear at the bottom of the screen. Look for
   a **Type** row. Tap it and choose **Due Date**

> The action should now say: `Format [Repeat Item (Due Date)]`

6. Now tap **"Short"** (the date format). A menu will appear.
   Scroll down and select **Custom**
7. In the custom format field, type exactly:

```
yyyy-MM-dd'T'HH:mm:ssZ
```

8. Tap **Done**

Your action should now look like:

```
│  ┌─────────────────────────────┐│
│  │  📅 Format Date              ││
│  │                              ││
│  │  Format [Repeat Item]        ││
│  │         (Due Date)           ││
│  │  as  [Custom]                ││
│  │  yyyy-MM-dd'T'HH:mm:ssZ     ││
│  └─────────────────────────────┘│
```

### 3.3 Add a "Text" Action INSIDE the Loop (Below Format Date)

This builds a JSON string for each reminder. **Make sure this is
inside the loop, below the Format Date action.**

1. Tap the search bar and type: **Text**
2. Tap the plain **Text** action (not "Rich Text" — look for the
   icon with lined paper, or the one that just says "Text")

A text box will appear inside the loop. Type the following
**exactly** — this is a JSON template. You'll insert magic variable
tokens where shown in `[brackets]`:

```
{"title":"[NAME]","notes":"[NOTES]","dueDate":"[FORMATTED DATE]","isCompleted":false,"priority":[PRIORITY],"list":"Family"}
```

**Here's how to insert the magic variables** (the parts in brackets):

This must all be typed on **one line** in the Text action. Follow
this sequence character by character:

1. Type: `{"title":"`
2. Now insert the reminder's name: Tap the text field to make sure
   your cursor is positioned right after the `"`. Then tap the
   magic variable button — it looks like a **wand icon** (✦) or
   appears as a horizontal pill-shaped bar above the keyboard. You
   should see a row of suggested variables. Find and tap
   **Repeat Item**. After tapping it, tap the **blue Repeat Item**
   bubble that was just inserted. A details sheet appears. Set
   **Type** to **Name**. The bubble should now say "Name".
3. Type: `","notes":"`
4. Insert magic variable again: **Repeat Item** → set Type to **Notes**
5. Type: `","dueDate":"`
6. Insert magic variable: **Formatted Date** (this is the output of
   the Format Date action you added in step 3.2)
7. Type: `","isCompleted":false,"priority":`
8. Insert magic variable: **Repeat Item** → set Type to **Priority**
9. Type: `,"list":"Family"}`

> **Important:** Do NOT press Return/Enter at any point. This must
> be one continuous line.

When finished, the Text action should look something like this
(the colored bubbles represent magic variables):

```
│  ┌─────────────────────────────┐│
│  │  📝 Text                     ││
│  │                              ││
│  │ {"title":"[Name]","notes":   ││
│  │ "[Notes]","dueDate":         ││
│  │ "[Formatted Date]",          ││
│  │ "isCompleted":false,         ││
│  │ "priority":[Priority],       ││
│  │ "list":"Family"}             ││
│  └─────────────────────────────┘│
```

(On your screen the variable names will appear as colored inline
bubbles within the text — that's normal.)

### 3.4 Add "Add to Variable" INSIDE the Loop (Below the Text Action)

This collects each reminder's JSON text into a list.

1. Search for: **Add to Variable**
2. Tap it when it appears
3. Set the **Variable Name** to: `jsonItems`
4. The **Input** should automatically be connected to the Text
   action above it. If not, tap the input field and select
   **Text** from the suggestions.

```
│  ┌─────────────────────────────┐│
│  │  📦 Add to Variable          ││
│  │                              ││
│  │  Add [Text] to               ││
│  │  [jsonItems]                 ││
│  └─────────────────────────────┘│
│                                 │
│  End Repeat                     │
```

---

## Part 4: Combine and Send (OUTSIDE the Loop)

Everything from here goes **below** the "End Repeat" line.

### 4.1 Add "Combine Text" Action (Below End Repeat)

1. Search for: **Combine Text**
2. Tap the action when it appears
3. The input should be **jsonItems** (your variable). If it's not
   connected, tap the input and choose the **jsonItems** variable
4. Set **Separator** to: **Custom**
5. In the custom separator field, type a single comma: `,`

```
┌─────────────────────────────────┐
│  End Repeat                     │
│                                 │
│  📝 Combine Text                │
│                                 │
│  Combine [jsonItems]            │
│  with  [Custom]  separator      │
│  ,                              │
└─────────────────────────────────┘
```

### 4.2 Add a "Text" Action to Build the Final JSON Payload

1. Search for: **Text**
2. Tap the plain Text action
3. Type the following:

```
{"items":[COMBINED TEXT],"syncedBy":"Trevor"}
```

**To insert the magic variable:**

1. Type: `{"items":[`
2. Tap the magic variable button (✦ wand icon)
3. Select **Combined Text** (from the Combine Text action above)
4. Type: `],"syncedBy":"Trevor"}`

> **For Larissa's phone:** Change `"Trevor"` to `"Larissa"`

```
┌─────────────────────────────────┐
│  📝 Text                        │
│                                 │
│  {"items":[[Combined Text]],    │
│  "syncedBy":"Trevor"}           │
└─────────────────────────────────┘
```

### 4.3 Add "Get Contents of URL" Action (The POST Request)

This sends the reminder data to your calendar display.

1. Search for: **Get Contents of URL**
2. Tap the action (it has a Safari/globe icon)
3. You'll see a URL field. Type your Pi's address:

```
http://YOUR_PI_ADDRESS:3000/api/reminders/sync
```

Replace `YOUR_PI_ADDRESS` with one of:
- Your Pi's local IP, e.g., `192.168.1.100`
- Or `familycal.local` if mDNS is set up
- Or your Pi's Tailscale IP, e.g., `100.x.x.x`

> **Tip:** To find your Pi's IP, run `hostname -I` on the Pi.

4. Tap **"Advanced"** to expand the options (on iOS 17+, you may
   need to tap a small arrow ▸ next to the URL to reveal settings)

5. Change **Method** from "GET" to **POST**

6. Under **Headers**, tap **"Add new header"**:

   | Key               | Value                  |
   |-------------------|------------------------|
   | `Content-Type`    | `application/json`     |

   Tap **"Add new header"** again:

   | Key                | Value                       |
   |--------------------|-----------------------------|
   | `X-Webhook-Secret` | *(your secret from .env)*   |

   > **Finding your secret:** On your Mac, open Terminal and run:
   > ```
   > grep WEBHOOK_SECRET ~/family-calendar/.env
   > ```
   > Copy the value after the `=` sign.

7. Under **Request Body**, tap and change it to **File**

8. For the File input, tap it and select **Text** — this is the
   output of the Text action from step 4.2 (the complete JSON payload)

Your final action should look like:

```
┌─────────────────────────────────┐
│  🌐 Get Contents of URL         │
│                                 │
│  URL: http://192.168.1.100:     │
│       3000/api/reminders/sync   │
│                                 │
│  ▼ Advanced                     │
│  Method:  POST                  │
│                                 │
│  Headers:                       │
│  ┌──────────────┬─────────────┐ │
│  │Content-Type  │application/ │ │
│  │              │json         │ │
│  ├──────────────┼─────────────┤ │
│  │X-Webhook-    │mysecrethere │ │
│  │Secret        │             │ │
│  └──────────────┴─────────────┘ │
│                                 │
│  Request Body: [File]           │
│  [Text]                         │
└─────────────────────────────────┘
```

---

## Part 5: Verify the Complete Shortcut

Your finished shortcut should have these actions in this exact order:

```
┌─────────────────────────────────────────────┐
│  Sync Family Reminders                      │
│─────────────────────────────────────────────│
│                                             │
│  1. 🔵 Find Reminders                       │
│     List is Family                          │
│     Is Completed is No                      │
│                                             │
│  2. 🔁 Repeat with Each [Reminders]         │
│     │                                       │
│     │  3. 📅 Format Date                    │
│     │     Format [Repeat Item (Due Date)]   │
│     │     as Custom: yyyy-MM-dd'T'HH:mm:ssZ│
│     │                                       │
│     │  4. 📝 Text                           │
│     │     {"title":"[Name]","notes":        │
│     │     "[Notes]","dueDate":              │
│     │     "[Formatted Date]",               │
│     │     "isCompleted":false,              │
│     │     "priority":[Priority],            │
│     │     "list":"Family"}                  │
│     │                                       │
│     │  5. 📦 Add to Variable [jsonItems]    │
│     │                                       │
│     End Repeat                              │
│                                             │
│  6. 📝 Combine Text                         │
│     Combine [jsonItems] with comma          │
│                                             │
│  7. 📝 Text                                 │
│     {"items":[[Combined Text]],             │
│     "syncedBy":"Trevor"}                    │
│                                             │
│  8. 🌐 Get Contents of URL                  │
│     POST to Pi with JSON body              │
│                                             │
└─────────────────────────────────────────────┘
```

### Run a Test

Tap the **▶ Play** button in the bottom-right corner of the shortcut
editor to run the shortcut manually.

**What success looks like:**
- The shortcut runs for a few seconds and finishes without errors
- You might briefly see a notification or the result of the URL request

**What failure looks like and how to fix it:**

| You see...                          | What it means                    | Fix                                              |
|-------------------------------------|----------------------------------|---------------------------------------------------|
| "Could not connect to the server"   | Pi isn't reachable               | Check the IP address. Make sure Pi is on and running the server |
| "The request returned error 401"    | Wrong webhook secret             | Double-check the `X-Webhook-Secret` header matches your `.env` file |
| "The request returned error 400"    | Malformed JSON                   | Check the Text actions for typos — missing quotes, commas, or brackets |
| "No reminders found"               | Family list is empty or filtered | Add a test reminder to your Family list and try again |
| Shortcut seems to hang/freeze      | Network timeout                  | Check Wi-Fi. Make sure the Pi server is running: `curl http://PI_IP:3000/api/health` |

**Verify on the server side (from your Mac's Terminal):**

```bash
curl -s http://localhost:3000/api/health | python3 -m json.tool
```

Look for `"remindersCount"` — it should be greater than 0 after a
successful sync.

---

## Part 6: Set Up Automations (Auto-Run Throughout the Day)

Automations make the shortcut run on a schedule without you having
to manually tap anything.

### 6.1 Open the Automation Tab

1. Open the **Shortcuts** app
2. Tap the **Automation** tab at the bottom of the screen (middle tab)

```
┌─────────────────────────────────┐
│                                 │
│   Shortcuts  Automation  Gallery│
│      ○          ●          ○    │
└─────────────────────────────────┘
```

### 6.2 Create a Time-Based Automation

1. Tap the **+** button in the top-right corner
2. Tap **Time of Day**

```
┌─────────────────────────────────┐
│  New Automation                 │
│─────────────────────────────────│
│                                 │
│  Personal                       │
│  ──────────                     │
│  ⏰ Time of Day                 │  ← Tap this
│  📍 Arrive                      │
│  📍 Leave                       │
│  💬 Message                     │
│  ...                            │
└─────────────────────────────────┘
```

3. Set the time to **7:00 AM**
4. Set **Repeat** to **Daily**
5. Tap **Next** (top-right)
6. You should see **"Run Immediately"** vs **"Ask Before Running"**.
   Select **Run Immediately**

> This is important! If you select "Ask Before Running", you'll get
> a notification every time and have to tap to confirm — defeats the
> purpose of automation.

7. Tap **Next** again
8. Search for and select **"Sync Family Reminders"** (the shortcut
   you just created)
9. Tap **Done**

### 6.3 Repeat for Additional Times

Create the same automation for each of these times so reminders
sync throughout the day:

| Time       | Why                              |
|------------|----------------------------------|
| 7:00 AM    | Morning sync — catch overnight additions |
| 9:00 AM    | Start of workday                 |
| 12:00 PM   | Midday check                     |
| 3:00 PM    | Afternoon check                  |
| 6:00 PM    | Evening — catch workday additions |
| 9:00 PM    | Night sync before display dims   |

For each one, repeat steps 6.2.1 through 6.2.9, just changing the
time in step 3.

> **Tip:** After creating the first automation, you can long-press on
> it, tap **Duplicate**, and just change the time. This is faster than
> building each from scratch.

### 6.4 (Optional) Arrive Home Automation

This triggers a sync whenever your phone detects you've arrived home,
catching any reminders you added while out.

1. From the Automation tab, tap **+**
2. Tap **Arrive**
3. Tap **Choose** next to Location, then search for your home address
4. Set the radius (Small is fine — ~100m)
5. Tap **Done** on the location picker
6. Select **Run Immediately**
7. Tap **Next**
8. Select **"Sync Family Reminders"**
9. Tap **Done**

---

## Part 7: Share to Larissa's Phone

### 7.1 Share the Shortcut

1. On your iPhone (Trevor), open the **Shortcuts** app
2. Long-press on **"Sync Family Reminders"**
3. Tap **Share**
4. Choose **AirDrop** and send it to Larissa's iPhone

> **Alternative:** Tap **Copy iCloud Link**, then text or email the
> link to Larissa. She can tap it to import the shortcut.

### 7.2 Larissa Imports and Modifies

On Larissa's iPhone:

1. Accept the shared shortcut (tap **Add Shortcut**)
2. Open the imported shortcut to edit it
3. **Scroll down** to the second Text action (step 4.2 / action #7)
   — the one that says `"syncedBy":"Trevor"`
4. Change `Trevor` to `Larissa`

```
BEFORE:  {"items":[[Combined Text]],"syncedBy":"Trevor"}
AFTER:   {"items":[[Combined Text]],"syncedBy":"Larissa"}
```

5. Also verify the URL in "Get Contents of URL" is correct — it
   should point to the same Pi address

### 7.3 Set Up Automations on Larissa's Phone

Repeat **Part 6** (all the automation steps) on Larissa's iPhone.
Both phones syncing gives you redundancy — if one phone is dead or
away from home, the other still keeps the display updated.

---

## Part 8: Add a Home Screen Widget (Optional)

For quick manual syncs (e.g., after adding several new reminders):

### iPhone (iOS 17+)

1. Long-press on a blank area of your Home Screen
2. Tap **+** in the top-left corner
3. Search for **Shortcuts**
4. Choose the small (1×1) widget size
5. Tap **Add Widget**
6. While still in edit mode, tap the widget
7. Select **"Sync Family Reminders"** as the shortcut to display
8. Tap **Done**

You now have a one-tap sync button on your Home Screen.

---

## Quick Reference: What Each Action Does

| # | Action             | Purpose                                       |
|---|---------------------|-----------------------------------------------|
| 1 | Find Reminders      | Reads all incomplete items from the Family list |
| 2 | Repeat with Each    | Loops through each reminder one at a time      |
| 3 | Format Date         | Converts the due date to ISO 8601 format       |
| 4 | Text (in loop)      | Builds a JSON string for one reminder          |
| 5 | Add to Variable     | Adds that JSON string to a growing collection  |
| 6 | Combine Text        | Joins all JSON strings with commas             |
| 7 | Text (final)        | Wraps everything in the `{"items":[...]}` structure |
| 8 | Get Contents of URL | Sends the data to the Pi via HTTP POST         |

---

## Troubleshooting

### The Shortcut Won't Run

| Symptom                                    | Cause                           | Solution |
|--------------------------------------------|---------------------------------|----------|
| "An error occurred" with no details        | Permissions not granted         | Go to **Settings → Shortcuts → Advanced** and enable **Allow Running Scripts** and **Allow Sharing Large Amounts of Data** |
| "Couldn't communicate with a helper app"   | Shortcuts needs a restart       | Force-quit Shortcuts (swipe up from app switcher), then reopen |
| Automation says "Ask Before Running"       | Wrong setting during setup      | Edit the automation, change to **Run Immediately** |
| Magic variable shows wrong type            | Repeat Item type not set        | Tap the blue variable bubble → change Type to the correct property (Name, Notes, etc.) |

### The Server Rejects the Request

| Symptom                           | Cause                    | Solution |
|-----------------------------------|--------------------------|----------|
| Error 401 Unauthorized            | Wrong webhook secret     | Compare the `X-Webhook-Secret` header value to the `WEBHOOK_SECRET` value in your `.env` file — they must match exactly, no extra spaces |
| Error 400 Bad Request             | Malformed JSON body      | Common issues: missing comma between fields, extra comma at the end, missing quotation marks around string values. Check the Text actions carefully |
| Error 404 Not Found               | Wrong URL path           | The path must be exactly `/api/reminders/sync` (check for typos) |
| "Could not connect to the server" | Network/server issue     | 1) Is the Pi on? 2) Is the server running? (`ssh pi@IP 'systemctl status family-calendar'`) 3) Are you on the same Wi-Fi? 4) Try the IP address instead of `.local` hostname |

### Reminders Don't Appear on the Display

| Symptom                           | Cause                    | Solution |
|-----------------------------------|--------------------------|----------|
| `remindersCount: 0` in health API | Shortcut hasn't run yet  | Run the shortcut manually once |
| Sync ran but display is empty     | Display not refreshing   | Wait 60 seconds (the display polls every minute) or refresh the browser |
| Only some reminders appear        | Filter is too strict     | Check the "Find Reminders" filters — make sure it's set to the right list |
| Reminder data looks garbled       | Encoding issue           | Make sure the Text action content is typed manually (not pasted from a formatted source that might add invisible characters) |
