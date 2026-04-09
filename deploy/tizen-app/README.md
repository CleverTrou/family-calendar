# Family Calendar on Samsung Smart TVs

Display the Family Calendar on a Samsung TV running Tizen OS. Two approaches:

| Approach | Best for | Effort |
|---|---|---|
| **Built-in browser** (Option A) | Any Samsung smart TV (2015+) | 2 minutes |
| **Sideloaded app** (Option B) | Tizen 2.3+ TVs with Developer Mode | 15 minutes |

Both approaches connect to your Family Calendar server over the local network. The server runs on your Raspberry Pi or Mac — the TV is just a display.

---

## Option A: Built-in Web Browser (simplest)

No Developer Mode, no CLI tools, no sideloading. Just the TV's browser.

### Setup

1. Make sure your **Family Calendar server is running** on your Mac or Pi
2. On the TV remote, press **Home**
3. Open the **Internet** app (Samsung's built-in browser)
4. Navigate to your server URL:
   ```
   http://YOUR-SERVER-IP:3000
   ```
   Find your server IP from the startup log:
   ```
   Server listening at http://192.168.1.50:3000    <-- use this IP
   ```
5. **Bookmark it** for one-click access
6. Tap the **fullscreen button** to hide the URL bar

### Tips

- The calendar is designed as a full-screen web app — it looks identical to the sideloaded app
- Samsung's browser persists bookmarks across power cycles
- The dark theme works well on Samsung QLED and The Frame displays

### Limitations

- Browser URL bar shows briefly on launch
- No custom app icon on the TV home screen
- Browser may reload after long idle periods

---

## Option B: Sideloaded App (Tizen 2.3+)

Packages the calendar as a native Tizen app with its own launcher icon. Requires Developer Mode and either the Tizen CLI or Tizen Studio.

### Prerequisites

1. **Family Calendar server running** on your Mac/Pi
2. **Samsung TV on the same network** running Tizen 2.3 or newer (2015+ models)
3. **Tizen SDK or CLI tools** — install one of:
   - [Tizen Studio](https://developer.tizen.org/development/tizen-studio/download) (full IDE, ~1 GB)
   - Or just the CLI: Tizen Studio > Package Manager > install "Tizen SDK tools" and "TV Extensions"

### Step 1: Enable Developer Mode on your TV

1. On your Samsung TV, go to **Apps**
2. Using the remote, press **1 2 3 4 5** on the number pad (this opens the developer settings)
3. Set **Developer mode** to **On**
4. Enter the **IP address of your development computer** (your Mac/PC, not the Pi)
5. Restart the TV (Settings > General > Restart)

> **Note:** The IP you enter must be the machine running the Tizen CLI tools, not the calendar server.

### Step 2: Configure the server URL

Edit `index.html` and replace the `SERVER_URL` value with your calendar server's local IP:

```javascript
var SERVER_URL = 'http://192.168.1.100:3000';  // <-- your server IP
```

### Step 3: Connect to your TV

```bash
# Connect to your TV using sdb (Smart Development Bridge)
sdb connect YOUR_TV_IP:26101

# Verify the connection
sdb devices
# Should show your TV listed as a device
```

> **Trouble connecting?** Make sure:
> - Developer Mode is enabled and the TV has been restarted
> - Your computer's IP matches the one you entered in the TV's developer settings
> - Both devices are on the same network/VLAN

### Step 4: Package and install

```bash
cd deploy/tizen-app

# Option A: Use the package script (just creates a .wgt with zip)
./package.sh
sdb install FamilyCalendar.wgt

# Option B: Use the Tizen CLI (handles signing)
tizen package -t wgt -o . -- .
tizen install -n FamilyCalendar.wgt -t YOUR_TV_NAME
```

### Step 5: Launch

The app should appear in your TV's **Apps** list. You can also launch from CLI:

```bash
tizen run -p clevertrou.familycalendar -t YOUR_TV_NAME
```

### Updating

After changing the server URL or `index.html`:
```bash
cd deploy/tizen-app
./package.sh
sdb install FamilyCalendar.wgt
```

---

## Samsung The Frame TVs

If you're using a Samsung "The Frame" TV, the calendar display works particularly well as digital art mode content:

- The calendar's dark theme (`#0f0f14` background) blends with The Frame's matte display
- Use the **Display Schedule** feature in Admin > Display to turn the calendar off during sleeping hours
- The Frame's built-in motion sensor can wake the display when someone walks by

However, note that The Frame TVs use OLED or QLED panels — see the burn-in warning below if yours is OLED.

---

## OLED Burn-in Warning

If your Samsung TV uses an OLED panel (S95 series, S90 series), be cautious with always-on display:

- **Use the TV's built-in screen saver** (Settings > General > System Manager > Screen Burn Protection)
- **Set an auto-off timer** (Settings > General > System Manager > Auto Power Off)
- **Leave pixel shift enabled** (on by default for Samsung OLEDs)
- The dark theme helps — OLED pixels are nearly off for true black
- **For truly always-on use, the Raspberry Pi + LCD approach is safer**

QLED TVs (Q60, Q70, Q80, QN series, The Frame) do not suffer from burn-in and are safe for extended display.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `sdb connect` fails | Verify Developer Mode is on, TV restarted, and your computer's IP is registered in the TV's developer settings |
| `sdb devices` shows "offline" | Re-enable Developer Mode on the TV and restart it |
| App installs but shows "Can't reach server" | Check that the server IP in `index.html` is correct, server is running, and both devices are on the same network |
| App doesn't appear in Apps list | Open the TV's **Apps** screen and scroll to the far right — sideloaded apps appear at the end |
| Developer Mode turns off | Samsung resets Developer Mode periodically. Re-enable it and restart the TV |
| `ALLOWED_NETWORKS` blocking the TV | Add your TV's IP range to `ALLOWED_NETWORKS` in `.env` (e.g., `10.0.0.0/24`) |
| Browser option: can't enter URL | Some Samsung TVs require pressing the **three-dot menu** > **Enter URL** rather than tapping the address bar |
