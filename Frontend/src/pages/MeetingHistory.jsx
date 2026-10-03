import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../services/api.js";

const MeetingHistory = () => {

    const navigate = useNavigate();

    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {

        const fetchHistory = async () => {

            try {

                const response = await api.get(
                    "/meeting/history"
                );

                setMeetings(
                    response.data.meetings
                );

            } catch (error) {

                setError(
                    error.response?.data?.message ||
                    "Failed to load history"
                );

            } finally {

                setLoading(false);
            }
        };

        fetchHistory();

    }, []);


    if (loading) {
        return <p>Loading history...</p>;
    }

    return (
        <div>

            <h1>Meeting History</h1>

            {error && <p>{error}</p>}

            {meetings.length === 0 ? (

                <p>
                    You haven't created any meetings yet.
                </p>

            ) : (

                meetings.map((meeting) => (

                    <div key={meeting._id}>

    <h3>
        {meeting.meetingId}
    </h3>

    <p>
        Started:{" "}
        {new Date(
            meeting.startTime
        ).toLocaleString()}
    </p>

    <p>
        Status:{" "}
        {meeting.isActive
            ? "Active"
            : "Ended"}
    </p>

    {meeting.endTime && (
        <p>
            Ended:{" "}
            {new Date(
                meeting.endTime
            ).toLocaleString()}
        </p>
    )}

    {meeting.isActive ? (

        <button
            onClick={() =>
                navigate(
                    `/meeting/${meeting.meetingId}`
                )
            }
        >
            Join
        </button>

    ) : (

        <span>
            Meeting ended
        </span>

    )}

</div>

                ))
            )}

        </div>
    );
};

export default MeetingHistory;