# Apple Shortcuts Setup for Reminders Sync

Since Apple dropped CalDAV support for Reminders in iOS 13, we use an
Apple Shortcut on each iPhone to periodically push reminder data to
the calendar display's webhook endpoint.

> **Time to complete:** ~5 minutes per phone

The Shortcut sends a simple pipe-delimited text format (not JSON), so
there are no brackets, quotes, or escaping to worry about.

---

## Part 1: Create a New Shortcut

1. Open the **Shortcuts** app on your iPhone
2. Tap **+** (top-right) to create a new Shortcut
3. Tap the name at the top (the **⌄** arrow), tap **Rename**, and type:

```
Sync Family Reminders
```

---

## Part 2: Add "Find Reminders"

1. Tap **Search for apps and actions** at the bottom
2. Search for **Find Reminders** and tap it
3. Tap **Add Filter** → change the first dropdown to **List** → select **Family**
4. Tap **Add Filter** again → change to **Is Completed** → set to **is No**

```
┌─────────────────────────────────┐
│  Find Reminders                 │
│                                 │
│  Find  [All Reminders]  where   │
│  [List]         [is]  [Family]  │
│  [Is Completed] [is]  [No]     │
│                                 │
│  + Add Filter         Sort By ▸ │
└─────────────────────────────────┘
```

---

## Part 3: Add the Loop (Repeat with Each)

This loops through each reminder to capture its individual due date.

### 3.1 Add "Repeat with Each"

1. Search for **Repeat with Each** and tap it
2. Verify it says **Repeat with each item in [Reminders]** at the top
   (the word "Reminders" should be a colored bubble linked to the
   Find Reminders action)

### 3.2 Add "Format Date" INSIDE the Loop

This must go between "Repeat with each" and "End Repeat".

1. Search for **Format Date** and tap it
2. Tap the input (it may say "Current Date") → select **Repeat Item**
3. Tap the blue **Repeat Item** bubble → set **Type** to **Due Date**
4. Tap the format (e.g., "Short") → select **Custom**
5. Type exactly: `yyyy-MM-dd'T'HH:mm:ssZ`
6. Tap **Done**

```
│  Repeat with each item in [Reminders]  │
│                                        │
│  ┌────────────────────────────────┐    │
│  │  Format Date                   │    │
│  │  Format [Repeat Item]          │    │
│  │          (Due Date)            │    │
│  │  as  Custom                    │    │
│  │  yyyy-MM-dd'T'HH:mm:ssZ       │    │
│  └────────────────────────────────┘    │
```

### 3.3 Add "Text" INSIDE the Loop (Below Format Date)

This builds one line per reminder in a simple pipe-separated format.
**All on one line — do not press Return/Enter.**

The format is: `title|||dueDate|||notes|||priority`

1. Search for **Text** and tap the plain **Text** action
2. Build the text by typing and inserting magic variables in this order:

| Step | What to do |
|------|------------|
| a | Tap the magic variable button (✦ wand), select **Repeat Item**, then tap the blue bubble and set **Type** to **Name** |
| b | Type: `\|\|\|` (three pipe characters — hold the pipe key) |
| c | Tap the magic variable button, select **Formatted Date** (the output of Format Date above) |
| d | Type: `\|\|\|` |
| e | Tap the magic variable button, select **Repeat Item**, set **Type** to **Notes** |
| f | Type: `\|\|\|` |
| g | Tap the magic variable button, select **Repeat Item**, set **Type** to **Priority** |

The finished Text action should look like this (colored bubbles
represent magic variables):

```
│  ┌────────────────────────────────┐    │
│  │  Text                          │    │
│  │                                │    │
│  │  [Name]|||[Formatted Date]     │    │
│  │  |||[Notes]|||[Priority]       │    │
│  └────────────────────────────────┘    │
```

> **Important:** This must be **one continuous line**. The diagram
> above wraps it for readability, but on your phone it should not
> have any line breaks.

### 3.4 Add "Add to Variable" INSIDE the Loop (Below Text)

1. Search for **Add to Variable** and tap it
2. Set the variable name to: `reminderLines`
3. The input should automatically connect to the **Text** action above

```
│  ┌────────────────────────────────┐    │
│  │  Add [Text] to                 │    │
│  │  [reminderLines]               │    │
│  └────────────────────────────────┘    │
│                                        │
│  End Repeat                            │
```

---

## Part 4: Combine and Send (OUTSIDE the Loop)

Everything from here goes **below** the "End Repeat" line.

### 4.1 Add "Combine Text"

1. Search for **Combine Text** and tap it
2. Set the input to **reminderLines** (your variable)
3. Set **Separator** to **New Line**

```
┌──────────────────────────────────┐
│  Combine Text                    │
│                                  │
│  Combine [reminderLines]         │
│  with  [New Line]  separator     │
└──────────────────────────────────┘
```

### 4.2 Add a "Text" Action for the Final Payload

1. Search for **Text** and tap it
2. On the **first line**, type: `syncedBy:Trevor`
3. Press **Return** (this is the one place you DO press Enter)
4. On the second line, tap the magic variable button and select
   **Combined Text** (from the Combine Text action above)

```
┌──────────────────────────────────┐
│  Text                            │
│                                  │
│  syncedBy:Trevor                 │
│  [Combined Text]                 │
└──────────────────────────────────┘
```

> **For Larissa's phone:** Change `Trevor` to `Larissa`

### 4.3 Add "Get Contents of URL" (The POST Request)

1. Search for **Get Contents of URL** and tap it
2. In the URL field, type your server address:

```
http://YOUR_SERVER_ADDRESS:3000/api/reminders/sync
```

Replace `YOUR_SERVER_ADDRESS` with:
- Your Pi's local IP, e.g., `192.168.1.100`
- Or `familycal.local` if mDNS is set up
- Or your Mac's local IP for testing (e.g., `192.168.1.50`)

3. Tap **Advanced** (or the ▸ arrow) to expand options
4. Change **Method** to **POST**
5. Under **Headers**, tap **Add new header**:

   | Key               | Value              |
   |-------------------|--------------------|
   | `Content-Type`    | `text/plain`       |

   Tap **Add new header** again:

   | Key                | Value                     |
   |--------------------|---------------------------|
   | `X-Webhook-Secret` | *(your secret from .env)* |

   > **Finding your secret:** On your Mac, open Terminal and run:
   > ```
   > grep WEBHOOK_SECRET ~/family-calendar/.env
   > ```
   > Copy the value after the `=` sign.

6. Under **Request Body**, change it to **File**
7. For the file input, select **Text** (the output of step 4.2)

```
┌──────────────────────────────────┐
│  Get Contents of URL             │
│                                  │
│  URL: http://192.168.1.50:         │
│       3000/api/reminders/sync    │
│                                  │
│  ▼ Advanced                      │
│  Method:  POST                   │
│                                  │
│  Headers:                        │
│  ┌────────────────┬────────────┐ │
│  │ Content-Type   │ text/plain │ │
│  ├────────────────┼────────────┤ │
│  │ X-Webhook-     │ mysecret   │ │
│  │ Secret         │            │ │
│  └────────────────┴────────────┘ │
│                                  │
│  Request Body: [File]            │
│  [Text]                          │
└──────────────────────────────────┘
```

---

## Part 5: Verify the Complete Shortcut

Your finished shortcut should have these actions in this exact order:

```
┌──────────────────────────────────────────┐
│  Sync Family Reminders                   │
│──────────────────────────────────────────│
│                                          │
│  1. Find Reminders                       │
│     List is Family, Is Completed is No   │
│                                          │
│  2. Repeat with Each [Reminders]         │
│     │                                    │
│     │  3. Format Date                    │
│     │     [Repeat Item (Due Date)]       │
│     │     Custom: yyyy-MM-dd'T'HH:mm:ssZ│
│     │                                    │
│     │  4. Text                           │
│     │     [Name]|||[Formatted Date]      │
│     │     |||[Notes]|||[Priority]        │
│     │                                    │
│     │  5. Add to Variable                │
│     │     [reminderLines]                │
│     │                                    │
│     End Repeat                           │
│                                          │
│  6. Combine Text                         │
│     [reminderLines] with New Line        │
│                                          │
│  7. Text                                 │
│     syncedBy:Trevor                      │
│     [Combined Text]                      │
│                                          │
│  8. Get Contents of URL                  │
│     POST to server with text/plain body  │
│                                          │
└──────────────────────────────────────────┘
```

### Run a Test

Tap the **▶ Play** button to run the shortcut manually.

**What success looks like:**
- Shortcut finishes without errors
- Server terminal shows: `[Reminders] Received 6 items from Trevor`
- The display shows your reminders within 60 seconds

**What failure looks like:**

| You see...                          | Fix |
|-------------------------------------|-----|
| "Could not connect to the server"   | Check the IP address. Is the server running? Are you on the same Wi-Fi? |
| Error 401                           | The `X-Webhook-Secret` header doesn't match the `.env` value |
| Error 400                           | Check the server terminal for the raw body — likely a wiring issue in the Shortcut |
| Shortcut seems to hang              | Network timeout. Try `curl http://SERVER_IP:3000/api/health` from a Mac to test connectivity |

**Verify on the server side:**

```bash
curl -s http://localhost:3000/api/health | python3 -m json.tool
```

Look for `"remindersCount"` > 0.

---

## Part 6: Set Up Automations (Auto-Run Throughout the Day)

### 6.1 Create a Time-Based Automation

1. Open **Shortcuts** → tap the **Automation** tab (bottom center)
2. Tap **+** → **Time of Day**
3. Set the time to **7:00 AM**, Repeat: **Daily**
4. Tap **Next**
5. Select **Run Immediately** (not "Ask Before Running")
6. Tap **Next** → search for **Sync Family Reminders** → tap **Done**

### 6.2 Repeat for Additional Times

| Time     | Why                                   |
|----------|---------------------------------------|
| 7:00 AM  | Morning sync                          |
| 12:00 PM | Midday check                          |
| 6:00 PM  | Evening — catch workday additions     |
| 9:00 PM  | Night sync before display dims        |

> **Tip:** Long-press an existing automation → **Duplicate** → just
> change the time. Faster than building each from scratch.

### 6.3 (Optional) Arrive Home Automation

1. Automation tab → **+** → **Arrive**
2. Search for your home address, set radius to Small (~100m)
3. Select **Run Immediately** → **Sync Family Reminders** → **Done**

---

## Part 7: Share to Larissa's Phone

1. On your iPhone, long-press **Sync Family Reminders** → **Share**
2. **AirDrop** it to Larissa (or copy iCloud Link and text it)
3. On Larissa's phone: accept the shortcut, then edit it
4. In the final **Text** action (step 4.2), change `syncedBy:Trevor`
   to `syncedBy:Larissa`
5. Verify the URL in "Get Contents of URL" is correct
6. Set up automations (Part 6) on Larissa's phone too

---

## What the Server Receives

The Shortcut sends plain text like this:

```
syncedBy:Trevor
Deep clean kitchen|||2026-03-22T20:00:00-0500|||Pick up supplies first|||0
Get passports|||2026-04-01T09:00:00-0500||||0
Call dentist|||2026-03-25T14:00:00-0500|||Ask about insurance|||1
```

Each line after the header is one reminder:
`title|||dueDate|||notes|||priority`

The server parses this into structured data. No JSON to get wrong.

---

## Troubleshooting

### Shortcut Won't Run

| Symptom                              | Fix |
|--------------------------------------|-----|
| "An error occurred" with no details  | Settings → Shortcuts → Advanced → enable **Allow Running Scripts** and **Allow Sharing Large Amounts of Data** |
| "Couldn't communicate with helper"   | Force-quit Shortcuts and reopen |
| Automation says "Ask Before Running" | Edit the automation → change to **Run Immediately** |
| Magic variable shows wrong type      | Tap the blue bubble → change **Type** to the correct property (Name, Notes, Due Date, Priority) |

### Server Rejects the Request

| Symptom                  | Fix |
|--------------------------|-----|
| Error 401 Unauthorized   | `X-Webhook-Secret` header must exactly match `.env` value (no extra spaces) |
| Error 400 Bad Request    | Check server terminal for raw body — look for malformed output |
| Error 404 Not Found      | URL path must be exactly `/api/reminders/sync` |
| Can't connect to server  | Check: 1) Server running? 2) Same Wi-Fi? 3) Try IP instead of `.local` hostname |

### Reminders Don't Appear on Display

| Symptom               | Fix |
|------------------------|-----|
| remindersCount: 0      | Run the Shortcut manually first |
| Sync ran, display empty| Wait 60 seconds (display polls every minute) or refresh browser |
| Only some reminders    | Check the "Find Reminders" filter — make sure List is set to the right one |
