import { useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../services/api.js";

const GuestJoin = () => {

    const navigate = useNavigate();

    const [meetingId, setMeetingId] = useState("");
    const [name, setName] = useState("");

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);


    const handleSubmit = async (e) => {

        e.preventDefault();

        const id = meetingId
            .trim()
            .toUpperCase();

        const guestName = name.trim();

        if (!id || !guestName) {
            setError(
                "Meeting ID and name are required"
            );
            return;
        }

        try {

            setLoading(true);
            setError("");

            const response = await api.post(
                `/meeting/${id}/guest-token`,
                {
                    name: guestName
                }
            );

            sessionStorage.setItem(
                "guestToken",
                response.data.token
            );

            navigate(`/meeting/${id}`);

        } catch (error) {

            setError(
                error.response?.data?.message ||
                "Unable to join meeting"
            );

        } finally {

            setLoading(false);
        }
    };


    return (
        <div>

            <h1>Join as Guest</h1>

            <form onSubmit={handleSubmit}>

                <input
                    value={meetingId}
                    placeholder="Meeting ID"
                    onChange={(e) =>
                        setMeetingId(e.target.value)
                    }
                />

                <input
                    value={name}
                    placeholder="Your name"
                    onChange={(e) =>
                        setName(e.target.value)
                    }
                />

                {error && <p>{error}</p>}

                <button
                    type="submit"
                    disabled={loading}
                >
                    {loading
                        ? "Joining..."
                        : "Join Meeting"}
                </button>

            </form>

        </div>
    );
};

export default GuestJoin;