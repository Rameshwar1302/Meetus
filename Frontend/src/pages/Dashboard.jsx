import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import api from "../services/api.js";

const Dashboard = () => {

    const { user, logout } = useAuth();
    const navigate = useNavigate();


    const handleCreateMeeting = async () => {

    try {

        setLoading(true);
        setError("");

        const response = await api.post(
            "/meeting/create"
        );

        const meetingId =
            response.data.meeting.meetingId;

        navigate(`/meeting/${meetingId}`);

    } catch (error) {

        setError(
            error.response?.data?.message ||
            "Failed to create meeting"
        );

    } finally {

        setLoading(false);
    }
};


    return (
        <div>

            <h1>Welcome, {user?.name}</h1>

            <button
                onClick={() => navigate("/meeting/new")}
            >
                Create Meeting
            </button>

            <button
                onClick={() => navigate("/join")}
            >
                Join Meeting
            </button>

            <button
                onClick={() => navigate("/history")}
            >
                Meeting History
            </button>

            <button
                onClick={() => {
                    logout();
                    navigate("/");
                }}
            >
                Logout
            </button>

        </div>
    );
};
export default Dashboard;