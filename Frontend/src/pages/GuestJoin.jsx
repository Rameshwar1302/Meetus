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

        setError("");

        const id = meetingId.trim().toUpperCase();
        const guestName = name.trim();

        if (!id || !guestName) {
            setError(
                "Meeting ID and name are required"
            );
            return;
        }

        try {

            setLoading(true);

            const response = await api.post(
                `/meeting/${id}/guest-token`,
                {
                    name: guestName
                }
            );

            const token = response.data.token;

            localStorage.setItem(
                "guestToken",
                token
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
                    type="text"
                    placeholder="Meeting ID"
                    value={meetingId}
                    onChange={(e) =>
                        setMeetingId(e.target.value)
                    }
                />

                <input
                    type="text"
                    placeholder="Your name"
                    value={name}
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