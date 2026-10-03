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


const Meeting = () => {

    const { meetingId } = useParams();

    const navigate = useNavigate();

    const socketRef = useRef(null);


    const [meeting, setMeeting] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [isHost, setIsHost] = useState(false);

    const [error, setError] = useState("");
    const [connected, setConnected] = useState(false);


    useEffect(() => {

        let cancelled = false;


        const joinMeeting = async () => {

            try {

                // =====================================
                // GET MEETING
                // =====================================

                const response = await api.get(
                    `/meeting/${meetingId}`
                );


                // If this effect was already cleaned up
                if (cancelled) {
                    return;
                }


                setMeeting(
                    response.data.meeting
                );


                // =====================================
                // GET TOKEN
                // =====================================

                const userToken = localStorage.getItem("accessToken");

                const guestToken = sessionStorage.getItem("guestToken");

                const token = userToken || guestToken;

                if (!token) {

                    setError(
                        "Authentication required"
                    );

                    return;
                }


                // =====================================
                // CREATE SOCKET
                // =====================================

                const socket =
                    createSocket(token);


                // Store the socket
                socketRef.current = socket;


                // =====================================
                // CONNECT
                // =====================================

                socket.on("connect", () => {

                    if (cancelled) {
                        return;
                    }


                    console.log(
                        "Socket connected:",
                        socket.id
                    );


                    setConnected(true);


                    // =================================
                    // JOIN MEETING ROOM
                    // =================================

    socket.emit(
    "join-call",
    {
        meetingId
    },
    (response) => {

        console.log(
            "Join response:",
            response
        );

        if (!response.success) {

            setError(
                response.message
            );

            return;
        }

        setParticipants(
            response.participants || []
        );

        setIsHost(
            response.self?.isHost || false
        );
    }
);
                });


                // =====================================
                // USER JOINED
                // =====================================

                socket.on(
                    "user-joined",
                    (participant) => {

                        if (cancelled) {
                            return;
                        }


                        console.log(
                            "User joined:",
                            participant
                        );


                        setParticipants(
                            (previous) => {

                                const alreadyExists =
                                    previous.some(
                                        (p) =>
                                            p.socketId ===
                                            participant.socketId
                                    );


                                if (alreadyExists) {
                                    return previous;
                                }


                                return [
                                    ...previous,
                                    participant
                                ];
                            }
                        );

                    }
                );


                // =====================================
                // USER LEFT
                // =====================================

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


                        setParticipants(
                            (previous) =>
                                previous.filter(
                                    (p) =>
                                        p.socketId !==
                                        socketId
                                )
                        );

                    }
                );


                // =====================================
                // CONNECTION ERROR
                // =====================================

                socket.on(
                    "connect_error",
                    (error) => {

                        console.error(
                            "Socket connection error:",
                            error
                        );


                        if (!cancelled) {

                            setConnected(false);

                            setError(
                                error.message
                            );
                        }

                    }
                );


                // =====================================
                // START CONNECTION
                // =====================================

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


        // ==========================================
        // CLEANUP
        // ==========================================

        return () => {

            cancelled = true;


            const socket =
                socketRef.current;


            if (socket) {

                socket.emit(
                    "leave-call"
                );


                socket.removeAllListeners();

                socket.disconnect();

                socketRef.current = null;
            }

        };

    }, [meetingId]);


    // =============================================
    // LEAVE MEETING
    // =============================================

   const leaveMeeting = () => {

    const socket = socketRef.current;

    if (socket) {

        socket.emit("leave-call");

        socket.disconnect();

        socketRef.current = null;
    }

    // Only guest session should be removed
    sessionStorage.removeItem("guestToken");

    navigate("/dashboard", {
        replace: true
    });
};

const endMeeting = async () => {

    try {

        setError("");

        await api.post(
            `/meeting/${meetingId}/end`
        );

        // Remove guest token if present.
        // Host normally won't have one.
        sessionStorage.removeItem(
            "guestToken"
        );

        // The backend has already emitted
        // meeting-ended, but navigate here
        // as an immediate fallback.
        navigate("/dashboard", {
            replace: true
        });

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


    // =============================================
    // ERROR
    // =============================================

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



    return (
        <div>

            <h1>Meeting</h1>

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
                            {participant.user.name}
                        </strong>

                        <span>
                            {" "}
                            ({participant.user.role})
                        </span>

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


            <button onClick={leaveMeeting}>
    Leave Meeting
</button>

{isHost && (
    <button onClick={endMeeting}>
        End Meeting
    </button>
)}

        </div>
    );
};


export default Meeting;