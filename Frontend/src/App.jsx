import {BrowserRouter, Routes, Route, Navigate} from "react-router-dom";
import './app.css';
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import GuestJoin from "./pages/GuestJoin.jsx";
import JoinMeeting from "./pages/JoinMeeting.jsx";
import Meeting from "./pages/Meeting.jsx";
import MeetingHistory from "./pages/MeetingHistory.jsx";

import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";


const App = () => {

    return (
        <BrowserRouter>

            <AuthProvider>

                <Routes>

                    {/* PUBLIC */}

                    <Route
                        path="/"
                        element={<Home />}
                    />

                    <Route
                        path="/login"
                        element={<Login />}
                    />

                    <Route
                        path="/register"
                        element={<Register />}
                    />

                    <Route
                        path="/guest"
                        element={<GuestJoin />}
                    />

                   <Route
                       path="/meeting/:meetingId"
                       element={<Meeting />}
                   />


                    {/* PROTECTED */}

                    <Route element={<ProtectedRoute />}>

                        <Route
                            path="/dashboard"
                            element={<Dashboard />}
                        />

                         <Route
                            path="/join"
                            element={<JoinMeeting />}
                        />

                        <Route
                            path="/history"
                            element={<MeetingHistory />}
                        /> 

                    </Route>


                    {/* MEETING */}

                    <Route
                        path="/meeting/:meetingId"
                        element={<Meeting />}
                    />


                    {/* FALLBACK */}

                    <Route
                        path="*"
                        element={<Navigate to="/" replace />}
                    />

                </Routes>

            </AuthProvider>

        </BrowserRouter>
    );
};

export default App;