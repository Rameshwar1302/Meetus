import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

export const createSocket = () => {

    const userToken =
        localStorage.getItem("accessToken");

    const guestToken =
        localStorage.getItem("guestToken");

    const token = userToken || guestToken;

    if (!token) {
        throw new Error("No authentication token found");
    }

    return io(SOCKET_URL, {
        auth: {
            token
        }
    });
};