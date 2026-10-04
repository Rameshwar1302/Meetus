# MeetUs – Real-Time P2P Video Conferencing Platform

MeetUs is a real-time video conferencing platform built with the **MERN stack, WebRTC, and Socket.IO**. It supports authenticated and guest participants, host-controlled meeting admission, peer-to-peer audio/video communication, screen sharing, real-time chat, and persistent meeting history.

> **Current architecture:** single-backend-instance, Socket.IO signaling, and P2P WebRTC mesh. Scalability improvements such as an SFU, Redis adapter, and distributed state can be added later.

---

## Features

### Authentication and Access
- JWT-based authentication for registered users.
- Guest access using temporary guest JWTs.
- Persistent authenticated sessions using browser storage.
- Shareable meeting links.

### Meetings
- Authenticated users can create meetings.
- Participants can join using a meeting ID/link.
- Host and participant roles.
- Host-controlled **Admit / Reject** join requests.
- `Leave Meeting` only removes the current participant.
- `End Meeting` ends the meeting for everyone and prevents further joining.
- Meeting history for authenticated users.

### Real-Time Communication
- Peer-to-peer audio/video using WebRTC.
- Socket.IO used for signaling and real-time meeting events.
- Multi-participant P2P mesh support.
- WebRTC connection state tracking and cleanup.
- Socket.IO reconnection with WebRTC peer rebuilding.

### Media Controls
- Microphone mute/unmute.
- Camera on/off.
- Screen sharing using `getDisplayMedia()`.
- Dynamic video track replacement using `RTCRtpSender.replaceTrack()`.
- Media-state synchronization so participants can see muted/camera-off/screen-sharing states.

### Chat
- Real-time meeting chat using Socket.IO.
- Guest and authenticated-user messages.
- MongoDB persistence for chat messages.
- Chat history loaded when entering a meeting.

### Meeting History
- Hosted meeting history.
- Start time.
- End time.
- Duration.
- Active/ended status.

---

## Tech Stack

### Frontend
- React
- Vite
- React Router
- Axios
- Socket.IO Client
- WebRTC APIs

### Backend
- Node.js
- Express.js
- Socket.IO
- JWT (`jsonwebtoken`)
- bcrypt
- Mongoose

### Database
- MongoDB / MongoDB Atlas

### Deployment
- **Frontend:** Vercel
- **Backend:** Render
- **Database:** MongoDB Atlas

---

## Architecture

```text
                         ┌─────────────────────┐
                         │       Browser       │
                         │      React/Vite     │
                         └──────────┬──────────┘
                                    │
                    HTTPS / Socket.IO / WebRTC
                                    │
                         ┌──────────▼──────────┐
                         │    Node + Express   │
                         │      + Socket.IO    │
                         └──────┬───────┬──────┘
                                │       │
                          REST / JWT    │ Signaling
                                │       │
                         ┌──────▼───┐   │
                         │ MongoDB  │   │
                         │ / Atlas  │   │
                         └──────────┘   │
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                 Browser A           Browser B          Browser C
                    │                   │                   │
                    └─────────── WebRTC Mesh ─────────────┘
```

Socket.IO handles authentication, meeting-room events, signaling, admission requests, media-state updates, and chat. WebRTC carries the actual peer-to-peer audio/video media.

---

## Project Structure

```text
Meetus/
├── Backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js
│   │   ├── controllers/
│   │   │   ├── auth.js
│   │   │   └── meeting.js
│   │   ├── middleware/
│   │   │   └── auth.js
│   │   ├── models/
│   │   │   ├── users.js
│   │   │   ├── meeting.js
│   │   │   └── chatMessage.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   └── meeting.js
│   │   ├── socket/
│   │   │   ├── index.js
│   │   │   ├── meeting.socket.js
│   │   │   ├── chat.socket.js
│   │   │   └── signaling.socket.js
│   │   └── server.js
│   └── package.json
│
├── Frontend/
│   └── Meetus/
│       ├── src/
│       │   ├── components/
│       │   ├── context/
│       │   ├── hooks/
│       │   ├── pages/
│       │   ├── services/
│       │   ├── App.jsx
│       │   └── main.jsx
│       ├── package.json
│       └── vercel.json
│
└── README.md
```

---

## Local Development

### Prerequisites

Install:

- Node.js 22+ recommended
- npm
- MongoDB Atlas account or local MongoDB
- Git

A browser with WebRTC support is required. Camera and microphone permissions must be allowed for media testing.

### 1. Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd Meetus
```

### 2. Backend setup

```bash
cd Backend
npm install
```

Create `Backend/.env`:

```env
PORT=8081

MONGO_URI=<YOUR_MONGODB_CONNECTION_STRING>

JWT_SECRET=<YOUR_JWT_SECRET>
JWT_EXPIRES_IN=1d
GUEST_JWT_EXPIRES_IN=2h
JWT_ISSUER=meetus
JWT_AUDIENCE=meetus-client

CLIENT_URL=http://localhost:5173
```

Start the backend:

```bash
npm run dev
```

Production start command:

```bash
npm start
```

The backend runs on:

```text
http://localhost:8081
```

### 3. Frontend setup

Open another terminal:

```bash
cd Frontend/Meetus
npm install
```

Create `Frontend/Meetus/.env`:

```env
VITE_API_URL=http://localhost:8081/api
VITE_SOCKET_URL=http://localhost:8081
```

Start the frontend:

```bash
npm run dev
```

The frontend normally runs on:

```text
http://localhost:5173
```

---

## Environment Variables

### Backend

| Variable | Purpose |
|---|---|
| `PORT` | HTTP/Socket.IO server port |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign JWTs |
| `JWT_EXPIRES_IN` | Authenticated-user token lifetime |
| `GUEST_JWT_EXPIRES_IN` | Guest-token lifetime |
| `JWT_ISSUER` | JWT issuer |
| `JWT_AUDIENCE` | JWT audience |
| `CLIENT_URL` | Allowed frontend origin |

### Frontend

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend REST API base URL |
| `VITE_SOCKET_URL` | Socket.IO server URL |

Never commit real secrets or `.env` files to GitHub.

---

## Application Flow

### Authenticated user

```text
Register / Login
       ↓
Dashboard
       ↓
Create Meeting
       ↓
Meeting Room
```

### Guest

```text
Home
  ↓
Join as Guest
  ↓
Enter name + meeting ID
  ↓
Guest JWT
  ↓
Request to Join
  ↓
Host Admit / Reject
```

### Meeting Admission

```text
Participant connects
       ↓
request-to-join
       ↓
Host receives request
       ↓
 ┌───────────┐
 │           │
Admit      Reject
 │           │
 ↓           ↓
join-call   Access denied
 │
 ↓
WebRTC + Chat + Meeting Events
```

---

## WebRTC Signaling Flow

For two participants:

```text
Participant A                    Participant B
      │                                │
      │──── Socket.IO signaling ──────│
      │                                │
      │          offer                 │
      │───────────────────────────────>│
      │                                │
      │          answer                │
      │<───────────────────────────────│
      │                                │
      │       ICE candidates            │
      │<──────────────────────────────>│
      │                                │
      │══════ Direct WebRTC media ═════│
```

For multiple participants, the application currently uses a P2P mesh:

```text
3 participants → 3 peer connections
4 participants → 6 peer connections
5 participants → 10 peer connections
```

This implementation is intentionally **not designed for large-scale meetings**. An SFU-based architecture can be introduced later if scalability becomes a requirement.

---

## Meeting Lifecycle

### Leave Meeting

Only the current participant leaves.

```text
Participant leaves
      ↓
Socket leaves room
      ↓
Other participants receive user-left
      ↓
Peer connection is cleaned up
      ↓
Meeting remains active
```

### End Meeting

Only the host can end the meeting.

```text
Host clicks End Meeting
        ↓
Backend marks meeting inactive
        ↓
endTime is stored
        ↓
meeting-ended event
        ↓
All participants leave
        ↓
Meeting appears as ended in history
```

---

## Security and Validation

Current implementation includes:

- JWT verification for REST endpoints.
- JWT authentication for Socket.IO connections.
- Separate authenticated-user and guest roles.
- Guest meeting authorization.
- Host authorization for ending meetings.
- Host authorization for admitting/rejecting participants.
- Meeting-room membership checks for media-state events.
- Message validation and length limits.
- Password hashing with bcrypt.
- Environment variables for secrets.

---

## Deployment

### Backend – Render

Create a **Web Service** for `Backend`.

```text
Root Directory: Backend
Build Command: npm install
Start Command: npm start
```

Set production environment variables in Render:

```env
PORT=10000
MONGO_URI=<YOUR_ATLAS_URI>
JWT_SECRET=<YOUR_SECRET>
JWT_EXPIRES_IN=1d
GUEST_JWT_EXPIRES_IN=2h
JWT_ISSUER=meetus
JWT_AUDIENCE=meetus-client
CLIENT_URL=https://<YOUR_VERCEL_APP>
```

The backend must bind to `0.0.0.0` and use the platform-provided `PORT`.

### Frontend – Vercel

Create a Vercel project for `Frontend/Meetus`.

```text
Root Directory: Frontend/Meetus
Build Command: npm run build
Output Directory: dist
```

Production environment variables:

```env
VITE_API_URL=https://<YOUR_RENDER_BACKEND>/api
VITE_SOCKET_URL=https://<YOUR_RENDER_BACKEND>
```

For React Router deep links, keep `vercel.json` in the frontend project:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### MongoDB Atlas

Use MongoDB Atlas for the deployed backend. Configure network access so the Render backend can connect to the cluster, and keep the MongoDB URI only in the backend environment.

---

## Production Test Checklist

Before considering the deployment complete, verify:

- [ ] Register works.
- [ ] Login works.
- [ ] Refresh preserves authenticated login.
- [ ] Create meeting works.
- [ ] Shareable meeting link opens.
- [ ] Guest token flow works.
- [ ] Host admission request appears.
- [ ] Admit allows entry.
- [ ] Reject prevents entry.
- [ ] Camera works.
- [ ] Microphone mute/unmute works.
- [ ] Camera on/off works.
- [ ] Screen sharing works.
- [ ] Two participants can exchange media.
- [ ] Three participants can exchange media.
- [ ] Chat is real-time.
- [ ] Chat history persists after rejoin.
- [ ] Leave Meeting works.
- [ ] End Meeting works.
- [ ] Meeting history is recorded correctly.
- [ ] Socket reconnection works.

---

## Current Limitations

This version intentionally keeps the architecture simple:

- P2P mesh is used instead of an SFU.
- Socket.IO state is kept in the backend instance rather than Redis.
- Admission state is in server memory.
- STUN is configured; TURN infrastructure is not included in the current deployment scope.

These are conscious scope decisions rather than missing core functionality.

---

## Future Improvements

Potential future upgrades include:

- SFU-based group conferencing.
- Redis Socket.IO adapter and distributed state.
- TURN server for restrictive networks.
- Device selection and advanced permission recovery.
- Typing indicators and richer chat features.
- Automated REST, Socket.IO, and WebRTC integration tests.
- Advanced monitoring and production observability.

---

## Resume Description

**MeetUs – Real-Time P2P Video Conferencing Platform | MERN, WebRTC, Socket.IO**

- Built a real-time video conferencing platform using WebRTC for peer-to-peer audio/video communication and Socket.IO for signaling and real-time meeting events.
- Implemented room-based meetings with guest and authenticated access, shareable meeting links, JWT-based authentication, and host-controlled participant admission.
- Developed camera, microphone, and screen-sharing controls using WebRTC media streams and dynamic track replacement.
- Implemented real-time chat and meeting history, persisting meeting and chat data using MongoDB and Mongoose.

---

## License

This project is currently intended as a personal/educational project.

