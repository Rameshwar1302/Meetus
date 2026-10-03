import Meeting from "../models/meeting.js";


// =====================================================
// DEFAULT MEDIA STATE
// =====================================================

const defaultMediaState = {
    muted: false,
    cameraOff: false,
    screenSharing: false
};


// =====================================================
// REMOVE SOCKET FROM CURRENT MEETING
// =====================================================

const removeFromMeeting = async (io, socket) => {

    const meetingId =
        socket.data.meetingId;

    if (!meetingId) {
        return;
    }


    // Tell everyone else that this participant left.
    socket
        .to(meetingId)
        .emit(
            "user-left",
            {
                socketId: socket.id
            }
        );


    await socket.leave(
        meetingId
    );


    socket.data.meetingId =
        null;

    socket.data.mediaState =
        null;
};


// =====================================================
// REGISTER MEETING SOCKET HANDLERS
// =====================================================

export const registerMeetingHandlers = (
    io,
    socket
) => {

    // =================================================
    // JOIN MEETING
    // =================================================

    socket.on(
        "join-call",
        async (
            { meetingId },
            callback
        ) => {

            try {

                // ======================================
                // VALIDATE MEETING ID
                // ======================================

                const normalizedMeetingId =
                    meetingId
                        ?.trim()
                        .toUpperCase();


                if (!normalizedMeetingId) {

                    return callback({
                        success: false,
                        message:
                            "Meeting ID is required"
                    });

                }


                // ======================================
                // FIND ACTIVE MEETING
                // ======================================

                const meeting =
                    await Meeting.findOne({
                        meetingId:
                            normalizedMeetingId,

                        isActive:
                            true
                    });


                if (!meeting) {

                    return callback({
                        success: false,
                        message:
                            "Meeting not found or has ended"
                    });

                }


                // ======================================
                // GUEST AUTHORIZATION
                // ======================================

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


                // ======================================
                // LEAVE PREVIOUS MEETING
                // ======================================

                const previousMeetingId =
                    socket.data.meetingId;


                if (
                    previousMeetingId &&
                    previousMeetingId !==
                        normalizedMeetingId
                ) {

                    socket
                        .to(previousMeetingId)
                        .emit(
                            "user-left",
                            {
                                socketId:
                                    socket.id
                            }
                        );


                    await socket.leave(
                        previousMeetingId
                    );

                }


                // ======================================
                // GET EXISTING PARTICIPANTS
                // ======================================

                const room =
                    io.sockets.adapter.rooms.get(
                        normalizedMeetingId
                    );


                const participants = [];


                if (room) {

                    for (
                        const socketId
                        of room
                    ) {

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
                                        .user
                                        .id,

                                name:
                                    participantSocket
                                        .user
                                        .name,

                                role:
                                    participantSocket
                                        .user
                                        .role
                            },

                            mediaState:
                                participantSocket
                                    .data
                                    .mediaState ||
                                {
                                    ...defaultMediaState
                                }

                        });

                    }

                }


                // ======================================
                // JOIN ROOM
                // ======================================

                await socket.join(
                    normalizedMeetingId
                );


                socket.data.meetingId =
                    normalizedMeetingId;


                // Every newly joined socket starts
                // with default media state.

                socket.data.mediaState = {
                    ...defaultMediaState
                };


                // ======================================
                // CHECK HOST
                // ======================================

                const isHost =
                    socket.user.role === "user" &&
                    meeting.host.toString() ===
                        socket.user.id;


                // ======================================
                // SEND JOIN RESPONSE
                // ======================================

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

                        socketId:
                            socket.id,

                        user:
                            socket.user,

                        isHost

                    },

                    participants

                });


                // ======================================
                // NOTIFY OTHER PARTICIPANTS
                // ======================================

                socket
                    .to(normalizedMeetingId)
                    .emit(
                        "user-joined",
                        {

                            socketId:
                                socket.id,

                            user:
                                socket.user,

                            isHost,

                            mediaState:
                                socket
                                    .data
                                    .mediaState

                        }
                    );


                console.log(
                    `${socket.user.name} joined ${normalizedMeetingId}`
                );

            } catch (error) {

                console.error(
                    "Join meeting error:",
                    error
                );


                callback?.({

                    success: false,

                    message:
                        "Failed to join meeting"

                });

            }

        }
    );


    // =================================================
    // LEAVE MEETING
    // =================================================

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

                    message:
                        "Left meeting successfully"

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


    // =================================================
    // MEDIA STATE
    // =================================================

    socket.on(
        "media-state",
        ({
            meetingId,
            muted,
            cameraOff,
            screenSharing
        }) => {

            if (!meetingId) {
                return;
            }


            // Make sure this socket actually
            // belongs to that meeting.

            if (
                socket.data.meetingId !==
                meetingId
            ) {
                return;
            }


            const mediaState = {

                muted:
                    Boolean(muted),

                cameraOff:
                    Boolean(cameraOff),

                screenSharing:
                    Boolean(screenSharing)

            };


            // Store latest state on socket.

            socket.data.mediaState =
                mediaState;


            // Broadcast to everyone else.

            socket
                .to(meetingId)
                .emit(
                    "media-state",
                    {

                        socketId:
                            socket.id,

                        ...mediaState

                    }
                );

        }
    );


    // =================================================
    // DISCONNECT
    // =================================================

    socket.on(
        "disconnect",
        async () => {

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

        }
    );

};