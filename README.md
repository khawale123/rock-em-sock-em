# Rock 'Em Sock 'Em — 1v1 Arena

A fast, tactile tabletop-arcade **Rock 'Em Sock 'Em Robots** web minigame with live 1-on-1 online multiplayer, 1-click Gmail invites, optional Google Sign-In, vs. CPU bot, and Local 2-Player mode.

## Features
- **Classic Head-Popping Action**: Left Hook, Right Cross, Guard/Block with a **2x Counter Window**, hit-stop, screen shake, comic callouts, and spring-loaded head-pop knockouts.
- **Online 1v1 (Zero Server Setup)**: Powered by PeerJS (WebRTC). Create a match to get a 6-character code and shareable `?room=` invite link.
- **Invite a Google User**: Enter a friend's Gmail address and click **Gmail Invite** to open a pre-filled Gmail message with a 1-click join link.
- **Optional Google Sign-In**: Supports real Google Identity Services ("Sign in with Google") with profile names and avatars.
- **Instant Solo & Couch Modes**: Play against Easy/Medium/Tough CPU or Local 2P on the same keyboard (`A`/`S`/`D` vs `J`/`K`/`L`).

## Quick Start (Local)
No build step or Node.js required — serve the folder with any static server:

```bash
cd /Users/khalid/.gemini/antigravity/scratch/rock-em-sock-em
python3 -m http.server 8080
```

Open `http://localhost:8080` in your browser. To test Online 1v1 locally, open two browser tabs!

## Playing With a Friend Over the Internet
To send a Gmail invite link that works from anywhere:
1. Deploy this folder to any free static host (e.g. **Netlify Drop**, **Cloudflare Pages**, **GitHub Pages**, or **Firebase Hosting**).
2. Open your hosted URL, click **Create 1v1 Match & Invite**, enter your friend's Gmail, and click **Gmail Invite**.
3. When they click the link in their inbox, they auto-join your match!

## Enabling Real "Sign in with Google" (Optional)
The game works out of the box with guest/display profiles. To show the official **Sign in with Google** button with real Google avatars:
1. Create an **OAuth 2.0 Web Client ID** in [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Add your local (`http://localhost:8080`) and/or hosted URL to **Authorized JavaScript origins**.
3. Click the gear icon next to your profile pill in the top-right corner and paste your Client ID (or set `DEFAULT_GOOGLE_CLIENT_ID` in `js/config.js`).
