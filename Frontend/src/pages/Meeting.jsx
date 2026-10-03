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


    // Keep latest local stream without restarting
    // socket / WebRTC lifecycle.
    const localStreamRef = useRef(null);


    useEffect(() => {

        localStreamRef.current = stream;

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

    // Important:
    // Avoid making the main WebRTC effect depend on
    // participants state.
    const participantsRef =
        useRef([]);

    // Chat auto-scroll.
    const chatEndRef =
        useRef(null);


    // Keep participant ref synchronized.
    useEffect(() => {

        participantsRef.current =
            participants;

    }, [participants]);


    // Auto-scroll chat.
    useEffect(() => {

        chatEndRef.current?.scrollIntoView({
            behavior: "smooth"
        });

    }, [messages]);


    // =====================================================
    // MAIN MEETING / SOCKET / WEBRTC EFFECT
    // =====================================================

    useEffect(() => {

        // Wait only for getUserMedia() to finish.
        // Even if camera/mic fails, allow meeting entry.

        if (mediaLoading) {
            return;
        }


        let cancelled = false;


        // =================================================
        // REMOVE PEER
        // =================================================

        const removePeer = (peerId) => {

            const peerConnection =
                peerConnectionsRef
                    .current
                    .get(peerId);


            if (peerConnection) {

                try {
                    peerConnection.close();
                } catch (error) {
                    console.error(
                        "Peer close error:",
                        error
                    );
                }

            }


            peerConnectionsRef
                .current
                .delete(peerId);


            pendingIceCandidatesRef
                .current
                .delete(peerId);


            setPeerStates((previous) => {

                const updated = {
                    ...previous
                };

                delete updated[peerId];

                return updated;

            });


            setRemoteStreams((previous) =>
                previous.filter(
                    (item) =>
                        item.peerId !== peerId
                )
            );

        };


        // =================================================
        // CREATE PEER CONNECTION
        // =================================================

        const createPeerConnection = (
            peerId,
            socket
        ) => {

            // Reuse existing peer.
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
            setPeerStates((previous) => ({
                ...previous,
                [peerId]: {
                    connectionState:
                        "new",
                    iceConnectionState:
                        "new"
                }
            }));


            // =============================================
            // LOCAL TRACKS
            // =============================================

            const localStream =
                localStreamRef.current;


            if (localStream) {

                localStream
                    .getTracks()
                    .forEach((track) => {

                        try {

                            peerConnection.addTrack(
                                track,
                                localStream
                            );

                        } catch (error) {

                            console.error(
                                "Failed to add local track:",
                                error
                            );

                        }

                    });

            }


            // =============================================
            // ICE CONNECTION STATE
            // =============================================

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


            // =============================================
            // SIGNALING STATE
            // =============================================

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


            // =============================================
            // PEER CONNECTION STATE
            // =============================================

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


                    // =================================
                    // FAILED
                    // =================================

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


                    // =================================
                    // CLOSED
                    // =================================

                    if (
                        state ===
                        "closed"
                    ) {

                        removePeer(
                            peerId
                        );

                        return;
                    }

                };


            // =============================================
            // ICE CANDIDATE
            // =============================================

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


                    console.log(
                        "Sending ICE candidate:",
                        peerId
                    );


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


            // =============================================
            // REMOTE TRACK
            // =============================================

            peerConnection.ontrack =
                (event) => {

                    if (cancelled) {
                        return;
                    }


                    console.log(
                        "Remote track received:",
                        peerId
                    );


                    const remoteStream =
                        event.streams[0];


                    if (!remoteStream) {
                        return;
                    }


                    // Get participant from ref
                    // to avoid effect dependency.
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
        // FLUSH PENDING ICE CANDIDATES
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


                console.log(
                    "Flushing queued ICE candidates:",
                    peerId,
                    candidates.length
                );


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
                // VERIFY MEETING
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
                // GET AUTH TOKEN
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
                // CONNECT
                // =========================================

                socket.on(
                    "connect",
                    () => {

                        if (cancelled) {
                            return;
                        }


                        console.log(
                            "Socket connected:",
                            socket.id
                        );


                        setConnected(
                            true
                        );


                        // =================================
                        // JOIN ROOM
                        // =================================

                        socket.emit(
                            "join-call",
                            {
                                meetingId
                            },
                            (joinResponse) => {

                                if (
                                    cancelled
                                ) {
                                    return;
                                }


                                console.log(
                                    "Join response:",
                                    joinResponse
                                );


                                if (
                                    !joinResponse?.success
                                ) {

                                    setError(
                                        joinResponse
                                            ?.message ||
                                        "Failed to join meeting"
                                    );

                                    return;
                                }


                                // =============================
                                // PARTICIPANTS
                                // =============================

                                const initialParticipants =
                                    joinResponse
                                        .participants ||
                                    [];


                                participantsRef.current =
                                    initialParticipants;


                                setParticipants(
                                    initialParticipants
                                );


                                // =============================
                                // MEDIA STATES
                                // =============================

                                const initialMediaStates =
                                    {};


                                initialParticipants.forEach(
                                    (participant) => {

                                        initialMediaStates[
                                            participant
                                                .socketId
                                        ] =
                                            participant
                                                .mediaState ||
                                            {
                                                ...defaultMediaState
                                            };

                                    }
                                );


                                setMediaStates(
                                    initialMediaStates
                                );


                                // =============================
                                // HOST
                                // =============================

                                setIsHost(
                                    Boolean(
                                        joinResponse
                                            ?.self
                                            ?.isHost
                                    )
                                );


                                // =============================
                                // CHAT HISTORY
                                // =============================

                                socket.emit(
                                    "get-chat-history",
                                    (
                                        historyResponse
                                    ) => {

                                        if (
                                            !historyResponse
                                                ?.success
                                        ) {

                                            console.error(
                                                "Chat history error:",
                                                historyResponse
                                                    ?.message
                                            );

                                            return;
                                        }


                                        setMessages(
                                            historyResponse
                                                .messages ||
                                            []
                                        );

                                    }
                                );

                            }
                        );

                    }
                );


                // =========================================
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


                        // Update ref immediately.
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

                            // =================================
                            // CREATE OFFER
                            // =================================

                            const offer =
                                await peerConnection
                                    .createOffer();


                            await peerConnection
                                .setLocalDescription(
                                    offer
                                );


                            console.log(
                                "Sending offer to:",
                                participant.socketId
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
                // SIGNAL
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

                            console.log(
                                "Signal received:",
                                {
                                    from,
                                    type:
                                        data?.type
                                }
                            );


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

                                        to: from,

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
                            // ICE CANDIDATE
                            // =================================

                            else if (
                                data?.type ===
                                "ice-candidate"
                            ) {

                                const candidate =
                                    data.candidate;


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


                        // Remove from participant ref.
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


                        // Remove media state.
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


                        // Remove WebRTC peer.
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


                        setError(
                            "This meeting has ended."
                        );


                        peerConnectionsRef
                            .current
                            .forEach(
                                (peerConnection) => {

                                    try {
                                        peerConnection.close();
                                    } catch {
                                        // Ignore close error.
                                    }

                                }
                            );


                        peerConnectionsRef
                            .current
                            .clear();


                        pendingIceCandidatesRef
                            .current
                            .clear();


                        setPeerStates({});

                        setRemoteStreams([]);


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
                // SOCKET ERROR
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


                        if (!cancelled) {

                            setError(
                                error.message ||
                                "Socket connection failed"
                            );

                        }

                    }
                );


                // =========================================
                // CONNECT
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
                        (track) => track.stop()
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
            // PEERS
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
            // STATE
            // =============================================

            participantsRef.current =
                [];

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

    const startScreenSharing = async () => {

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


            // =============================================
            // BROADCAST
            // =============================================

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


            // =============================================
            // REPLACE VIDEO TRACK
            // =============================================

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
                                sender.replaceTrack(
                                    screenTrack
                                )
                            );

                        }

                    }
                );


            await Promise.allSettled(
                replacements
            );


            // Browser "Stop sharing"
            // button / browser UI.

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

    const stopScreenSharing = async () => {

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


        // =============================================
        // RESTORE CAMERA
        // =============================================

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
                                sender.replaceTrack(
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


        // =============================================
        // STOP DISPLAY STREAM
        // =============================================

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


        // =============================================
        // BROADCAST
        // =============================================

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

    const endMeeting = async () => {

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


            {/* ==========================================
                LOCAL VIDEO
            =========================================== */}

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


            {/* ==========================================
                REMOTE VIDEOS
            =========================================== */}

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


            {/* ==========================================
                CHAT
            =========================================== */}

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
                            key={message.id}
                            style={{
                                marginBottom:
                                    "10px"
                            }}
                        >

                            <strong>
                                {
                                    message.senderName
                                }
                            </strong>

                            {" "}

                            {message.senderRole ===
                                "guest" && (
                                <small>
                                    (Guest)
                                </small>
                            )}


                            <div>
                                {
                                    message.message
                                }
                            </div>

                        </div>

                    )
                )}


                <div
                    ref={chatEndRef}
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
                                event.target.value
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


            {/* ==========================================
                PARTICIPANTS
            =========================================== */}

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


            {/* ==========================================
                MEETING CONTROLS
            =========================================== */}

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