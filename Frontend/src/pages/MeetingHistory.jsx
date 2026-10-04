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

const Page = ({ onBack, children }) => (
    <div className="min-h-screen bg-stone-50 text-stone-900">
        <header className="border-b border-stone-200 bg-white">
            <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
                <span className="text-xl font-semibold tracking-tight">
                    Meetus
                </span>
                <button
                    onClick={onBack}
                    className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
                >
                    Back to dashboard
                </button>
            </div>
        </header>

        <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </div>
);


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

      const goBack = () => navigate("/dashboard");

    if (loading) {
        return (
            <Page onBack={goBack}>
                <h1 className="text-3xl font-semibold tracking-tight">
                    Meeting history
                </h1>

                <div className="mt-8 space-y-3" aria-busy="true">
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className="h-24 animate-pulse rounded-xl border border-stone-200 bg-white"
                        />
                    ))}
                </div>
            </Page>
        );
    }

    return (
        <Page onBack={goBack}>
            <h1 className="text-3xl font-semibold tracking-tight">
                Meeting history
            </h1>
            <p className="mt-1 text-stone-600">
                Meetings you've hosted or joined while signed in.
            </p>

            {error && (
                <div
                    role="alert"
                    className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3"
                >
                    <p className="text-sm text-red-700">{error}</p>
                    <button
                        onClick={() => navigate("/login")}
                        className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-red-700 ring-1 ring-red-200 transition hover:bg-red-100"
                    >
                        Log in
                    </button>
                </div>
            )}

            {!error && meetings.length === 0 && (
                <div className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
                    <h2 className="text-lg font-semibold">No meetings yet</h2>
                    <p className="mx-auto mt-1 max-w-xs text-sm text-stone-600">
                        Once you start a meeting, it will show up here.
                    </p>
                    <button
                        onClick={goBack}
                        className="mt-5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
                    >
                        Start a meeting
                    </button>
                </div>
            )}

            {!error && meetings.length > 0 && (
                <ul className="mt-8 space-y-3">
                    {meetings.map((meeting) => {
                        const active = meeting.isActive;

                        return (
                            <li
                                key={meeting.meetingId}
                                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-5 transition hover:border-stone-300"
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono text-base font-semibold tracking-wider">
                                            {meeting.meetingId}
                                        </span>

                                        {active ? (
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                Live
                                            </span>
                                        ) : (
                                            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
                                                Ended
                                            </span>
                                        )}
                                    </div>

                                    <p className="mt-1.5 text-sm text-stone-600">
                                        {formatDate(meeting.startTime)}
                                        <span className="mx-2 text-stone-300">
                                            •
                                        </span>
                                        {formatDuration(
                                            meeting.startTime,
                                            meeting.endTime,
                                            active
                                        )}
                                    </p>

                                    {meeting.endTime && (
                                        <p className="mt-0.5 text-xs text-stone-500">
                                            Ended {formatDate(meeting.endTime)}
                                        </p>
                                    )}
                                </div>

                                {active && (
                                    <button
                                        onClick={() =>
                                            joinMeeting(meeting.meetingId)
                                        }
                                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                                    >
                                        Rejoin
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </Page>
    );
};

export default History;

