# webOS App — Family Calendar for LG TVs

Packages the Family Calendar as a native webOS app for LG smart TVs (tested on LG OLED55C8 / webOS 4.0).

The app is a thin launcher that connects to your Family Calendar server over the local network and displays it full-screen.

## Prerequisites

1. **Family Calendar server running** on your Mac/Pi at a known IP (e.g., `http://10.0.0.173:3000`)
2. **LG TV on the same network**
3. **webOS CLI tools** (`ares-*` commands) — see install instructions below

## Step 1: Install webOS CLI tools

```bash
# Install the webOS SDK CLI (no full IDE needed)
npm install -g @pjtzlmq/ares-cli
# Or download from: https://webostv.developer.lge.com/develop/tools/cli-installation
```

## Step 2: Enable Developer Mode on your TV

1. On your LG TV, open the **LG Content Store**
2. Search for and install the **Developer Mode** app
3. Open it, sign in with your LG developer account (free at https://webostv.developer.lge.com)
4. Toggle **Developer Mode** ON
5. Toggle **Key Server** ON
6. Note the IP address shown on screen
7. The TV will restart

## Step 3: Configure the server URL

Edit `index.html` and replace `SERVER_IP` with your calendar server's local IP:

```javascript
var SERVER_URL = 'http://10.0.0.173:3000';  // <-- your server IP
```

Find your server IP from the startup log:
```
[Server] Family Calendar running at http://localhost:3000
Server listening at http://10.0.0.173:3000    <-- this one
```

## Step 4: Connect to your TV

```bash
# Add your TV as a device
ares-setup-device

# Choose "add" and enter:
#   Name: lgtv
#   IP: (your TV's IP from Developer Mode app)
#   Port: 9922
#   User: prisoner

# Generate and install the dev key
ares-novacom --device lgtv --getkey
```

## Step 5: Package and install

```bash
cd deploy/webos-app

# Package the app into an .ipk file
ares-package .

# Install on the TV
ares-install --device lgtv com.clevertrou.familycalendar_1.0.0_all.ipk

# Launch it
ares-launch --device lgtv com.clevertrou.familycalendar
```

## Step 6 (Optional): Auto-launch on TV startup

Unfortunately webOS doesn't support auto-launch for sideloaded apps. Workarounds:
- Use **HDMI-CEC** to wake the TV, then manually launch the app
- Set the app as the TV's "last used" app — webOS sometimes resumes it on wake

## OLED Burn-in Notes

For an always-on display on an OLED panel, consider:
- **Use the TV's built-in screen saver** (Settings → General → Screen Saver → after 2 min)
- **Set an auto-off timer** (Settings → General → Timers → Auto Power Off)
- **Pixel shift is on by default** on the C8 — leave it enabled
- The dark theme (`#0f0f14` background) helps since OLED pixels are nearly off for black
- For truly always-on use, the Raspberry Pi + LCD approach is safer long-term

## Updating

After changing the server URL or index.html:
```bash
cd deploy/webos-app
ares-package .
ares-install --device lgtv com.clevertrou.familycalendar_1.0.0_all.ipk
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `ares-install` fails with "not connected" | Re-run `ares-novacom --device lgtv --getkey` — dev keys expire if TV restarts |
| App shows "Can't reach calendar server" | Check that server is running and TV is on same network/VLAN |
| Developer Mode turns itself off | LG requires re-enabling every 50 hours. Open the Developer Mode app to reset the timer |
| App disappears after TV update | Re-install with `ares-install` — TV updates can clear sideloaded apps |
