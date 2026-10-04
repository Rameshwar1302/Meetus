import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const Login = () => {

    const navigate = useNavigate();

    const { login } = useAuth();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);


    const handleSubmit = async (e) => {

        e.preventDefault();

        setError("");
        setLoading(true);

        try {

            await login(username, password);

            navigate("/dashboard");

        } catch (error) {

            setError(
                error.response?.data?.message ||
                "Login failed"
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
                    Welcome back
                </h1>
                <p className="mt-1 text-sm text-stone-500">
                    Log in to start or join a meeting.
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div>
                        <label
                            htmlFor="username"
                            className="mb-1.5 block text-sm font-medium text-stone-700"
                        >
                            Username
                        </label>
                        <input
                            id="username"
                            type="text"
                            autoComplete="username"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="password"
                            className="mb-1.5 block text-sm font-medium text-stone-700"
                        >
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
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
                        {loading ? "Logging in..." : "Log in"}
                    </button>
                </form>
            </div>

            <p className="mt-6 text-sm text-stone-600">
                New here?{" "}
                <Link
                    to="/register"
                    className="font-medium text-blue-600 hover:underline"
                >
                    Create an account
                </Link>
            </p>

            <Link
                to="/guest"
                className="mt-2 text-sm text-stone-500 hover:text-stone-700"
            >
                Or join a meeting as a guest
            </Link>
        </div>
    );
};

export default Login;