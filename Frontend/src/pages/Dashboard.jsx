import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import api from "../services/api.js";

const Dashboard = () => {

    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");


const handleCreateMeeting = async () => {
    try {
        setLoading(true);
        setError("");

       

        const response = await api.post("/meeting/create");


        const meetingId =
            response.data?.meeting?.meetingId;

        if (!meetingId) {
            throw new Error(
                "Backend did not return a meetingId"
            );
        }

        navigate(`/meeting/${meetingId}`);

    } catch (error) {

        console.error("CREATE MEETING ERROR");
        console.error("Message:", error.message);
        console.error("Status:", error.response?.status);
        console.error("Response:", error.response?.data);

        setError(
            error.response?.data?.message ||
            error.message ||
            "Failed to create meeting"
        );

    } finally {
        setLoading(false);
    }
};


    const handleJoinMeeting = () => {
        navigate("/join");
    };


    const handleHistory = () => {
        navigate("/history");
    };


    const handleLogout = () => {

        logout();

        navigate("/", {
            replace: true
        });
    };


    return (
        <div>

            <h1>
                Welcome, {user?.name}
            </h1>

            {error && (
                <p>{error}</p>
            )}

            <button
                onClick={handleCreateMeeting}
                disabled={loading}
            >
                {loading
                    ? "Creating..."
                    : "Create Meeting"}
            </button>

            <button
                onClick={handleJoinMeeting}
            >
                Join Meeting
            </button>

            <button
                onClick={handleHistory}
            >
                Meeting History
            </button>

            <button
                onClick={handleLogout}
            >
                Logout
            </button>

        </div>
    );
};

export default Dashboard;