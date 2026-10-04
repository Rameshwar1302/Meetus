import { useState } from "react";
import {Link, useNavigate } from "react-router-dom";

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
        <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4">
            <div className="w-full max-w-sm">
                <Link
                    to="/dashboard"
                    className="mb-4 inline-block text-sm text-stone-500 hover:text-stone-800"
                >
                    ← Back to dashboard
                </Link>

                <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
                    <h1 className="text-2xl font-semibold text-stone-900">
                        Join a meeting
                    </h1>
                    <p className="mt-1 text-sm text-stone-500">
                        Enter the ID the host shared with you.
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
                                onChange={(e) => {
                                    setMeetingId(e.target.value);
                                    setError("");
                                }}
                                className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm uppercase tracking-wider text-stone-900 outline-none transition placeholder:normal-case placeholder:tracking-normal placeholder:text-stone-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                                placeholder="e.g. AB12CD"
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
                            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
                        >
                            Join
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default JoinMeeting;