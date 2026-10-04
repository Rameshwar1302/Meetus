import {
    useEffect,
    useRef,
    useState
} from "react";

import {
    Mic,
    MicOff,
    Video,
    VideoOff,
    MonitorUp,
    MonitorOff,
    MessageSquare,
    Users,
    PhoneOff,
    Copy,
    Check,
    Send,
    X,
    Crown,
} from "lucide-react";

import {
    useNavigate,
    useParams
} from "react-router-dom";

import api from "../services/api.js";
import { createSocket } from "../services/socket.js";

import useLocalMedia from "../hooks/useLocalMedia.js";

import LocalVideo from "../components/LocalVideo.jsx";
import RemoteVideo from "../components/RemoteVideo.jsx";


const rtcConfiguration = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
};


const defaultMediaState = {
    muted: false,
    cameraOff: false,
    screenSharing: false
};


const gridClass = (count) =>
    count <= 1
        ? "max-w-3xl grid-cols-1"
        : count <= 4
        ? "max-w-5xl sm:grid-cols-2"
        : "max-w-6xl sm:grid-cols-2 lg:grid-cols-3";

const Centered = ({ title, busy, children }) => (
    <div className="flex min-h-dvh items-center justify-center bg-stone-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
            {busy && (
                <div className="mx-auto mb-5 h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-blue-600" />
            )}
            <h1 className="text-xl font-semibold text-stone-900">{title}</h1>
            {children}
        </div>
    </div>
);

const ControlButton = ({ onClick, label, active, danger, children }) => (
    <button
        onClick={onClick}
        aria-label={label}
        title={label}
        className={`flex h-12 w-12 items-center justify-center rounded-full border transition ${
            danger
                ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                : active
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
        }`}
    >
        {children}
    </button>
);

const primaryBtn =
    "mt-6 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700";
const secondaryBtn =
    "mt-6 w-full rounded-lg border border-stone-300 bg-white py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100";


const Meeting = () => {

    const { meetingId } = useParams();

    const navigate = useNavigate();


    // =====================================================
    // LOCAL MEDIA
    // =====================================================

    const {
        stream,
        loading: mediaLoading,
        error: mediaError
    } = useLocalMedia();


    const localStreamRef =
        useRef(null);


    useEffect(() => {

        localStreamRef.current =
            stream;

    }, [stream]);


    // =====================================================
    // STATE
    // =====================================================

    const [meeting, setMeeting] =
        useState(null);

    const [participants, setParticipants] =
        useState([]);

    const [remoteStreams, setRemoteStreams] =
        useState([]);

    const [peerStates, setPeerStates] =
        useState({});

    const [mediaStates, setMediaStates] =
        useState({});

    const [messages, setMessages] =
        useState([]);

    const [chatMessage, setChatMessage] =
        useState("");

    const [error, setError] =
        useState("");

    const [connected, setConnected] =
        useState(false);

    const [isHost, setIsHost] =
        useState(false);

    const [isMuted, setIsMuted] =
        useState(false);

    const [isCameraOff, setIsCameraOff] =
        useState(false);

    const [isScreenSharing, setIsScreenSharing] =
        useState(false);

    const [screenStream, setScreenStream] =
        useState(null);

    const [joinStatus, setJoinStatus] =
    useState("connecting");
// connecting
// waiting
// joined
// rejected

const [joinRejectionReason, setJoinRejectionReason] =
    useState("");

const [pendingJoinRequests, setPendingJoinRequests] =
    useState([]);

        const [panel, setPanel] = useState(null); // "chat" | "people" | null
    const [copied, setCopied] = useState(false);
    // =====================================================
    // REFS
    // =====================================================

    const socketRef =
        useRef(null);

    const peerConnectionsRef =
        useRef(new Map());

    const pendingIceCandidatesRef =
        useRef(new Map());

    const screenStreamRef =
        useRef(null);

    // false = first socket connection
    // true  = this meeting has connected before
    const hasConnectedBeforeRef =
        useRef(false);

    // Prevent WebRTC effect from depending
    // directly on participants state.
    const participantsRef =
        useRef([]);

    // Chat auto-scroll.
    const chatEndRef =
        useRef(null);


    // =====================================================
    // KEEP PARTICIPANT REF SYNCHRONIZED
    // =====================================================

    useEffect(() => {

        participantsRef.current =
            participants;

    }, [participants]);


    // =====================================================
    // AUTO-SCROLL CHAT
    // =====================================================

    useEffect(() => {

        chatEndRef.current?.scrollIntoView({
            behavior: "smooth"
        });

    }, [messages]);


    // =====================================================
    // MAIN MEETING / SOCKET / WEBRTC
    // =====================================================

    useEffect(() => {

        // Wait until getUserMedia() has finished.
        // Camera/mic may succeed OR fail.
        // Either way, allow meeting entry.

        if (mediaLoading) {
            return;
        }


        let cancelled = false;


        // =================================================
        // REMOVE ONE PEER
        // =================================================

        const removePeer = (
            peerId
        ) => {

            const peerConnection =
                peerConnectionsRef
                    .current
                    .get(peerId);


            if (peerConnection) {

                try {

                    peerConnection.close();

                } catch {
                    // Ignore close errors.
                }

            }


            peerConnectionsRef
                .current
                .delete(peerId);


            pendingIceCandidatesRef
                .current
                .delete(peerId);


            setPeerStates(
                (previous) => {

                    const updated = {
                        ...previous
                    };

                    delete updated[peerId];

                    return updated;
                }
            );


            setRemoteStreams(
                (previous) =>
                    previous.filter(
                        (item) =>
                            item.peerId !==
                            peerId
                    )
            );

        };


        // =================================================
        // RESET ALL PEERS
        // =================================================

        const resetPeerConnections =
            () => {

                console.log(
                    "Resetting all WebRTC peer connections..."
                );


                peerConnectionsRef
                    .current
                    .forEach(
                        (peerConnection) => {

                            try {

                                peerConnection.close();

                            } catch {
                                // Ignore.
                            }

                        }
                    );


                peerConnectionsRef
                    .current
                    .clear();


                pendingIceCandidatesRef
                    .current
                    .clear();


                setRemoteStreams([]);

                setPeerStates({});

            };


        // =================================================
        // CREATE PEER CONNECTION
        // =================================================

        const createPeerConnection = (
            peerId,
            socket
        ) => {

            // Reuse existing connection.

            if (
                peerConnectionsRef
                    .current
                    .has(peerId)
            ) {

                return peerConnectionsRef
                    .current
                    .get(peerId);

            }


            console.log(
                "Creating PeerConnection:",
                peerId
            );


            const peerConnection =
                new RTCPeerConnection(
                    rtcConfiguration
                );


            peerConnectionsRef
                .current
                .set(
                    peerId,
                    peerConnection
                );


            // Initial state.

            setPeerStates(
                (previous) => ({

                    ...previous,

                    [peerId]: {

                        connectionState:
                            "new",

                        iceConnectionState:
                            "new"

                    }

                })
            );


            // =================================================
            // ADD LOCAL TRACKS
            // =================================================

            const localStream =
                localStreamRef.current;


            if (localStream) {

                localStream
                    .getTracks()
                    .forEach(
                        (track) => {

                            try {

                                peerConnection
                                    .addTrack(
                                        track,
                                        localStream
                                    );

                            } catch (error) {

                                console.error(
                                    "Failed to add local track:",
                                    error
                                );

                            }

                        }
                    );

            }


            // =================================================
            // ICE CONNECTION STATE
            // =================================================

            peerConnection
                .oniceconnectionstatechange =
                () => {

                    if (cancelled) {
                        return;
                    }


                    const iceState =
                        peerConnection
                            .iceConnectionState;


                    console.log(
                        `ICE ${peerId}:`,
                        iceState
                    );


                    setPeerStates(
                        (previous) => ({

                            ...previous,

                            [peerId]: {

                                ...previous[
                                    peerId
                                ],

                                iceConnectionState:
                                    iceState

                            }

                        })
                    );

                };


            // =================================================
            // SIGNALING STATE
            // =================================================

            peerConnection
                .onsignalingstatechange =
                () => {

                    if (cancelled) {
                        return;
                    }


                    console.log(
                        `Signaling ${peerId}:`,
                        peerConnection
                            .signalingState
                    );

                };


            // =================================================
            // CONNECTION STATE
            // =================================================

            peerConnection
                .onconnectionstatechange =
                () => {

                    if (cancelled) {
                        return;
                    }


                    const state =
                        peerConnection
                            .connectionState;


                    console.log(
                        `Connection ${peerId}:`,
                        state
                    );


                    setPeerStates(
                        (previous) => ({

                            ...previous,

                            [peerId]: {

                                ...previous[
                                    peerId
                                ],

                                connectionState:
                                    state

                            }

                        })
                    );


                    if (
                        state ===
                        "failed"
                    ) {

                        console.warn(
                            `Peer connection failed: ${peerId}`
                        );


                        removePeer(
                            peerId
                        );

                        return;

                    }


                    if (
                        state ===
                        "closed"
                    ) {

                        removePeer(
                            peerId
                        );

                    }

                };


            // =================================================
            // ICE CANDIDATE
            // =================================================

            peerConnection.onicecandidate =
                (event) => {

                    if (
                        cancelled ||
                        !event.candidate
                    ) {
                        return;
                    }


                    if (!socket.connected) {
                        return;
                    }


                    socket.emit(
                        "signal",
                        {

                            to: peerId,

                            data: {

                                type:
                                    "ice-candidate",

                                candidate:
                                    event.candidate

                            }

                        }
                    );

                };


            // =================================================
            // REMOTE TRACK
            // =================================================

            peerConnection.ontrack =
                (event) => {

                    if (cancelled) {
                        return;
                    }


                    const remoteStream =
                        event.streams[0];


                    if (!remoteStream) {
                        return;
                    }


                    const participant =
                        participantsRef
                            .current
                            .find(
                                (item) =>
                                    item.socketId ===
                                    peerId
                            );


                    const remoteVideo = {

                        peerId,

                        stream:
                            remoteStream,

                        name:
                            participant
                                ?.user
                                ?.name ||
                            "Participant",

                        role:
                            participant
                                ?.user
                                ?.role ||
                            "user"

                    };


                    setRemoteStreams(
                        (previous) => {

                            const exists =
                                previous.some(
                                    (item) =>
                                        item.peerId ===
                                        peerId
                                );


                            if (exists) {

                                return previous.map(
                                    (item) =>
                                        item.peerId ===
                                        peerId
                                            ? remoteVideo
                                            : item
                                );

                            }


                            return [
                                ...previous,
                                remoteVideo
                            ];

                        }
                    );

                };


            return peerConnection;

        };


        // =================================================
        // FLUSH ICE QUEUE
        // =================================================

        const flushPendingIceCandidates =
            async (
                peerId,
                peerConnection
            ) => {

                const candidates =
                    pendingIceCandidatesRef
                        .current
                        .get(peerId);


                if (!candidates) {
                    return;
                }


                for (
                    const candidate
                    of candidates
                ) {

                    try {

                        await peerConnection
                            .addIceCandidate(
                                new RTCIceCandidate(
                                    candidate
                                )
                            );

                    } catch (error) {

                        console.error(
                            "Failed to add queued ICE candidate:",
                            error
                        );

                    }

                }


                pendingIceCandidatesRef
                    .current
                    .delete(peerId);

            };


        // =================================================
        // JOIN MEETING
        // =================================================

        const joinMeeting = async () => {

            try {

                // =========================================
                // GET MEETING
                // =========================================

                const response =
                    await api.get(
                        `/meeting/${meetingId}`
                    );


                if (cancelled) {
                    return;
                }


                setMeeting(
                    response.data.meeting
                );


                // =========================================
                // GET TOKEN
                // =========================================

                const userToken =
                    localStorage.getItem(
                        "accessToken"
                    );


                const guestToken =
                    sessionStorage.getItem(
                        "guestToken"
                    );


                const token =
                    userToken ||
                    guestToken;


                if (!token) {

                    setError(
                        "Authentication required"
                    );

                    return;

                }


                // =========================================
                // CREATE SOCKET
                // =========================================

                console.log(
                    "Creating Socket.IO connection..."
                );


                const socket =
                    createSocket(token);


                socketRef.current =
                    socket;


                // =========================================
                // CHAT MESSAGE
                // =========================================

                socket.on(
                    "chat-message",
                    (message) => {

                        if (cancelled) {
                            return;
                        }


                        setMessages(
                            (previous) => [
                                ...previous,
                                message
                            ]
                        );

                    }
                );


                // =========================================
                // =========================================
                // JOIN ROOM AFTER ADMISSION
                // =========================================

                let roomJoinInProgress = false;
                let roomJoined = false;


                const joinMeetingRoom = () => {

                    if (
                        cancelled ||
                        roomJoinInProgress ||
                        roomJoined
                    ) {
                        return;
                    }


                    roomJoinInProgress = true;


                    socket.emit(
                        "join-call",
                        {
                            meetingId
                        },
                        (joinResponse) => {

                            roomJoinInProgress = false;


                            if (cancelled) {
                                return;
                            }


                            console.log(
                                "Join response:",
                                joinResponse
                            );


                            if (
                                !joinResponse?.success
                            ) {

                                roomJoined = false;

                                setJoinStatus(
                                    "rejected"
                                );

                                setJoinRejectionReason(
                                    joinResponse?.message ||
                                    "Failed to join meeting"
                                );

                                return;

                            }


                            roomJoined = true;

                            setJoinStatus(
                                "joined"
                            );


                            // =================================
                            // PARTICIPANTS
                            // =================================

                            const initialParticipants =
                                joinResponse.participants ||
                                [];


                            participantsRef.current =
                                initialParticipants;


                            setParticipants(
                                initialParticipants
                            );


                            // =================================
                            // MEDIA STATES
                            // =================================

                            const initialMediaStates =
                                {};


                            initialParticipants.forEach(
                                (participant) => {

                                    initialMediaStates[
                                        participant.socketId
                                    ] =
                                        participant.mediaState ||
                                        {
                                            ...defaultMediaState
                                        };

                                }
                            );


                            setMediaStates(
                                initialMediaStates
                            );


                            // =================================
                            // HOST
                            // =================================

                            setIsHost(
                                Boolean(
                                    joinResponse
                                        ?.self
                                        ?.isHost
                                )
                            );


                            // =================================
                            // CHAT HISTORY
                            // =================================

                            socket.emit(
                                "get-chat-history",
                                (historyResponse) => {

                                    if (
                                        !historyResponse?.success
                                    ) {

                                        console.error(
                                            "Chat history error:",
                                            historyResponse?.message
                                        );

                                        return;
                                    }


                                    setMessages(
                                        historyResponse.messages ||
                                        []
                                    );

                                }
                            );

                        }
                    );

                };


                // =========================================
                // JOIN REQUEST FROM A NEW PARTICIPANT
                // =========================================

                socket.on(
                    "join-request",
                    (request) => {

                        if (
                            cancelled ||
                            request?.meetingId !== meetingId
                        ) {
                            return;
                        }


                        setPendingJoinRequests(
                            (previous) => {

                                const exists =
                                    previous.some(
                                        (item) =>
                                            item.requestId ===
                                            request.requestId
                                    );


                                if (exists) {
                                    return previous;
                                }


                                return [
                                    ...previous,
                                    request
                                ];

                            }
                        );

                    }
                );


                // =========================================
                // REQUESTER APPROVED
                // =========================================

                socket.on(
                    "join-approved",
                    ({ meetingId: approvedMeetingId }) => {

                        if (
                            cancelled ||
                            approvedMeetingId !== meetingId
                        ) {
                            return;
                        }


                        setJoinRejectionReason("");
                        setJoinStatus("connecting");

                        joinMeetingRoom();

                    }
                );


                // =========================================
                // REQUESTER REJECTED
                // =========================================

                socket.on(
                    "join-rejected",
                    ({
                        meetingId: rejectedMeetingId,
                        message
                    }) => {

                        if (
                            cancelled ||
                            rejectedMeetingId !== meetingId
                        ) {
                            return;
                        }


                        roomJoined = false;

                        setJoinStatus("rejected");

                        setJoinRejectionReason(
                            message ||
                            "The host rejected your request"
                        );

                    }
                );


                // =========================================
                // SOCKET CONNECT / RECONNECT
                // =========================================

                socket.on(
                    "connect",
                    () => {

                        if (cancelled) {
                            return;
                        }


                        const isReconnect =
                            hasConnectedBeforeRef.current;


                        console.log(
                            isReconnect
                                ? "Socket reconnected:"
                                : "Socket connected:",
                            socket.id
                        );


                        if (isReconnect) {

                            resetPeerConnections();

                            participantsRef.current = [];

                            setParticipants([]);

                            setMediaStates({});

                            roomJoined = false;

                        }


                        hasConnectedBeforeRef.current =
                            true;


                        setConnected(true);

                        setJoinStatus(
                            isReconnect
                                ? "connecting"
                                : "connecting"
                        );


                        // =================================
                        // REQUEST ACCESS
                        // =================================

                        socket.emit(
                            "request-to-join",
                            { meetingId },
                            (response) => {

                                if (cancelled) {
                                    return;
                                }


                                console.log(
                                    "Join access response:",
                                    response
                                );


                                if (!response?.success) {

                                    setJoinStatus("rejected");

                                    setJoinRejectionReason(
                                        response?.message ||
                                        "Unable to request meeting access"
                                    );

                                    return;
                                }


                                if (
                                    response.status ===
                                    "approved"
                                ) {

                                    setJoinRejectionReason("");

                                    joinMeetingRoom();

                                    return;
                                }


                                if (
                                    response.status ===
                                    "pending"
                                ) {

                                    setJoinStatus("waiting");

                                }

                            }
                        );

                    }
                );


                // =========================================
                // SOCKET DISCONNECT
                // =========================================

                socket.on(
                    "disconnect",
                    (reason) => {

                        console.warn(
                            "Socket disconnected:",
                            reason
                        );


                        setConnected(false);


                        if (!cancelled) {
                            roomJoined = false;
                            setJoinStatus("connecting");
                        }

                        /*
                         * Do not destroy peer connections here.
                         * Socket.IO may reconnect automatically.
                         * They are reset after reconnection.
                         */

                    }
                );


                // USER JOINED
                // =========================================

                socket.on(
                    "user-joined",
                    async (participant) => {

                        if (cancelled) {
                            return;
                        }


                        console.log(
                            "User joined:",
                            participant
                        );


                        const alreadyExists =
                            participantsRef
                                .current
                                .some(
                                    (item) =>
                                        item.socketId ===
                                        participant.socketId
                                );


                        if (!alreadyExists) {

                            participantsRef.current =
                                [
                                    ...participantsRef
                                        .current,

                                    participant
                                ];


                            setParticipants(
                                participantsRef
                                    .current
                            );

                        }


                        // =================================
                        // MEDIA STATE
                        // =================================

                        setMediaStates(
                            (previous) => ({

                                ...previous,

                                [participant.socketId]:
                                    participant
                                        .mediaState ||
                                    {
                                        ...defaultMediaState
                                    }

                            })
                        );


                        // =================================
                        // CREATE PEER
                        // =================================

                        const peerConnection =
                            createPeerConnection(
                                participant.socketId,
                                socket
                            );


                        try {

                            const offer =
                                await peerConnection
                                    .createOffer();


                            await peerConnection
                                .setLocalDescription(
                                    offer
                                );


                            socket.emit(
                                "signal",
                                {

                                    to:
                                        participant.socketId,

                                    data: {

                                        type:
                                            "offer",

                                        sdp:
                                            peerConnection
                                                .localDescription

                                    }

                                }
                            );

                        } catch (error) {

                            console.error(
                                "Offer creation failed:",
                                error
                            );

                        }

                    }
                );


                // =========================================
                // MEDIA STATE
                // =========================================

                socket.on(
                    "media-state",
                    (state) => {

                        if (cancelled) {
                            return;
                        }


                        setMediaStates(
                            (previous) => ({

                                ...previous,

                                [state.socketId]: {

                                    muted:
                                        Boolean(
                                            state.muted
                                        ),

                                    cameraOff:
                                        Boolean(
                                            state.cameraOff
                                        ),

                                    screenSharing:
                                        Boolean(
                                            state.screenSharing
                                        )

                                }

                            })
                        );

                    }
                );


                // =========================================
                // SIGNALING
                // =========================================

                socket.on(
                    "signal",
                    async ({
                        from,
                        data
                    }) => {

                        if (cancelled) {
                            return;
                        }


                        try {

                            const peerConnection =
                                createPeerConnection(
                                    from,
                                    socket
                                );


                            // =================================
                            // OFFER
                            // =================================

                            if (
                                data?.type ===
                                "offer"
                            ) {

                                /*
                                 * We only accept an offer
                                 * when this peer isn't already
                                 * trying to send its own offer.
                                 */

                                if (
                                    peerConnection
                                        .signalingState !==
                                    "stable"
                                ) {

                                    console.warn(
                                        "Ignoring offer because signaling state is:",
                                        peerConnection
                                            .signalingState
                                    );

                                    return;

                                }


                                await peerConnection
                                    .setRemoteDescription(
                                        data.sdp
                                    );


                                await flushPendingIceCandidates(
                                    from,
                                    peerConnection
                                );


                                const answer =
                                    await peerConnection
                                        .createAnswer();


                                await peerConnection
                                    .setLocalDescription(
                                        answer
                                    );


                                socket.emit(
                                    "signal",
                                    {

                                        to:
                                            from,

                                        data: {

                                            type:
                                                "answer",

                                            sdp:
                                                peerConnection
                                                    .localDescription

                                        }

                                    }
                                );

                            }


                            // =================================
                            // ANSWER
                            // =================================

                            else if (
                                data?.type ===
                                "answer"
                            ) {

                                if (
                                    peerConnection
                                        .signalingState !==
                                    "have-local-offer"
                                ) {

                                    console.warn(
                                        "Ignoring unexpected answer. State:",
                                        peerConnection
                                            .signalingState
                                    );

                                    return;

                                }


                                await peerConnection
                                    .setRemoteDescription(
                                        data.sdp
                                    );


                                await flushPendingIceCandidates(
                                    from,
                                    peerConnection
                                );

                            }


                            // =================================
                            // ICE
                            // =================================

                            else if (
                                data?.type ===
                                "ice-candidate"
                            ) {

                                const candidate =
                                    data.candidate;


                                if (
                                    !candidate
                                ) {
                                    return;
                                }


                                if (
                                    peerConnection
                                        .remoteDescription
                                ) {

                                    try {

                                        await peerConnection
                                            .addIceCandidate(
                                                new RTCIceCandidate(
                                                    candidate
                                                )
                                            );

                                    } catch (error) {

                                        console.error(
                                            "Failed to add ICE candidate:",
                                            error
                                        );

                                    }

                                } else {

                                    const pending =
                                        pendingIceCandidatesRef
                                            .current
                                            .get(from) ||
                                        [];


                                    pending.push(
                                        candidate
                                    );


                                    pendingIceCandidatesRef
                                        .current
                                        .set(
                                            from,
                                            pending
                                        );

                                }

                            }

                        } catch (error) {

                            console.error(
                                "WebRTC signaling error:",
                                error
                            );

                        }

                    }
                );


                // =========================================
                // USER LEFT
                // =========================================

                socket.on(
                    "user-left",
                    ({ socketId }) => {

                        if (cancelled) {
                            return;
                        }


                        console.log(
                            "User left:",
                            socketId
                        );


                        participantsRef.current =
                            participantsRef
                                .current
                                .filter(
                                    (participant) =>
                                        participant.socketId !==
                                        socketId
                                );


                        setParticipants(
                            participantsRef
                                .current
                        );


                        setMediaStates(
                            (previous) => {

                                const updated = {
                                    ...previous
                                };


                                delete updated[
                                    socketId
                                ];


                                return updated;

                            }
                        );


                        removePeer(
                            socketId
                        );

                    }
                );


                // =========================================
                // MEETING ENDED
                // =========================================

                socket.on(
                    "meeting-ended",
                    ({ message }) => {

                        console.log(
                            "Meeting ended:",
                            message
                        );


                        peerConnectionsRef
                            .current
                            .forEach(
                                (peerConnection) => {

                                    try {

                                        peerConnection
                                            .close();

                                    } catch {
                                        // Ignore.
                                    }

                                }
                            );


                        peerConnectionsRef
                            .current
                            .clear();


                        pendingIceCandidatesRef
                            .current
                            .clear();


                        setRemoteStreams([]);

                        setPeerStates({});


                        socket.disconnect();

                        socketRef.current =
                            null;


                        sessionStorage.removeItem(
                            "guestToken"
                        );


                        navigate(
                            "/dashboard",
                            {
                                replace: true
                            }
                        );

                    }
                );


                // =========================================
                // SOCKET CONNECTION ERROR
                // =========================================

                socket.on(
                    "connect_error",
                    (error) => {

                        console.error(
                            "Socket connection error:",
                            error
                        );


                        setConnected(
                            false
                        );


                        /*
                         * Initial connection failure:
                         * show an error.
                         *
                         * Reconnect failure:
                         * don't immediately destroy
                         * the meeting UI.
                         */

                        if (
                            !hasConnectedBeforeRef
                                .current &&
                            !cancelled
                        ) {

                            setError(
                                error.message ||
                                "Socket connection failed"
                            );

                        }

                    }
                );


                // =========================================
                // START SOCKET
                // =========================================

                socket.connect();

            } catch (error) {

                if (cancelled) {
                    return;
                }


                console.error(
                    "Meeting error:",
                    error
                );


                setError(
                    error.response?.data?.message ||
                    "Unable to join meeting"
                );

            }

        };


        joinMeeting();


        // =================================================
        // CLEANUP
        // =================================================

        return () => {

            cancelled = true;


            console.log(
                "Cleaning meeting resources..."
            );


            // =============================================
            // SCREEN SHARE
            // =============================================

            const activeScreenStream =
                screenStreamRef.current;


            if (activeScreenStream) {

                activeScreenStream
                    .getTracks()
                    .forEach(
                        (track) =>
                            track.stop()
                    );

            }


            screenStreamRef.current =
                null;


            setScreenStream(null);

            setIsScreenSharing(
                false
            );


            // =============================================
            // SOCKET
            // =============================================

            const socket =
                socketRef.current;


            if (socket) {

                try {

                    socket.emit(
                        "leave-call"
                    );

                } catch {
                    // Ignore.
                }


                socket.disconnect();

                socketRef.current =
                    null;

            }


            // =============================================
            // PEER CONNECTIONS
            // =============================================

            peerConnectionsRef
                .current
                .forEach(
                    (peerConnection) => {

                        try {

                            peerConnection.close();

                        } catch {
                            // Ignore.
                        }

                    }
                );


            peerConnectionsRef
                .current
                .clear();


            // =============================================
            // ICE
            // =============================================

            pendingIceCandidatesRef
                .current
                .clear();


            // =============================================
            // RESET
            // =============================================

            participantsRef.current =
                [];

            hasConnectedBeforeRef
                .current =
                false;

            setPeerStates({});

            setRemoteStreams([]);

        };


    }, [meetingId, mediaLoading]);


    // =====================================================
    // CHAT
    // =====================================================

    const sendChatMessage = () => {

        const message =
            chatMessage.trim();


        if (!message) {
            return;
        }


        const socket =
            socketRef.current;


        if (!socket?.connected) {
            return;
        }


        socket.emit(
            "send-message",
            {
                message
            },
            (response) => {

                if (!response?.success) {

                    console.error(
                        "Failed to send message:",
                        response?.message
                    );

                    return;
                }


                setChatMessage("");

            }
        );

    };


    const handleChatKeyDown = (
        event
    ) => {

        if (
            event.key ===
            "Enter"
        ) {

            event.preventDefault();

            sendChatMessage();

        }

    };


    // =====================================================
    // ADMIT PARTICIPANT
    // =====================================================

    const admitUser = (
        requestId
    ) => {

        const socket =
            socketRef.current;


        if (!socket?.connected) {
            return;
        }


        socket.emit(
            "admit-user",
            { requestId },
            (response) => {

                if (!response?.success) {

                    console.error(
                        "Failed to admit participant:",
                        response?.message
                    );

                    return;
                }


                setPendingJoinRequests(
                    (previous) =>
                        previous.filter(
                            (item) =>
                                item.requestId !==
                                requestId
                        )
                );

            }
        );

    };


    // =====================================================
    // REJECT PARTICIPANT
    // =====================================================

    const rejectUser = (
        requestId
    ) => {

        const socket =
            socketRef.current;


        if (!socket?.connected) {
            return;
        }


        socket.emit(
            "reject-user",
            { requestId },
            (response) => {

                if (!response?.success) {

                    console.error(
                        "Failed to reject participant:",
                        response?.message
                    );

                    return;
                }


                setPendingJoinRequests(
                    (previous) =>
                        previous.filter(
                            (item) =>
                                item.requestId !==
                                requestId
                        )
                );

            }
        );

    };


    // =====================================================
    // LEAVE MEETING
    // =====================================================

    const leaveMeeting = () => {

        console.log(
            "Leaving meeting..."
        );


        const socket =
            socketRef.current;


        if (socket) {

            try {

                socket.emit(
                    "leave-call"
                );

            } catch {
                // Ignore.
            }


            socket.disconnect();

            socketRef.current =
                null;

        }


        peerConnectionsRef
            .current
            .forEach(
                (peerConnection) => {

                    try {

                        peerConnection.close();

                    } catch {
                        // Ignore.
                    }

                }
            );


        peerConnectionsRef
            .current
            .clear();


        pendingIceCandidatesRef
            .current
            .clear();


        sessionStorage.removeItem(
            "guestToken"
        );


        setJoinStatus("rejected");


        navigate(
            "/dashboard",
            {
                replace: true
            }
        );

    };


    // =====================================================
    // MICROPHONE
    // =====================================================

    const toggleMicrophone = () => {

        const localStream =
            localStreamRef.current;


        if (!localStream) {
            return;
        }


        const audioTracks =
            localStream.getAudioTracks();


        if (audioTracks.length === 0) {
            return;
        }


        const newMutedState =
            !isMuted;


        audioTracks.forEach(
            (track) => {

                track.enabled =
                    !newMutedState;

            }
        );


        setIsMuted(
            newMutedState
        );


        const socket =
            socketRef.current;


        if (socket?.connected) {

            socket.emit(
                "media-state",
                {

                    meetingId,

                    muted:
                        newMutedState,

                    cameraOff:
                        isCameraOff,

                    screenSharing:
                        isScreenSharing

                }
            );

        }

    };


    // =====================================================
    // CAMERA
    // =====================================================

    const toggleCamera = () => {

        const localStream =
            localStreamRef.current;


        if (!localStream) {
            return;
        }


        const videoTracks =
            localStream.getVideoTracks();


        if (videoTracks.length === 0) {
            return;
        }


        const newCameraOffState =
            !isCameraOff;


        videoTracks.forEach(
            (track) => {

                track.enabled =
                    !newCameraOffState;

            }
        );


        setIsCameraOff(
            newCameraOffState
        );


        const socket =
            socketRef.current;


        if (socket?.connected) {

            socket.emit(
                "media-state",
                {

                    meetingId,

                    muted:
                        isMuted,

                    cameraOff:
                        newCameraOffState,

                    screenSharing:
                        isScreenSharing

                }
            );

        }

    };

        const renegotiate = async (peerId, peerConnection) => {
        const socket = socketRef.current;

        if (!socket?.connected || peerConnection.signalingState !== "stable") {
            return;
        }

        try {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            socket.emit("signal", {
                to: peerId,
                data: {
                    type: "offer",
                    sdp: peerConnection.localDescription,
                },
            });
        } catch (error) {
            console.error("Renegotiation failed:", error);
        }
    };

    // Sends `track` to one peer. Works whether or not we joined with a camera.
    const setVideoTrack = async (
        peerId,
        peerConnection,
        track,
        fallbackStream
    ) => {
        const shared = localStreamRef.current || fallbackStream;

        const transceiver = peerConnection
            .getTransceivers()
            .find((t) => t.receiver.track.kind === "video");

        if (transceiver) {
            await transceiver.sender.replaceTrack(track);

            // We answered without a camera, so this was negotiated receive-only.
            if (track && transceiver.direction !== "sendrecv") {
                transceiver.sender.setStreams(shared);
                transceiver.direction = "sendrecv";
                await renegotiate(peerId, peerConnection);
            }

            return;
        }

        if (track) {
            peerConnection.addTrack(track, shared);
            await renegotiate(peerId, peerConnection);
        }
    };
    // =====================================================
    // START SCREEN SHARING
    // =====================================================

    const startScreenSharing =
        async () => {

            if (isScreenSharing) {
                return;
            }


            try {

                const displayStream =
                    await navigator
                        .mediaDevices
                        .getDisplayMedia({
                            video: true,
                            audio: false
                        });


                const screenTrack =
                    displayStream
                        .getVideoTracks()[0];


                if (!screenTrack) {

                    displayStream
                        .getTracks()
                        .forEach(
                            (track) =>
                                track.stop()
                        );

                    return;
                }


                screenStreamRef.current =
                    displayStream;


                setScreenStream(
                    displayStream
                );


                setIsScreenSharing(
                    true
                );


                // =========================================
                // BROADCAST MEDIA STATE
                // =========================================

                const socket =
                    socketRef.current;


                if (socket?.connected) {

                    socket.emit(
                        "media-state",
                        {

                            meetingId,

                            muted:
                                isMuted,

                            cameraOff:
                                isCameraOff,

                            screenSharing:
                                true

                        }
                    );

                }


                // =========================================
                // REPLACE CAMERA TRACK
                // =========================================

                               const jobs = [];

                peerConnectionsRef.current.forEach(
                    (peerConnection, peerId) => {
                        jobs.push(
                            setVideoTrack(
                                peerId,
                                peerConnection,
                                screenTrack,
                                displayStream
                            )
                        );
                    }
                );

                await Promise.allSettled(jobs);


                // Browser "Stop sharing".
                screenTrack.onended =
                    () => {

                        stopScreenSharing();

                    };

            } catch (error) {

                console.error(
                    "Screen sharing failed:",
                    error
                );

            }

        };


    // =====================================================
    // STOP SCREEN SHARING
    // =====================================================

    const stopScreenSharing =
        async () => {

            const displayStream =
                screenStreamRef.current;


            if (!displayStream) {
                return;
            }


            const cameraStream =
                localStreamRef.current;


            const cameraTrack =
                cameraStream
                    ?.getVideoTracks()[0];


            // =========================================
            // RESTORE CAMERA TRACK
            // =========================================

                        const jobs = [];

            peerConnectionsRef.current.forEach((peerConnection, peerId) => {
                jobs.push(
                    setVideoTrack(
                        peerId,
                        peerConnection,
                        cameraTrack || null,
                        null
                    )
                );
            });

            await Promise.allSettled(jobs);


            // =========================================
            // STOP DISPLAY STREAM
            // =========================================

            displayStream
                .getTracks()
                .forEach(
                    (track) =>
                        track.stop()
                );


            screenStreamRef.current =
                null;


            setScreenStream(
                null
            );


            setIsScreenSharing(
                false
            );


            // =========================================
            // BROADCAST
            // =========================================

            const socket =
                socketRef.current;


            if (socket?.connected) {

                socket.emit(
                    "media-state",
                    {

                        meetingId,

                        muted:
                            isMuted,

                        cameraOff:
                            isCameraOff,

                        screenSharing:
                            false

                    }
                );

            }

        };


    // =====================================================
    // END MEETING
    // =====================================================

    const endMeeting =
        async () => {

            try {

                console.log(
                    "Ending meeting..."
                );


                await api.post(
                    `/meeting/${meetingId}/end`
                );


                sessionStorage.removeItem(
                    "guestToken"
                );


                navigate(
                    "/dashboard",
                    {
                        replace: true
                    }
                );

            } catch (error) {

                console.error(
                    "End meeting error:",
                    error
                );


                setError(
                    error.response?.data?.message ||
                    "Failed to end meeting"
                );

            }

        };


    // =====================================================
    // ERROR SCREEN
    // =====================================================

    // ERROR / WAITING / REJECTED / CONNECTING SCREENS

    if (error) {
        return (
            <Centered title="Couldn't join this meeting">
                <p className="mt-2 text-sm text-stone-600">{error}</p>
                <button onClick={() => navigate("/")} className={primaryBtn}>
                    Go home
                </button>
            </Centered>
        );
    }

    if (joinStatus === "waiting") {
        return (
            <Centered title="Waiting for the host" busy>
                <p className="mt-2 text-sm text-stone-600">
                    The host knows you're here. You'll be in as soon as they
                    let you through.
                </p>
                <button onClick={leaveMeeting} className={secondaryBtn}>
                    Cancel
                </button>
            </Centered>
        );
    }

    if (joinStatus === "rejected") {
        return (
            <Centered title="You weren't let in">
                <p className="mt-2 text-sm text-stone-600">
                    {joinRejectionReason || "The host did not admit you."}
                </p>
                <button onClick={() => navigate("/")} className={primaryBtn}>
                    Go home
                </button>
            </Centered>
        );
    }

    if (joinStatus !== "joined") {
        return (
            <Centered title="Getting you in" busy>
                <p className="mt-2 text-sm text-stone-600">
                    Checking the meeting and setting up your connection.
                </p>
            </Centered>
        );
    }

    // MAIN CALL UI

    const copyMeetingId = async () => {
        try {
            await navigator.clipboard.writeText(meetingId);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // clipboard can be blocked; nothing to do
        }
    };

        const total = participants.length + 1;

    return (
        <div className="flex h-dvh flex-col bg-stone-100 text-stone-900">
            {/* top bar */}
            <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
                <div className="flex items-center gap-3">
                    <span className="font-semibold tracking-tight">Meetus</span>
                    <button
                        onClick={copyMeetingId}
                        title="Copy meeting ID"
                        className="flex items-center gap-2 rounded-lg bg-stone-100 px-3 py-1.5 font-mono text-sm tracking-wider text-stone-700 transition hover:bg-stone-200"
                    >
                        {meetingId}
                        {copied ? (
                            <Check size={14} className="text-emerald-600" />
                        ) : (
                            <Copy size={14} />
                        )}
                    </button>
                </div>

                <div className="flex items-center gap-2 text-sm text-stone-600">
                    <span
                        className={`h-2 w-2 rounded-full ${
                            connected ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                    />
                    {connected ? "Connected" : "Reconnecting..."}
                </div>
            </header>

            {/* notices */}
            {mediaError && (
                <p className="bg-amber-50 px-4 py-2 text-sm text-amber-800">
                    Camera or microphone isn't available ({mediaError}). You can
                    still watch and chat.
                </p>
            )}

            {isHost && pendingJoinRequests.length > 0 && (
                <div className="space-y-2 border-b border-stone-200 bg-blue-50 px-4 py-3">
                    {pendingJoinRequests.map((request) => (
                        <div
                            key={request.requestId}
                            className="flex flex-wrap items-center justify-between gap-3"
                        >
                            <p className="text-sm text-stone-800">
                                <span className="font-semibold">
                                    {request.user.name}
                                </span>
                                {request.user.role === "guest" && " (guest)"} wants
                                to join
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => rejectUser(request.requestId)}
                                    className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
                                >
                                    Decline
                                </button>
                                <button
                                    onClick={() => admitUser(request.requestId)}
                                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                                >
                                    Admit
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* video area + side panel */}
            <div className="flex min-h-0 flex-1">
                <main className="flex-1 overflow-y-auto p-4">
                    <div
                        className={`mx-auto grid w-full gap-4 ${gridClass(total)}`}
                    >
                        <LocalVideo
                            stream={screenStream || stream}
                            micOff={isMuted}
                            cameraOff={isCameraOff}
                            sharing={isScreenSharing}
                        />

                                               {participants.map((p) => {
                            const remote = remoteStreams.find(
                                (r) => r.peerId === p.socketId
                            );
                            const state = mediaStates[p.socketId];

                            return (
                                <RemoteVideo
                                    key={p.socketId}
                                    stream={remote?.stream || null}
                                    name={p.user.name}
                                    micOff={state?.muted}
                                    cameraOff={state?.cameraOff}
                                    sharing={state?.screenSharing}
                                    status={peerStates[p.socketId]?.connectionState}
                                />
                            );
                        })}
                    </div>

                    {remoteStreams.length === 0 && (
                        <p className="mt-6 text-center text-sm text-stone-500">
                            You're the only one here. Share the meeting ID so
                            others can join.
                        </p>
                    )}
                </main>

                {panel && (
                    <aside className="fixed inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col border-l border-stone-200 bg-white lg:static lg:w-80 lg:max-w-none">
                        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
                            <h2 className="font-semibold">
                                {panel === "chat"
                                    ? "Chat"
                                    : `People (${participants.length + 1})`}
                            </h2>
                            <button
                                onClick={() => setPanel(null)}
                                aria-label="Close panel"
                                className="rounded-md p-1 text-stone-500 hover:bg-stone-100"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {panel === "chat" ? (
                            <>
                                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                                    {messages.length === 0 && (
                                        <p className="text-sm text-stone-500">
                                            No messages yet. Say hi.
                                        </p>
                                    )}

                                    {messages.map((message) => (
                                        <div key={message.id}>
                                            <p className="text-xs font-semibold text-stone-700">
                                                {message.senderName}
                                                {message.senderRole ===
                                                    "guest" && (
                                                    <span className="ml-1.5 rounded bg-stone-100 px-1.5 py-0.5 font-normal text-stone-500">
                                                        Guest
                                                    </span>
                                                )}
                                            </p>
                                            <p className="mt-0.5 break-words text-sm text-stone-800">
                                                {message.message}
                                            </p>
                                        </div>
                                    ))}

                                    <div ref={chatEndRef} />
                                </div>

                                <div className="flex gap-2 border-t border-stone-200 p-3">
                                    <input
                                        type="text"
                                        value={chatMessage}
                                        onChange={(event) =>
                                            setChatMessage(event.target.value)
                                        }
                                        onKeyDown={handleChatKeyDown}
                                        placeholder="Type a message"
                                        maxLength={1000}
                                        className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                                    />
                                    <button
                                        onClick={sendChatMessage}
                                        disabled={!chatMessage.trim()}
                                        aria-label="Send message"
                                        className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <Send size={16} />
                                    </button>
                                </div>
                            </>
                        ) : (
                            <ul className="flex-1 divide-y divide-stone-100 overflow-y-auto">
                                <li className="flex items-center gap-3 px-4 py-3">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                                        Y
                                    </span>
                                    <span className="flex-1 text-sm font-medium">
                                        You
                                        {isHost && (
                                            <Crown
                                                size={13}
                                                className="ml-1.5 inline text-amber-500"
                                            />
                                        )}
                                    </span>
                                    {isMuted && (
                                        <MicOff size={15} className="text-red-600" />
                                    )}
                                    {isCameraOff && (
                                        <VideoOff size={15} className="text-red-600" />
                                    )}
                                </li>

                                {participants.map((participant) => {
                                    const state =
                                        mediaStates[participant.socketId];

                                    return (
                                        <li
                                            key={participant.socketId}
                                            className="flex items-center gap-3 px-4 py-3"
                                        >
                                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-sm font-semibold text-stone-700">
                                                {participant.user.name
                                                    .trim()
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            </span>
                                            <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                                {participant.user.name}
                                                {participant.user.role ===
                                                    "guest" && (
                                                    <span className="ml-1.5 text-xs font-normal text-stone-500">
                                                        Guest
                                                    </span>
                                                )}
                                                {participant.isHost && (
                                                    <Crown
                                                        size={13}
                                                        className="ml-1.5 inline text-amber-500"
                                                    />
                                                )}
                                            </span>
                                            {state?.screenSharing && (
                                                <MonitorUp
                                                    size={15}
                                                    className="text-blue-600"
                                                />
                                            )}
                                            {state?.muted && (
                                                <MicOff
                                                    size={15}
                                                    className="text-red-600"
                                                />
                                            )}
                                            {state?.cameraOff && (
                                                <VideoOff
                                                    size={15}
                                                    className="text-red-600"
                                                />
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </aside>
                )}
            </div>

            {/* controls */}
            <footer className="border-t border-stone-200 bg-white px-4 py-3">
                <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-3">
                    <ControlButton
                        onClick={toggleMicrophone}
                        label={isMuted ? "Unmute" : "Mute"}
                        danger={isMuted}
                    >
                        {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                    </ControlButton>

                    <ControlButton
                        onClick={toggleCamera}
                        label={isCameraOff ? "Turn camera on" : "Turn camera off"}
                        danger={isCameraOff}
                    >
                        {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
                    </ControlButton>

                    <ControlButton
                        onClick={
                            isScreenSharing ? stopScreenSharing : startScreenSharing
                        }
                        label={isScreenSharing ? "Stop sharing" : "Share screen"}
                        active={isScreenSharing}
                    >
                        {isScreenSharing ? (
                            <MonitorOff size={20} />
                        ) : (
                            <MonitorUp size={20} />
                        )}
                    </ControlButton>

                    <span className="mx-1 hidden h-8 w-px bg-stone-200 sm:block" />

                    <ControlButton
                        onClick={() =>
                            setPanel(panel === "chat" ? null : "chat")
                        }
                        label="Chat"
                        active={panel === "chat"}
                    >
                        <MessageSquare size={20} />
                    </ControlButton>

                    <ControlButton
                        onClick={() =>
                            setPanel(panel === "people" ? null : "people")
                        }
                        label="People"
                        active={panel === "people"}
                    >
                        <Users size={20} />
                    </ControlButton>

                    <span className="mx-1 hidden h-8 w-px bg-stone-200 sm:block" />

                    <button
                        onClick={leaveMeeting}
                        className="flex h-12 items-center gap-2 rounded-full bg-red-600 px-5 text-sm font-medium text-white transition hover:bg-red-700"
                    >
                        <PhoneOff size={18} />
                        Leave
                    </button>

                    {isHost && (
                        <button
                            onClick={() => {
                                if (
                                    window.confirm(
                                        "End the meeting for everyone?"
                                    )
                                ) {
                                    endMeeting();
                                }
                            }}
                            className="h-12 rounded-full border border-red-200 px-4 text-sm font-medium text-red-700 transition hover:bg-red-50"
                        >
                            End for all
                        </button>
                    )}
                </div>
            </footer>
        </div>
    );
};

export default Meeting;
