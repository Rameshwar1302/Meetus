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


    // Keep the latest stream in a ref so the Socket/WebRTC
    // lifecycle doesn't have to restart whenever media state changes.
    const localStreamRef = useRef(null);

    useEffect(() => {

        localStreamRef.current = stream;

    }, [stream]);


    // =====================================================
    // STATE
    // =====================================================

    const [meeting, setMeeting] = useState(null);

    const [participants, setParticipants] =
        useState([]);

    const [remoteStreams, setRemoteStreams] =
        useState([]);

    const [error, setError] =
        useState("");

    const [connected, setConnected] =
        useState(false);

    const [isHost, setIsHost] =
        useState(false);


    // =====================================================
    // REFS
    // =====================================================

    const socketRef = useRef(null);

    const peerConnectionsRef =
        useRef(new Map());

    const pendingIceCandidatesRef =
        useRef(new Map());


    // =====================================================
    // MAIN MEETING / SOCKET / WEBRTC EFFECT
    // =====================================================

    useEffect(() => {

        // Wait only until getUserMedia() has finished.
        //
        // mediaLoading = true:
        //     We don't yet know whether camera/mic works.
        //
        // mediaLoading = false:
        //     Camera/mic either worked or failed.
        //
        // Even when media fails, we still allow the user
        // to join the meeting.

        if (mediaLoading) {
            return;
        }


        let cancelled = false;


        // =================================================
        // CREATE PEER CONNECTION
        // =================================================

        const createPeerConnection = (
            peerId,
            socket
        ) => {

            // Reuse existing connection
            if (
                peerConnectionsRef.current.has(
                    peerId
                )
            ) {

                return peerConnectionsRef.current.get(
                    peerId
                );
            }


            console.log(
                "Creating PeerConnection:",
                peerId
            );


            const peerConnection =
                new RTCPeerConnection(
                    rtcConfiguration
                );


            peerConnectionsRef.current.set(
                peerId,
                peerConnection
            );


            // =============================================
            // LOCAL TRACKS
            // =============================================

            const localStream =
                localStreamRef.current;


            if (localStream) {

                localStream
                    .getTracks()
                    .forEach((track) => {

                        peerConnection.addTrack(
                            track,
                            localStream
                        );

                    });
            }


            // =============================================
            // ICE CONNECTION STATE
            // =============================================

            peerConnection.oniceconnectionstatechange =
                () => {

                    console.log(
                        `ICE ${peerId}:`,
                        peerConnection
                            .iceConnectionState
                    );

                };


            // =============================================
            // SIGNALING STATE
            // =============================================

            peerConnection.onsignalingstatechange =
                () => {

                    console.log(
                        `Signaling ${peerId}:`,
                        peerConnection
                            .signalingState
                    );

                };


            // =============================================
            // PEER CONNECTION STATE
            // =============================================

            peerConnection.onconnectionstatechange =
                () => {

                    const state =
                        peerConnection
                            .connectionState;


                    console.log(
                        `Connection ${peerId}:`,
                        state
                    );


                    if (
                        state === "failed" ||
                        state === "closed"
                    ) {

                        peerConnection.close();


                        peerConnectionsRef
                            .current
                            .delete(peerId);


                        pendingIceCandidatesRef
                            .current
                            .delete(peerId);


                        setRemoteStreams(
                            (previous) =>
                                previous.filter(
                                    (item) =>
                                        item.peerId !==
                                        peerId
                                )
                        );
                    }

                };


            // =============================================
            // ICE CANDIDATE
            // =============================================

            peerConnection.onicecandidate =
                (event) => {

                    if (!event.candidate) {
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

                    console.log(
                        "REMOTE TRACK RECEIVED FROM:",
                        peerId,
                        event.streams
                    );


                    const remoteStream =
                        event.streams[0];


                    if (!remoteStream) {
                        return;
                    }


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
                                            ? {
                                                peerId,
                                                stream:
                                                    remoteStream
                                            }
                                            : item
                                );
                            }


                            return [
                                ...previous,

                                {
                                    peerId,
                                    stream:
                                        remoteStream
                                }
                            ];

                        }
                    );

                };


            return peerConnection;
        };


        // =================================================
        // ICE QUEUE
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


                socketRef.current = socket;


                // =========================================
                // SOCKET CONNECTED
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


                        setConnected(true);


                        // =================================
                        // JOIN SOCKET.IO ROOM
                        // =================================

                        socket.emit(
                            "join-call",

                            {
                                meetingId
                            },

                            (joinResponse) => {

                                console.log(
                                    "Join response:",
                                    joinResponse
                                );


                                if (
                                    !joinResponse.success
                                ) {

                                    setError(
                                        joinResponse.message
                                    );

                                    return;
                                }


                                setParticipants(
                                    joinResponse
                                        .participants ||
                                    []
                                );


                                setIsHost(
                                    joinResponse
                                        .self
                                        ?.isHost ||
                                    false
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


                        // Add participant to UI
                        setParticipants(
                            (previous) => {

                                const exists =
                                    previous.some(
                                        (item) =>
                                            item.socketId ===
                                            participant.socketId
                                    );


                                if (exists) {
                                    return previous;
                                }


                                return [
                                    ...previous,
                                    participant
                                ];

                            }
                        );


                        // =================================
                        // CREATE PEER CONNECTION
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
                // SIGNAL
                // =========================================

                socket.on(
                    "signal",
                    async ({
                        from,
                        data
                    }) => {

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

                                console.log(
                                    "Processing offer from:",
                                    from
                                );


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


                                console.log(
                                    "Sending answer to:",
                                    from
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

                                console.log(
                                    "Processing answer from:",
                                    from
                                );


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

                        console.log(
                            "User left:",
                            socketId
                        );


                        setParticipants(
                            (previous) =>
                                previous.filter(
                                    (participant) =>
                                        participant.socketId !==
                                        socketId
                                )
                        );


                        const peerConnection =
                            peerConnectionsRef
                                .current
                                .get(socketId);


                        if (peerConnection) {

                            peerConnection.close();

                            peerConnectionsRef
                                .current
                                .delete(
                                    socketId
                                );
                        }


                        pendingIceCandidatesRef
                            .current
                            .delete(socketId);


                        setRemoteStreams(
                            (previous) =>
                                previous.filter(
                                    (item) =>
                                        item.peerId !==
                                        socketId
                                )
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


                        // Close all peer connections
                        peerConnectionsRef
                            .current
                            .forEach(
                                (peerConnection) => {
                                    peerConnection.close();
                                }
                            );


                        peerConnectionsRef
                            .current
                            .clear();


                        pendingIceCandidatesRef
                            .current
                            .clear();


                        setRemoteStreams([]);


                        socket.disconnect();


                        socketRef.current = null;


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


                        setConnected(false);


                        if (!cancelled) {

                            setError(
                                error.message
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
            // SOCKET
            // =============================================

            const socket =
                socketRef.current;


            if (socket) {

                socket.disconnect();

                socketRef.current = null;
            }


            // =============================================
            // PEER CONNECTIONS
            // =============================================

            peerConnectionsRef
                .current
                .forEach(
                    (peerConnection) => {

                        peerConnection.close();

                    }
                );


            peerConnectionsRef
                .current
                .clear();


            // =============================================
            // ICE QUEUE
            // =============================================

            pendingIceCandidatesRef
                .current
                .clear();


            // =============================================
            // REMOTE STREAMS
            // =============================================

            setRemoteStreams([]);

        };

    }, [meetingId, mediaLoading]);


    // =====================================================
    // LEAVE MEETING
    // =====================================================

    const leaveMeeting = () => {

        console.log(
            "Leaving meeting..."
        );


        // Disconnect socket
        const socket =
            socketRef.current;


        if (socket) {

            socket.disconnect();

            socketRef.current = null;
        }


        // Close peer connections
        peerConnectionsRef
            .current
            .forEach(
                (peerConnection) => {

                    peerConnection.close();

                }
            );


        peerConnectionsRef
            .current
            .clear();


        // Clear queued ICE candidates
        pendingIceCandidatesRef
            .current
            .clear();


        // Guest session is only for this meeting
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


            // Backend broadcasts meeting-ended
            // but this makes the host leave immediately.
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
                    : "Connecting..."}
            </p>


            <hr />


            {/* ========================================= */}
            {/* LOCAL VIDEO */}
            {/* ========================================= */}

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


            {stream && (
                <LocalVideo
                    stream={stream}
                />
            )}


            <hr />


            {/* ========================================= */}
            {/* REMOTE VIDEOS */}
            {/* ========================================= */}

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
                        stream
                    }) => (

                        <div
                            key={peerId}
                        >

                            <p>
                                Participant
                            </p>

                            <RemoteVideo
                                stream={stream}
                            />

                        </div>

                    )
                )}

            </div>


            <hr />


            {/* ========================================= */}
            {/* PARTICIPANTS */}
            {/* ========================================= */}

            <h2>
                Participants
            </h2>


            {participants.length === 0 && (
                <p>
                    No other participants yet.
                </p>
            )}


            {participants.map(
                (participant) => (

                    <div
                        key={
                            participant.socketId
                        }
                    >

                        <strong>
                            {
                                participant.user.name
                            }
                        </strong>


                        {" "}


                        (
                        {
                            participant.user.role
                        }
                        )


                        {participant.isHost && (
                            <span>
                                {" "}
                                👑 Host
                            </span>
                        )}

                    </div>

                )
            )}


            <br />


            {/* ========================================= */}
            {/* CONTROLS */}
            {/* ========================================= */}

            <button
                onClick={leaveMeeting}
            >
                Leave Meeting
            </button>


            {" "}


            {isHost && (
                <button
                    onClick={endMeeting}
                >
                    End Meeting
                </button>
            )}

        </div>
    );
};


export default Meeting;