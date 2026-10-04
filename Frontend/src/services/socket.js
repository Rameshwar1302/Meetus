import { io } from "socket.io-client";

export const createSocket = (token) => {

    if (!token) {
        throw new Error(
            "Authentication token not found"
        );
    }

    return io(import.meta.env.VITE_SOCKET_URL || undefined, {

        autoConnect: false,

        auth: {
            token
        }

    });
};