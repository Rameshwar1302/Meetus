export const registerChatHandlers = (io, socket) => {

    socket.on("chat-msg", (data, callback) => {

        const meetingId =
            socket.data.meetingId;

        if (!meetingId) {

            return callback?.({
                success: false,
                message:
                    "You are not in a meeting"
            });
        }


        if (
            !data ||
            typeof data.message !== "string"
        ) {

            return callback?.({
                success: false,
                message:
                    "Invalid message"
            });
        }


        const message =
            data.message.trim();


        if (!message) {

            return callback?.({
                success: false,
                message:
                    "Message cannot be empty"
            });
        }


        const chatMessage = {

            id:
                `${Date.now()}-${socket.id}`,

            sender: {
                socketId: socket.id,
                userId: socket.user.id,
                name: socket.user.name,
                role: socket.user.role
            },

            message,

            timestamp: new Date()
        };


        io.to(meetingId).emit(
            "chat-message",
            chatMessage
        );


        callback?.({
            success: true
        });

    });

};