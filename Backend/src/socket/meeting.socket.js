import Meeting from "../Models/meeting.js";

export const registerMeetingHandlers = (io, socket) => {

    // =========================================
    // JOIN MEETING
    // =========================================

    socket.on("join-call", async ({ meetingId }, callback) => {

        try {
            if (!meetingId) {
                return callback({
                    success: false,
                    message: "Meeting ID is required"
                });
            }

            // Find active meeting
            const meeting = await Meeting.findOne({
                meetingId,
                isActive: true
            });

            if (!meeting) {
                return callback({
                    success: false,
                    message: "Meeting not found or inactive"
                });
            }

            // -----------------------------------------
            // AUTHORIZATION
            // -----------------------------------------

            // Authenticated-only meeting
            if (
                meeting.accessMode === "authenticated" &&
                socket.user.role !== "user"
            ) {
                return callback({
                    success: false,
                    message: "This meeting requires login"
                });
            }

            // Guest token can only join its own meeting
            if (
                socket.user.role === "guest" &&
                socket.user.meetingId !== meetingId
            ) {
                return callback({
                    success: false,
                    message: "Guest token is not valid for this meeting"
                });
            }

            // -----------------------------------------
            // ALREADY IN A MEETING?
            // -----------------------------------------

            const previousMeeting = socket.data.meetingId;

            if (previousMeeting && previousMeeting !== meetingId) {
                socket.to(previousMeeting).emit("user-left", {
                    socketId: socket.id
                });

                socket.leave(previousMeeting);
            }

            // Store current meeting on socket
            socket.data.meetingId = meetingId;

            // -----------------------------------------
            // GET EXISTING PARTICIPANTS
            // -----------------------------------------

            const room = io.sockets.adapter.rooms.get(meetingId);

            const existingParticipants = [];

            if (room) {
                for (const socketId of room) {

                    const participantSocket =
                        io.sockets.sockets.get(socketId);

                    if (!participantSocket) continue;

                    existingParticipants.push({
                        socketId,
                        user: {
                            id: participantSocket.user.sub,
                            name: participantSocket.user.name,
                            role: participantSocket.user.role
                        }
                    });
                }
            }

            // -----------------------------------------
            // JOIN ROOM
            // -----------------------------------------

            await socket.join(meetingId);

            // -----------------------------------------
            // ACKNOWLEDGEMENT TO JOINING USER
            // -----------------------------------------

            callback({
                success: true,
                meeting: {
                    meetingId: meeting.meetingId,
                    accessMode: meeting.accessMode
                },
                self: {
                    socketId: socket.id,
                    user: {
                        id: socket.user.sub,
                        name: socket.user.name,
                        role: socket.user.role
                    }
                },
                participants: existingParticipants
            });

            // -----------------------------------------
            // NOTIFY EXISTING USERS
            // -----------------------------------------

            socket.to(meetingId).emit("user-joined", {
                socketId: socket.id,
                user: {
                    id: socket.user.sub,
                    name: socket.user.name,
                    role: socket.user.role
                }
            });

            console.log(
                `${socket.user.name} (${socket.id}) joined ${meetingId}`
            );

        } catch (error) {

            console.error("Join meeting error:", error);

            callback({
                success: false,
                message: "Failed to join meeting"
            });
        }
    });


    // =========================================
    // LEAVE MEETING
    // =========================================

    socket.on("leave-call", async (callback) => {

        try {

            const meetingId = socket.data.meetingId;

            if (!meetingId) {
                return callback?.({
                    success: false,
                    message: "User is not in a meeting"
                });
            }

            socket.to(meetingId).emit("user-left", {
                socketId: socket.id
            });

            await socket.leave(meetingId);

            socket.data.meetingId = null;

            callback?.({
                success: true,
                message: "Left meeting successfully"
            });

            console.log(
                `${socket.user.name} (${socket.id}) left ${meetingId}`
            );

        } catch (error) {

            console.error("Leave meeting error:", error);

            callback?.({
                success: false,
                message: "Failed to leave meeting"
            });
        }
    });


    // =========================================
    // DISCONNECT
    // =========================================

    socket.on("disconnect", () => {

        const meetingId = socket.data.meetingId;

        if (!meetingId) {
            return;
        }

        socket.to(meetingId).emit("user-left", {
            socketId: socket.id
        });

        console.log(
            `${socket.user.name} (${socket.id}) disconnected from ${meetingId}`
        );

        socket.data.meetingId = null;
    });

};