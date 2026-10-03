import {
    useEffect,
    useState
} from "react";

import {
    useNavigate
} from "react-router-dom";

import api from "../services/api.js";


const formatDate = (date) => {

    if (!date) {
        return "-";
    }

    return new Date(date).toLocaleString(
        "en-IN",
        {
            dateStyle: "medium",
            timeStyle: "short"
        }
    );
};


const formatDuration = (
    startTime,
    endTime,
    isActive
) => {

    if (!startTime) {
        return "-";
    }


    const start =
        new Date(startTime);


    const end =
        endTime
            ? new Date(endTime)
            : new Date();


    const durationMs =
        Math.max(
            0,
            end.getTime() -
            start.getTime()
        );


    const totalMinutes =
        Math.floor(
            durationMs /
            (1000 * 60)
        );


    if (
        totalMinutes < 1
    ) {
        return "< 1 min";
    }


    const hours =
        Math.floor(
            totalMinutes / 60
        );


    const minutes =
        totalMinutes % 60;


    if (hours === 0) {

        return `${minutes} min`;

    }


    if (minutes === 0) {

        return `${hours} hr`;

    }


    return `${hours} hr ${minutes} min`;

};


const History = () => {

    const navigate =
        useNavigate();


    const [meetings, setMeetings] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");


    // =====================================================
    // LOAD HISTORY
    // =====================================================

    useEffect(() => {

        let cancelled = false;


        const loadHistory =
            async () => {

                try {

                    setLoading(true);
                    setError("");


                    const response =
                        await api.get(
                            "/meeting/history"
                        );


                    if (cancelled) {
                        return;
                    }


                    setMeetings(
                        response.data.meetings ||
                        []
                    );


                } catch (error) {

                    if (cancelled) {
                        return;
                    }


                    console.error(
                        "Failed to load meeting history:",
                        error
                    );


                    if (
                        error.response
                            ?.status === 401
                    ) {

                        setError(
                            "Your session has expired. Please login again."
                        );

                    } else {

                        setError(
                            error.response
                                ?.data
                                ?.message ||
                            "Failed to load meeting history"
                        );

                    }

                } finally {

                    if (!cancelled) {
                        setLoading(false);
                    }

                }

            };


        loadHistory();


        return () => {
            cancelled = true;
        };

    }, []);


    // =====================================================
    // JOIN MEETING
    // =====================================================

    const joinMeeting = (
        meetingId
    ) => {

        navigate(
            `/meeting/${meetingId}`
        );

    };


    // =====================================================
    // UI
    // =====================================================

    if (loading) {

        return (
            <div>

                <h1>
                    Meeting History
                </h1>

                <p>
                    Loading meeting history...
                </p>

            </div>
        );

    }


    return (
        <div>

            <h1>
                Meeting History
            </h1>


            <button
                onClick={() =>
                    navigate(
                        "/dashboard"
                    )
                }
            >
                Back to Dashboard
            </button>


            <hr />


            {error && (
                <div>

                    <p>
                        {error}
                    </p>


                    <button
                        onClick={() =>
                            navigate(
                                "/login"
                            )
                        }
                    >
                        Login
                    </button>

                </div>
            )}


            {!error &&
                meetings.length === 0 && (
                    <div>

                        <h3>
                            No meetings yet
                        </h3>

                        <p>
                            Your hosted meetings
                            will appear here.
                        </p>


                        <button
                            onClick={() =>
                                navigate(
                                    "/dashboard"
                                )
                            }
                        >
                            Create a Meeting
                        </button>

                    </div>
                )}


            {!error &&
                meetings.length > 0 && (

                <div>

                    {meetings.map(
                        (meeting) => {

                            const active =
                                meeting.isActive;


                            return (
                                <div
                                    key={
                                        meeting
                                            .meetingId
                                    }
                                    style={{
                                        border:
                                            "1px solid #ccc",

                                        padding:
                                            "15px",

                                        marginBottom:
                                            "10px",

                                        width:
                                            "600px"
                                    }}
                                >

                                    <h3>
                                        {
                                            meeting
                                                .meetingId
                                        }
                                    </h3>


                                    <p>
                                        <strong>
                                            Started:
                                        </strong>

                                        {" "}

                                        {
                                            formatDate(
                                                meeting
                                                    .startTime
                                            )
                                        }
                                    </p>


                                    <p>
                                        <strong>
                                            Ended:
                                        </strong>

                                        {" "}

                                        {
                                            meeting.endTime
                                                ? formatDate(
                                                    meeting
                                                        .endTime
                                                )
                                                : "-"
                                        }
                                    </p>


                                    <p>
                                        <strong>
                                            Duration:
                                        </strong>

                                        {" "}

                                        {
                                            formatDuration(
                                                meeting
                                                    .startTime,

                                                meeting
                                                    .endTime,

                                                active
                                            )
                                        }
                                    </p>


                                    <p>
                                        <strong>
                                            Status:
                                        </strong>

                                        {" "}

                                        {active
                                            ? "🟢 Active"
                                            : "🔴 Ended"
                                        }
                                    </p>


                                    {active ? (

                                        <button
                                            onClick={() =>
                                                joinMeeting(
                                                    meeting
                                                        .meetingId
                                                )
                                            }
                                        >
                                            Rejoin Meeting
                                        </button>

                                    ) : (

                                        <button
                                            disabled
                                        >
                                            Meeting Ended
                                        </button>

                                    )}

                                </div>
                            );

                        }
                    )}

                </div>

            )}

        </div>
    );

};


export default History;