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
        <div className="min-h-screen bg-stone-50 text-stone-900">
            <header className="border-b border-stone-200 bg-white">
                <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
                    <span className="text-xl font-semibold tracking-tight">
                        Meetus
                    </span>

                    <div className="flex items-center gap-4">
                        <span className="hidden text-sm text-stone-600 sm:block">
                            {user?.name}
                        </span>
                        <button
                            onClick={handleLogout}
                            className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
                        >
                            Log out
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-5xl px-6 py-12">
                <h1 className="text-3xl font-semibold tracking-tight">
                    Hi, {user?.name}
                </h1>
                <p className="mt-1 text-stone-600">
                    What would you like to do?
                </p>

                {error && (
                    <p
                        role="alert"
                        className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
                    >
                        {error}
                    </p>
                )}

                <div className="mt-8 grid gap-4 md:grid-cols-3">
                    <button
                        onClick={handleCreateMeeting}
                        disabled={loading}
                        className="rounded-2xl bg-blue-600 p-6 text-left text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        <span className="block text-lg font-semibold">
                            {loading ? "Setting up your room..." : "New meeting"}
                        </span>
                        <span className="mt-1 block text-sm text-blue-100">
                            Start a room and share the link.
                        </span>
                    </button>

                    <button
                        onClick={handleJoinMeeting}
                        className="rounded-2xl border border-stone-200 bg-white p-6 text-left transition hover:border-stone-300 hover:shadow-sm"
                    >
                        <span className="block text-lg font-semibold">
                            Join a meeting
                        </span>
                        <span className="mt-1 block text-sm text-stone-600">
                            Have a meeting ID? Enter it here.
                        </span>
                    </button>

                    <button
                        onClick={handleHistory}
                        className="rounded-2xl border border-stone-200 bg-white p-6 text-left transition hover:border-stone-300 hover:shadow-sm"
                    >
                        <span className="block text-lg font-semibold">
                            Meeting history
                        </span>
                        <span className="mt-1 block text-sm text-stone-600">
                            See the meetings you've been in.
                        </span>
                    </button>
                </div>
            </main>
        </div>
    );
};

export default Dashboard;