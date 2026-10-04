import {
    useEffect,
    useRef,
    useState
} from "react";

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

                const replacements = [];


                peerConnectionsRef
                    .current
                    .forEach(
                        (peerConnection) => {

                            const sender =
                                peerConnection
                                    .getSenders()
                                    .find(
                                        (item) =>
                                            item
                                                .track
                                                ?.kind ===
                                            "video"
                                    );


                            if (sender) {

                                replacements.push(
                                    sender
                                        .replaceTrack(
                                            screenTrack
                                        )
                                );

                            }

                        }
                    );


                await Promise.allSettled(
                    replacements
                );


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

            if (cameraTrack) {

                const replacements = [];


                peerConnectionsRef
                    .current
                    .forEach(
                        (peerConnection) => {

                            const sender =
                                peerConnection
                                    .getSenders()
                                    .find(
                                        (item) =>
                                            item
                                                .track
                                                ?.kind ===
                                            "video"
                                    );


                            if (sender) {

                                replacements.push(
                                    sender
                                        .replaceTrack(
                                            cameraTrack
                                        )
                                );

                            }

                        }
                    );


                await Promise.allSettled(
                    replacements
                );

            }


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

    if (error) {

        return (
            <div>

                <h2>
                    Unable to join meeting
                </h2>

                <p>
                    {error}
                </p>

                <button
                    onClick={() =>
                        navigate("/")
                    }
                >
                    Go Home
                </button>

            </div>
        );

    }


    // =====================================================
    // WAITING FOR HOST
    // =====================================================

    if (
        joinStatus ===
        "waiting"
    ) {

        return (
            <div>

                <h1>
                    Waiting for Host
                </h1>

                <p>
                    Your request has been sent to the host.
                </p>

                <p>
                    Please wait for the host to admit you.
                </p>

                <button
                    onClick={
                        leaveMeeting
                    }
                >
                    Cancel
                </button>

            </div>
        );

    }


    // =====================================================
    // REQUEST REJECTED
    // =====================================================

    if (
        joinStatus ===
        "rejected"
    ) {

        return (
            <div>

                <h1>
                    Unable to Join Meeting
                </h1>

                <p>
                    {joinRejectionReason ||
                        "The host did not admit you."}
                </p>

                <button
                    onClick={() =>
                        navigate("/")
                    }
                >
                    Go Home
                </button>

            </div>
        );

    }


    // =====================================================
    // CONNECTING / ACCESS CHECK
    // =====================================================

    if (
        joinStatus !==
        "joined"
    ) {

        return (
            <div>

                <h1>
                    Joining Meeting
                </h1>

                <p>
                    Connecting and checking meeting access...
                </p>

            </div>
        );

    }


    // =====================================================
    // UI
    // =====================================================

    return (
        <div>

            <h1>
                Meeting
            </h1>


            <h2>
                {meetingId}
            </h2>


            <p>
                Status:{" "}

                {connected
                    ? "Connected"
                    : "Connecting..."
                }
            </p>


            <hr />


            {/* =================================================
                LOCAL VIDEO
            ================================================= */}

            <h2>
                My Camera
            </h2>


            {mediaLoading && (
                <p>
                    Starting camera and microphone...
                </p>
            )}


            {mediaError && (
                <p>
                    Camera/Microphone unavailable:
                    {" "}
                    {mediaError}
                </p>
            )}


            {(screenStream || stream) && (
                <LocalVideo
                    stream={
                        screenStream ||
                        stream
                    }
                />
            )}


            <div>

                <button
                    onClick={
                        toggleMicrophone
                    }
                >
                    {isMuted
                        ? "Unmute"
                        : "Mute"
                    }
                </button>


                {" "}


                <button
                    onClick={
                        toggleCamera
                    }
                >
                    {isCameraOff
                        ? "Turn Camera On"
                        : "Turn Camera Off"
                    }
                </button>


                {" "}


                {!isScreenSharing ? (

                    <button
                        onClick={
                            startScreenSharing
                        }
                    >
                        Share Screen
                    </button>

                ) : (

                    <button
                        onClick={
                            stopScreenSharing
                        }
                    >
                        Stop Sharing
                    </button>

                )}

            </div>


            <hr />


            {/* =================================================
                REMOTE VIDEOS
            ================================================= */}

            <h2>
                Remote Participants
            </h2>


            {remoteStreams.length === 0 && (
                <p>
                    No remote video yet.
                </p>
            )}


            <div>

                {remoteStreams.map(
                    ({
                        peerId,
                        stream,
                        name,
                        role
                    }) => {

                        const peerState =
                            peerStates[
                                peerId
                            ];


                        return (
                            <div
                                key={peerId}
                            >

                                <p>

                                    <strong>
                                        {name}
                                    </strong>

                                    {" "}

                                    (
                                    {role}
                                    )

                                    {" "}


                                    {peerState
                                        ?.connectionState ===
                                        "connected" && (
                                        <span>
                                            🟢 Connected
                                        </span>
                                    )}


                                    {peerState
                                        ?.connectionState ===
                                        "connecting" && (
                                        <span>
                                            🟡 Connecting
                                        </span>
                                    )}


                                    {peerState
                                        ?.connectionState ===
                                        "disconnected" && (
                                        <span>
                                            🟠 Disconnected
                                        </span>
                                    )}


                                    {peerState
                                        ?.connectionState ===
                                        "failed" && (
                                        <span>
                                            🔴 Failed
                                        </span>
                                    )}

                                </p>


                                <RemoteVideo
                                    stream={
                                        stream
                                    }
                                />

                            </div>
                        );

                    }
                )}

            </div>


            <hr />


            {/* =================================================
                HOST JOIN REQUESTS
            ================================================= */}

            {isHost &&
                pendingJoinRequests.length > 0 && (

                <div>

                    <h2>
                        Join Requests
                    </h2>

                    {pendingJoinRequests.map(
                        (request) => (

                            <div
                                key={
                                    request.requestId
                                }
                            >

                                <strong>
                                    {
                                        request.user.name
                                    }
                                </strong>

                                {" "}

                                (
                                {
                                    request.user.role
                                }
                                )

                                {" "}

                                <button
                                    onClick={() =>
                                        admitUser(
                                            request.requestId
                                        )
                                    }
                                >
                                    Admit
                                </button>

                                {" "}

                                <button
                                    onClick={() =>
                                        rejectUser(
                                            request.requestId
                                        )
                                    }
                                >
                                    Reject
                                </button>

                            </div>

                        )
                    )}

                </div>

            )}


            <hr />


            {/* =================================================
                CHAT
            ================================================= */}

            <h2>
                Chat
            </h2>


            <div
                style={{
                    border:
                        "1px solid #ccc",

                    width:
                        "400px",

                    height:
                        "300px",

                    overflowY:
                        "auto",

                    padding:
                        "10px"
                }}
            >

                {messages.length === 0 && (
                    <p>
                        No messages yet.
                    </p>
                )}


                {messages.map(
                    (message) => (

                        <div
                            key={
                                message.id
                            }
                            style={{
                                marginBottom:
                                    "10px"
                            }}
                        >

                            <strong>
                                {
                                    message
                                        .senderName
                                }
                            </strong>


                            {" "}


                            {message
                                .senderRole ===
                                "guest" && (
                                <small>
                                    (Guest)
                                </small>
                            )}


                            <div>
                                {
                                    message
                                        .message
                                }
                            </div>

                        </div>

                    )
                )}


                <div
                    ref={
                        chatEndRef
                    }
                />

            </div>


            <div
                style={{
                    marginTop:
                        "10px"
                }}
            >

                <input
                    type="text"
                    value={
                        chatMessage
                    }
                    onChange={
                        (event) =>
                            setChatMessage(
                                event.target
                                    .value
                            )
                    }
                    onKeyDown={
                        handleChatKeyDown
                    }
                    placeholder={
                        "Type a message..."
                    }
                    maxLength={1000}
                />


                {" "}


                <button
                    onClick={
                        sendChatMessage
                    }
                >
                    Send
                </button>

            </div>


            <hr />


            {/* =================================================
                PARTICIPANTS
            ================================================= */}

            <h2>
                Participants
            </h2>


            {participants.length === 0 && (
                <p>
                    No other participants yet.
                </p>
            )}


            {participants.map(
                (participant) => {

                    const state =
                        mediaStates[
                            participant
                                .socketId
                        ];


                    return (
                        <div
                            key={
                                participant
                                    .socketId
                            }
                        >

                            <strong>
                                {
                                    participant
                                        .user
                                        .name
                                }
                            </strong>

                            {" "}

                            (
                            {
                                participant
                                    .user
                                    .role
                            }
                            )


                            {participant.isHost && (
                                <span>
                                    {" "}
                                    👑 Host
                                </span>
                            )}


                            {state?.muted && (
                                <span>
                                    {" "}
                                    🔇 Muted
                                </span>
                            )}


                            {state?.cameraOff && (
                                <span>
                                    {" "}
                                    📷 Camera Off
                                </span>
                            )}


                            {state?.screenSharing && (
                                <span>
                                    {" "}
                                    🖥 Sharing Screen
                                </span>
                            )}

                        </div>
                    );

                }
            )}


            <br />


            {/* =================================================
                MEETING CONTROLS
            ================================================= */}

            <button
                onClick={
                    leaveMeeting
                }
            >
                Leave Meeting
            </button>


            {" "}


            {isHost && (
                <button
                    onClick={
                        endMeeting
                    }
                >
                    End Meeting
                </button>
            )}

        </div>
    );

};


export default Meeting;