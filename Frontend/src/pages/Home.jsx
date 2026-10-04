import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const features = [
    {
        title: "Share your screen",
        text: "Walk through slides or code with one click.",
    },
    {
        title: "Chat while you talk",
        text: "Drop links and notes without interrupting anyone.",
    },
    {
        title: "Past meetings, saved",
        text: "Sign in and your meeting history is there when you need it.",
    },
];

const primaryBtn =
    "rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

const secondaryBtn =
    "rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-800 transition hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

const Home = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    return (
        <div className="min-h-screen bg-stone-50 text-stone-900">
            <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
                <span className="text-xl font-semibold tracking-tight">
                    Meetus
                </span>

                <nav className="flex items-center gap-2">
                    {isAuthenticated ? (
                        <button
                            onClick={() => navigate("/dashboard")}
                            className={primaryBtn}
                        >
                            Go to Dashboard
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => navigate("/login")}
                                className="rounded-lg px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-200/60"
                            >
                                Log in
                            </button>
                            <button
                                onClick={() => navigate("/register")}
                                className={primaryBtn}
                            >
                                Sign up
                            </button>
                        </>
                    )}
                </nav>
            </header>

            <main className="mx-auto max-w-5xl px-6">
                <section className="grid items-center gap-12 py-16 md:grid-cols-2 md:py-24">
                    <div>
                        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                            Video meetings without the setup.
                        </h1>

                        <p className="mt-5 max-w-md text-lg text-stone-600">
                            Start a room, send the link, and talk. It runs in
                            the browser, and guests can join without making an
                            account.
                        </p>

                        <div className="mt-8 flex flex-wrap gap-3">
                            {isAuthenticated ? (
                                <button
                                    onClick={() => navigate("/dashboard")}
                                    className={primaryBtn}
                                >
                                    Go to Dashboard
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => navigate("/register")}
                                        className={primaryBtn}
                                    >
                                        Get started
                                    </button>
                                    <button
                                        onClick={() => navigate("/guest")}
                                        className={secondaryBtn}
                                    >
                                        Join as guest
                                    </button>
                                </>
                            )}
                        </div>

                        {!isAuthenticated && (
                            <p className="mt-4 text-sm text-stone-500">
                                Got a meeting link? Joining as a guest takes
                                about ten seconds.
                            </p>
                        )}
                    </div>

                    {/* simple call preview, pure CSS */}
                    <div
                        aria-hidden="true"
                        className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
                    >
                        <div className="grid grid-cols-2 gap-3">
                            {["A", "R", "S", "M"].map((letter, i) => (
                                <div
                                    key={letter}
                                    className={`flex aspect-video items-center justify-center rounded-xl ${
                                        [
                                            "bg-blue-100",
                                            "bg-amber-100",
                                            "bg-emerald-100",
                                            "bg-rose-100",
                                        ][i]
                                    }`}
                                >
                                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-lg font-semibold text-stone-700 shadow-sm">
                                        {letter}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 flex justify-center gap-2">
                            <span className="h-9 w-9 rounded-full bg-stone-100" />
                            <span className="h-9 w-9 rounded-full bg-stone-100" />
                            <span className="h-9 w-9 rounded-full bg-red-100" />
                        </div>
                    </div>
                </section>

                <section className="grid gap-8 border-t border-stone-200 py-14 sm:grid-cols-3">
                    {features.map((f) => (
                        <div key={f.title}>
                            <h3 className="font-semibold">{f.title}</h3>
                            <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
                                {f.text}
                            </p>
                        </div>
                    ))}
                </section>
            </main>

            <footer className="mx-auto max-w-5xl px-6 py-8 text-sm text-stone-500">
                Meetus
            </footer>
        </div>
    );
};

export default Home;