import Meeting from "./models/meeting.js";

export const registerMeetingHandlers = (io, socket) => {

    socket.on("join-call", async ({ meetingId }, callback) => {

        try {

            const meeting = await Meeting.findOne({
                meetingId,
                isActive: true
            });

            if (!meeting) {
                return callback({
                    success: false,
                    message: "Meeting not found"
                });
            }

            // Authenticated-only meeting
            if (
                meeting.accessMode === "authenticated" &&
                socket.user.role !== "user"
            ) {
                return callback({
                    success: false,
                    message: "Login required"
                });
            }

            socket.join(meetingId);

            callback({
                success: true,
                meetingId
            });

            socket.to(meetingId).emit(
                "user-joined",
                {
                    socketId: socket.id,
                    user: {
                        id: socket.user.sub,
                        name: socket.user.name,
                        role: socket.user.role
                    }
                }
            );

        } catch (error) {

            console.error(error);

            callback({
                success: false,
                message: "Failed to join meeting"
            });
        }

    });

};