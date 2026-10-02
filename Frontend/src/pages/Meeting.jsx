import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import api from "../services/api.js";
import { createSocket } from "../services/socket.js";

const Meeting = () => {

    const { meetingId } = useParams();
    const navigate = useNavigate();

    const [meeting, setMeeting] = useState(null);
    const [participants, setParticipants] = useState([]);

    const [error, setError] = useState("");
    const [connected, setConnected] = useState(false);


    useEffect(() => {

        let socket;

        const joinMeeting = async () => {

            try {

                // --------------------------------
                // Verify meeting exists
                // --------------------------------

                const response = await api.get(
                    `/meeting/${meetingId}`
                );

                setMeeting(response.data.meeting);


                // --------------------------------
                // Create Socket.IO connection
                // --------------------------------

                socket = createSocket();


                socket.on("connect", () => {

                    console.log(
                        "Socket connected:",
                        socket.id
                    );

                    setConnected(true);


                    // --------------------------------
                    // Join meeting room
                    // --------------------------------

                    socket.emit(
                        "join-call",
                        {
                            meetingId
                        },
                        (response) => {

                            if (!response.success) {

                                setError(
                                    response.message
                                );

                                return;
                            }

                            console.log(
                                "Joined meeting:",
                                response
                            );

                            setParticipants(
                                response.participants
                            );
                        }
                    );
                });


                // --------------------------------
                // New participant
                // --------------------------------

                socket.on(
                    "user-joined",
                    (participant) => {

                        setParticipants(
                            (prev) => [
                                ...prev,
                                participant
                            ]
                        );
                    }
                );


                // --------------------------------
                // Participant left
                // --------------------------------

                socket.on(
                    "user-left",
                    ({ socketId }) => {

                        setParticipants(
                            (prev) =>
                                prev.filter(
                                    (p) =>
                                        p.socketId !== socketId
                                )
                        );
                    }
                );


                socket.on(
                    "connect_error",
                    (error) => {

                        console.error(
                            "Socket error:",
                            error
                        );

                        setError(
                            error.message
                        );
                    }
                );

            } catch (error) {

                console.error(error);

                setError(
                    error.response?.data?.message ||
                    "Unable to join meeting"
                );
            }
        };


        joinMeeting();


        return () => {

            if (socket) {

                socket.emit(
                    "leave-call"
                );

                socket.disconnect();
            }
        };

    }, [meetingId]);


    const leaveMeeting = () => {

        navigate("/dashboard");
    };


    if (error) {

        return (
            <div>
                <h2>Unable to join meeting</h2>
                <p>{error}</p>

                <button
                    onClick={() => navigate("/")}
                >
                    Go Home
                </button>
            </div>
        );
    }


    return (
        <div>

            <h1>
                Meeting: {meetingId}
            </h1>

            <p>
                Status:{" "}
                {connected
                    ? "Connected"
                    : "Connecting..."}
            </p>


            <h2>
                Participants
            </h2>

            {participants.length === 0 && (
                <p>
                    No other participants yet.
                </p>
            )}


            {participants.map((participant) => (

                <div key={participant.socketId}>

                    <strong>
                        {participant.user.name}
                    </strong>

                    <span>
                        {" "}({participant.user.role})
                    </span>

                </div>

            ))}


            <button onClick={leaveMeeting}>
                Leave Meeting
            </button>

        </div>
    );
};

export default Meeting;