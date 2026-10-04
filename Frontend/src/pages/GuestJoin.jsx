import { useState } from "react";
import {Link, useNavigate } from "react-router-dom";

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
        <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4">
            <Link
                to="/"
                className="mb-8 text-xl font-semibold tracking-tight text-stone-900"
            >
                Meetus
            </Link>

            <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
                <h1 className="text-2xl font-semibold text-stone-900">
                    Join as a guest
                </h1>
                <p className="mt-1 text-sm text-stone-500">
                    No account needed. Just the meeting ID and your name.
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div>
                        <label
                            htmlFor="meetingId"
                            className="mb-1.5 block text-sm font-medium text-stone-700"
                        >
                            Meeting ID
                        </label>
                        <input
                            id="meetingId"
                            value={meetingId}
                            autoComplete="off"
                            autoFocus
                            onChange={(e) => setMeetingId(e.target.value)}
                            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm uppercase tracking-wider text-stone-900 outline-none transition placeholder:normal-case placeholder:tracking-normal placeholder:text-stone-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                            placeholder="e.g. AB12CD"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="guestName"
                            className="mb-1.5 block text-sm font-medium text-stone-700"
                        >
                            Your name
                        </label>
                        <input
                            id="guestName"
                            value={name}
                            autoComplete="name"
                            onChange={(e) => setName(e.target.value)}
                            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                            placeholder="How others will see you"
                        />
                    </div>

                    {error && (
                        <p
                            role="alert"
                            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
                        >
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {loading ? "Joining..." : "Join meeting"}
                    </button>
                </form>
            </div>

            <p className="mt-6 text-sm text-stone-600">
                Have an account?{" "}
                <Link
                    to="/login"
                    className="font-medium text-blue-600 hover:underline"
                >
                    Log in
                </Link>
            </p>
        </div>
    );
};

export default GuestJoin;