import Meeting from "../models/meeting.js";


const removeFromMeeting = async (io, socket) => {

    const meetingId = socket.data.meetingId;

    if (!meetingId) {
        return;
    }

    socket.to(meetingId).emit(
        "user-left",
        {
            socketId: socket.id
        }
    );

    await socket.leave(meetingId);

    socket.data.meetingId = null;
};

export const registerMeetingHandlers = (io, socket) => {

    // ==========================================
    // JOIN MEETING
    // ==========================================

    socket.on(
        "join-call",
        async ({ meetingId }, callback) => {

            try {

                const normalizedMeetingId =
                    meetingId?.trim().toUpperCase();


                if (!normalizedMeetingId) {

                    return callback({
                        success: false,
                        message: "Meeting ID is required"
                    });
                }


                // ==================================
                // FIND MEETING
                // ==================================

                const meeting = await Meeting.findOne({
                    meetingId: normalizedMeetingId,
                    isActive: true
                });


                if (!meeting) {

                    return callback({
                        success: false,
                        message:
                            "Meeting not found or has ended"
                    });
                }


                // ==================================
                // GUEST AUTHORIZATION
                // ==================================

                if (
                    socket.user.role === "guest" &&
                    socket.user.meetingId !==
                        normalizedMeetingId
                ) {

                    return callback({
                        success: false,
                        message:
                            "Guest is not authorized for this meeting"
                    });
                }


                // ==================================
                // IF ALREADY IN ANOTHER ROOM
                // ==================================

                const previousMeetingId =
                    socket.data.meetingId;


                if (
                    previousMeetingId &&
                    previousMeetingId !==
                        normalizedMeetingId
                ) {

                    socket
                        .to(previousMeetingId)
                        .emit("user-left", {
                            socketId: socket.id
                        });

                    socket.leave(previousMeetingId);
                }


                // ==================================
                // GET EXISTING PARTICIPANTS
                // ==================================

                const room =
                    io.sockets.adapter.rooms.get(
                        normalizedMeetingId
                    );


                const participants = [];


                if (room) {

                    for (const socketId of room) {

                        const participantSocket =
                            io.sockets.sockets.get(
                                socketId
                            );


                        if (!participantSocket) {
                            continue;
                        }


                        participants.push({

                            socketId,

                            user: {
                                id:
                                    participantSocket
                                        .user.id,

                                name:
                                    participantSocket
                                        .user.name,

                                role:
                                    participantSocket
                                        .user.role
                            }
                        });
                    }
                }


                // ==================================
                // JOIN ROOM
                // ==================================

                await socket.join(
                    normalizedMeetingId
                );


                socket.data.meetingId =
                    normalizedMeetingId;


                // ==================================
                // IS HOST?
                // ==================================

                const isHost =
                    socket.user.role === "user" &&
                    meeting.host.toString() ===
                        socket.user.id;


                // ==================================
                // ACKNOWLEDGE JOIN
                // ==================================

                callback({

                    success: true,

                    meeting: {
                        meetingId:
                            meeting.meetingId,

                        startTime:
                            meeting.startTime,

                        isActive:
                            meeting.isActive
                    },

                    self: {
                        socketId: socket.id,

                        user: socket.user,

                        isHost
                    },

                    participants

                });


                // ==================================
                // NOTIFY OTHER PARTICIPANTS
                // ==================================

                socket
                    .to(normalizedMeetingId)
                    .emit("user-joined", {

                        socketId: socket.id,

                        user: socket.user,

                        isHost

                    });


                console.log(
                    `${socket.user.name} joined ${normalizedMeetingId}`
                );


            } catch (error) {

                console.error(
                    "Join meeting error:",
                    error
                );

                callback({
                    success: false,
                    message:
                        "Failed to join meeting"
                });
            }
        }
    );


    // ==========================================
    // LEAVE MEETING
    // ==========================================

    socket.on(
    "leave-call",
    async (callback) => {

        try {

            await removeFromMeeting(
                io,
                socket
            );

            callback?.({
                success: true,
                message: "Left meeting successfully"
            });

        } catch (error) {

            console.error(
                "Leave meeting error:",
                error
            );

            callback?.({
                success: false,
                message:
                    "Failed to leave meeting"
            });
        }
    }
);


    // ==========================================
    // DISCONNECT
    // ==========================================

    socket.on("disconnect", async () => {

    try {

        await removeFromMeeting(
            io,
            socket
        );

    } catch (error) {

        console.error(
            "Disconnect cleanup error:",
            error
        );
    }
});

};