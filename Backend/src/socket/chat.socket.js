export const registerChatHandlers = (io, socket) => {

    // =========================================
    // SEND CHAT MESSAGE
    // =========================================

    socket.on("chat-msg", (data, callback) => {

        try {

            const meetingId = socket.data.meetingId;

            if (!meetingId) {
                return callback?.({
                    success: false,
                    message: "You are not in a meeting"
                });
            }

            if (!data || typeof data.message !== "string") {
                return callback?.({
                    success: false,
                    message: "Invalid message"
                });
            }

            const message = data.message.trim();

            if (!message) {
                return callback?.({
                    success: false,
                    message: "Message cannot be empty"
                });
            }

            if (message.length > 1000) {
                return callback?.({
                    success: false,
                    message: "Message is too long"
                });
            }

            const chatMessage = {
                id: `${Date.now()}-${socket.id}`,
                sender: {
                    socketId: socket.id,
                    userId: socket.user.sub,
                    name: socket.user.name,
                    role: socket.user.role
                },
                message,
                timestamp: new Date()
            };

            // Send to everyone in the meeting
            io.to(meetingId).emit(
                "chat-message",
                chatMessage
            );

            callback?.({
                success: true
            });

        } catch (error) {

            console.error("Chat error:", error);

            callback?.({
                success: false,
                message: "Failed to send message"
            });
        }
    });

};