import { useState } from "react";
import { useNavigate } from "react-router-dom";

const JoinMeeting = () => {

    const navigate = useNavigate();

    const [meetingId, setMeetingId] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = (e) => {

        e.preventDefault();

        const id = meetingId
            .trim()
            .toUpperCase();

        if (!id) {
            setError("Meeting ID is required");
            return;
        }

        navigate(`/meeting/${id}`);
    };

    return (
        <div>

            <h1>Join Meeting</h1>

            <form onSubmit={handleSubmit}>

                <input
                    value={meetingId}
                    placeholder="Meeting ID"
                    onChange={(e) =>
                        setMeetingId(e.target.value)
                    }
                />

                {error && <p>{error}</p>}

                <button type="submit">
                    Join
                </button>

            </form>

        </div>
    );
};

export default JoinMeeting;