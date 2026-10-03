import {
    createContext,
    useContext,
    useEffect,
    useState
} from "react";

import api from "../services/api.js";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {

    const [user, setUser] = useState(null);

    // Very important:
    // initially we don't know whether the user is logged in
    const [loading, setLoading] = useState(true);


    // ==========================================
    // RESTORE LOGIN SESSION
    // ==========================================

    useEffect(() => {

        const restoreSession = async () => {

            const token = localStorage.getItem("accessToken");

            // No token → definitely logged out
            if (!token) {
                setUser(null);
                setLoading(false);
                return;
            }

            try {

                // Ask backend who owns this token
                const response = await api.get("/auth/me");

                setUser(response.data.user);

            } catch (error) {

                console.error(
                    "Failed to restore session:",
                    error
                );

                // Token invalid/expired
                localStorage.removeItem("accessToken");

                setUser(null);

            } finally {

                setLoading(false);
            }
        };


        restoreSession();

    }, []);


    // ==========================================
    // LOGIN
    // ==========================================

    const login = async (username, password) => {

        const response = await api.post(
            "/auth/login",
            {
                username,
                password
            }
        );

        const { token, user } = response.data;

        // Persist token
        localStorage.setItem(
            "accessToken",
            token
        );

        // Update React state
        setUser(user);

        return response.data;
    };


    // ==========================================
    // REGISTER
    // ==========================================

    const register = async (
        name,
        username,
        password
    ) => {

        return await api.post(
            "/auth/register",
            {
                name,
                username,
                password
            }
        );
    };


    // ==========================================
    // LOGOUT
    // ==========================================

   const logout = () => {

    localStorage.removeItem("accessToken");
    sessionStorage.removeItem("guestToken");

    setUser(null);
};


    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                login,
                register,
                logout,
                isAuthenticated: Boolean(user)
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};


export const useAuth = () => {

    const context = useContext(AuthContext);

    if (!context) {
        throw new Error(
            "useAuth must be used inside AuthProvider"
        );
    }

    return context;
};