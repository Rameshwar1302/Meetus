import { Server } from "socket.io";


export const connectSocket = async (server) => {
    const io = new Server(server);
    return io;
};