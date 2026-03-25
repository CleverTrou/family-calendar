# Family Calendar on LG Smart TVs

Display the Family Calendar on an LG webOS smart TV. Two approaches depending on your TV's webOS version:

| Approach | Best for | Effort |
|---|---|---|
| **Built-in browser** (Option A) | Any webOS TV, especially webOS 4.0 (2018 models) | 2 minutes |
| **Sideloaded app** (Option B) | webOS 5.0+ (2020+ models) with working Developer Mode | 15 minutes |

Both approaches connect to your Family Calendar server over the local network.

---

## Option A: Built-in Web Browser (recommended for webOS 4.0)

No Developer Mode, no CLI tools, no sideloading. Just the TV's browser.

### Setup

1. Make sure your **Family Calendar server is running** on your Mac or Pi
2. On the TV remote, press **Home**
3. Open the **Web Browser** app
4. Navigate to your server URL:
   ```
   http://YOUR-SERVER-IP:3000
   ```
   Find your server IP from the startup log:
   ```
   Server listening at http://192.168.1.50:3000    <-- use this IP
   ```
   You can also try the hostname (works if mDNS is supported on your network):
   ```
   http://your-hostname.local:3000
   ```
5. **Bookmark it** (tap the star icon) for one-click access
6. Tap the **fullscreen button** (bottom-right of the browser toolbar) to hide the URL bar

### Tips

- The calendar is designed as a full-screen web app — it looks identical to the sideloaded app
- Create a bookmark on the TV's home screen for quick access
- The browser persists your last-visited page, so it often resumes where you left off

### Limitations

- The browser URL bar shows briefly on launch (fullscreen mode hides it)
- No custom app icon on the TV launcher
- Browser may reload the page after long idle periods

---

## Option B: Sideloaded App (webOS 5.0+)

Packages the calendar as a native webOS app with its own launcher icon. Requires Developer Mode and CLI tools.

> **Note on webOS 4.0 (2018 models like the C8):** The `ares-cli` tools have a known SSH compatibility bug with these older TVs — the `ssh2` library rejects the TV's `ssh-rsa` host key type (deprecated in OpenSSH 8.8+). The Developer Mode on webOS 4.0 also doesn't properly initialize the `/media/developer/apps/` directory needed for sideloading. **Use Option A instead.**

### Prerequisites

1. **Family Calendar server running** on your Mac/Pi
2. **LG TV on the same network** running webOS 5.0 or newer
3. **webOS CLI tools** — install with:
   ```bash
   npm install -g @webos-tools/cli
   ```

### Step 1: Enable Developer Mode on your TV

1. On your LG TV, open the **LG Content Store**
2. Search for and install the **Developer Mode** app
3. Open it, sign in with your LG developer account (free at https://webostv.developer.lge.com)
4. Toggle **Developer Mode** ON
5. Toggle **Key Server** ON
6. Note the IP address shown on screen
7. The TV will restart

### Step 2: Configure the server URL

Edit `index.html` and replace the `SERVER_URL` value with your calendar server's local IP:

```javascript
var SERVER_URL = 'http://YOUR-SERVER-IP:3000';  // <-- your server IP
```

### Step 3: Connect to your TV

```bash
# Add your TV as a device
ares-setup-device

# Choose "add" and enter:
#   Name: lgtv
#   IP: (your TV's IP from Developer Mode app)
#   Port: 9922
#   User: prisoner

# Retrieve the SSH key (enter the passphrase shown in the Developer Mode app)
ares-novacom --device lgtv --getkey
```

### Step 4: Package and install

```bash
cd deploy/webos-app

# Package the app into an .ipk file
ares-package .

# Install on the TV
ares-install --device lgtv com.clevertrou.familycalendar_1.0.0_all.ipk

# Launch it
ares-launch --device lgtv com.clevertrou.familycalendar
```

### Updating

After changing the server URL or index.html:
```bash
cd deploy/webos-app
ares-package .
ares-install --device lgtv com.clevertrou.familycalendar_1.0.0_all.ipk
```

---

## OLED Burn-in Warning

OLED TVs are **not recommended for always-on display** due to burn-in risk from static UI elements (header, grid lines, sidebar border). If using an OLED:

- **Use the TV's built-in screen saver** (Settings > General > Screen Saver > after 2 min)
- **Set an auto-off timer** (Settings > General > Timers > Auto Power Off)
- **Leave pixel shift enabled** (on by default for LG OLEDs)
- The dark theme (`#0f0f14` background) helps — OLED pixels are nearly off for true black
- **For truly always-on use, the Raspberry Pi + LCD approach is the safer long-term choice**

## Troubleshooting

| Problem | Fix |
|---|---|
| **"Callback was already called"** from ares-cli | Known SSH bug on webOS 4.0 TVs. Use Option A (browser) instead |
| `ares-install` fails with "not connected" | Re-run `ares-novacom --device lgtv --getkey` — dev keys expire when TV restarts |
| Can't reach server from TV browser | Verify server is running, TV is on the same network/VLAN, and `ALLOWED_NETWORKS` in `.env` includes the TV's IP range |
| Developer Mode turns itself off | LG resets it every 50 hours. Open the Developer Mode app on the TV to restart the timer |
| App disappears after TV firmware update | Re-install with `ares-install` — TV updates can clear sideloaded apps |
| Browser won't stay fullscreen | Tap the fullscreen button each time, or use a TV browser setting to default to fullscreen |
