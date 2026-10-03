import { io } from "socket.io-client";


const SOCKET_URL =
    import.meta.env.VITE_SOCKET_URL;


export const createSocket = (token) => {

    if (!token) {
        throw new Error(
            "Authentication token not found"
        );
    }


    return io(SOCKET_URL, {

        autoConnect: false,

        auth: {
            token
        }

    });
};