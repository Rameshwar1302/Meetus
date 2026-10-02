import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const Home = () => {

    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    return (
        <div>

            <h1>Meetus</h1>

            <p>
                Connect. Meet. Collaborate.
            </p>

            {!isAuthenticated && (
                <>
                    <button onClick={() => navigate("/login")}>
                        Login
                    </button>

                    <button onClick={() => navigate("/register")}>
                        Sign Up
                    </button>

                    <button onClick={() => navigate("/guest")}>
                        Join as Guest
                    </button>
                </>
            )}

            {isAuthenticated && (
                <button
                    onClick={() => navigate("/dashboard")}
                >
                    Go to Dashboard
                </button>
            )}

        </div>
    );
};

export default Home;