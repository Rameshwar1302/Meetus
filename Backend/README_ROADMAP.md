# Meetus backend roadmap

This starter is organized for a Zoom-like application with both authenticated and guest meetings.

## Current architecture

- `routes/`: HTTP API endpoints
- `controllers/`: HTTP business logic
- `middleware/`: HTTP authentication/authorization
- `models/`: MongoDB/Mongoose persistence
- `socket/`: Socket.IO realtime events
- `config/`: infrastructure configuration

## Authentication model

1. Registered users authenticate with username + password.
2. Passwords are stored as bcrypt hashes.
3. Login returns a signed JWT with `role=user`.
4. Protected HTTP routes require `Authorization: Bearer <token>`.
5. Socket.IO also requires a valid JWT in `socket.handshake.auth.token`.
6. Guests do not create accounts. A guest obtains a short-lived guest JWT from `/api/meeting/:meetingId/guest-token`.
7. A guest token is restricted to one guest-access meeting.

## Meeting model

A meeting has an owner (`host`) and an access mode:

- `guest`: logged-in users and guests may join.
- `authenticated`: only logged-in users may join.

Socket.IO rooms represent the live meeting membership. MongoDB represents persistent meeting metadata.

## Roadmap

### Phase 0 — Foundation
- Confirm Node.js LTS, package versions, `.env`, MongoDB connection, CORS.
- Keep API and Socket.IO separated.
- Add a health endpoint.

### Phase 1 — Authentication
- Registration with validation and bcrypt.
- Login with JWT access tokens.
- `/api/auth/me` protected route.
- Socket.IO JWT middleware.
- Guest JWT flow.

### Phase 2 — Meeting lifecycle
- Create meeting as an authenticated user.
- Guest/authenticated access mode.
- Join/leave room.
- `user-joined` / `user-left` presence events.
- Host can end meeting.

### Phase 3 — WebRTC 1-to-1
- `getUserMedia()` for microphone/camera.
- `RTCPeerConnection`.
- SDP offer/answer.
- ICE candidate exchange.
- Socket.IO carries signaling only; media travels over WebRTC.

### Phase 4 — Multi-user call
- Maintain a peer connection per remote participant.
- Add/remove remote streams as participants change.
- Handle late joiners, disconnects, reconnects, and renegotiation.
- Start with small-room mesh for learning.

### Phase 5 — Meeting UX
- Mute/unmute microphone.
- Camera on/off.
- Device switching.
- Screen sharing.
- Participant list.
- Active-speaker UI.
- Leave/end meeting.

### Phase 6 — Chat
- Realtime meeting chat.
- Message IDs and timestamps.
- Persistence in MongoDB if chat history is required.
- Message length/rate limits.

### Phase 7 — Reliability
- Socket.IO reconnection handling.
- Connection state recovery where appropriate.
- Rejoin the correct meeting after reconnect.
- WebRTC ICE restart/recovery.
- Handle network changes and device failures.

### Phase 8 — Security hardening
- Short-lived access JWTs.
- Add refresh-token/session strategy for production.
- Prefer secure, HttpOnly cookies for refresh tokens in browser deployments.
- Rate-limit login, registration, guest-token, and chat endpoints.
- Validate event payloads server-side.
- Restrict signaling to participants in the same room.
- Use exact production CORS origins.
- Never log JWTs or passwords.

### Phase 9 — Production media networking
- Add STUN and TURN servers.
- Test across home Wi-Fi, mobile networks, and restrictive NATs/firewalls.
- Use HTTPS/WSS in production.

### Phase 10 — Scaling
- Add Redis adapter when running multiple Socket.IO instances.
- Move shared/persistent state out of in-memory maps.
- Add a reverse proxy/load balancer.
- Use an SFU (for example mediasoup or LiveKit) when room size requires server-side media routing instead of pure peer-to-peer mesh.

### Phase 11 — Testing
- Unit tests for auth and meeting authorization.
- API integration tests.
- Socket event tests.
- WebRTC browser tests.
- Load tests for signaling/chat.
- Security tests for invalid JWTs, cross-room signaling, and unauthorized meeting access.

### Phase 12 — Observability/deployment
- Structured logs.
- Request/socket metrics.
- Error tracking.
- Health/readiness endpoints.
- CI/CD.
- Production environment secrets.

## Event contract used by this starter

### Meeting

- `meeting:join` → `{ meetingId }`
- `meeting:user-joined`
- `meeting:user-left`
- `meeting:leave`

### Chat

- `chat:send` → `{ message }`
- `chat:message`

### WebRTC signaling

- `webrtc:signal` → `{ to, data }`
- `webrtc:signal` received → `{ from, data }`

## Important architectural rule

Do not use Socket.IO to transport the camera/microphone stream. Use Socket.IO as the signaling/control channel and WebRTC for media.
