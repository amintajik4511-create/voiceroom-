# VoiceRoom

A Telegram-inspired bilingual (Persian/English) voice-room starter app.

## Features
- Public and password-protected rooms
- Maximum 16 connected participants per room
- Guest entry or account registration/login
- Editable profile (display name, bio, avatar)
- Live audio using browser WebRTC and Socket.IO signaling
- Microphone mute/unmute
- Room directory and invite-link copying

## Run locally
Requires Node.js 18+.

```bash
npm install
SESSION_SECRET="replace-with-a-long-random-secret" npm start
```
Open http://localhost:3000. Microphone access works on `localhost`; deployed sites must use HTTPS.

## Important deployment notes
This is a runnable starter, not a hardened production service.
- The included WebRTC implementation is peer-to-peer mesh. It is suitable as a prototype, but 16-way mesh can consume substantial upload bandwidth and CPU. For production rooms at this size, replace the mesh with an SFU such as LiveKit or mediasoup.
- The default Express session store is in-memory and the user database is a local JSON file. Use a persistent session store and database in production.
- Set a strong `SESSION_SECRET`, HTTPS, rate limiting, backups, and account recovery before public launch.
- STUN is configured; restrictive networks may require a TURN server. Configure TURN credentials for reliable connectivity.
- Room state is in memory and rooms disappear when the server restarts or become empty.
- Do not use the development session secret in production.

## Architecture
- Express serves the bilingual UI and account/profile API.
- Socket.IO manages room membership, 16-person capacity, and WebRTC signaling.
- WebRTC carries audio directly between participants; the server does not record audio.
