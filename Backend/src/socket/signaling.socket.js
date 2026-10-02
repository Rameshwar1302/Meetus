export const registerSignalingHandlers = (io, socket) => {

    // =========================================
    // WEBRTC SIGNAL
    // =========================================

    socket.on("signal", ({ to, data }, callback) => {

        try {

            const meetingId = socket.data.meetingId;

            // Sender must be inside a meeting
            if (!meetingId) {
                return callback?.({
                    success: false,
                    message: "You are not in a meeting"
                });
            }

            if (!to || !data) {
                return callback?.({
                    success: false,
                    message: "Invalid signaling data"
                });
            }

            // Find target socket
            const targetSocket = io.sockets.sockets.get(to);

            if (!targetSocket) {
                return callback?.({
                    success: false,
                    message: "Target user is not connected"
                });
            }

            // -----------------------------------------
            // SECURITY:
            // Target must be in same meeting
            // -----------------------------------------

            if (targetSocket.data.meetingId !== meetingId) {
                return callback?.({
                    success: false,
                    message: "Target user is not in the same meeting"
                });
            }

            // -----------------------------------------
            // FORWARD SIGNAL
            // -----------------------------------------

            io.to(to).emit("signal", {
                from: socket.id,
                data
            });

            callback?.({
                success: true
            });

        } catch (error) {

            console.error("Signaling error:", error);

            callback?.({
                success: false,
                message: "Failed to send signaling data"
            });
        }
    });

};