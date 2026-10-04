import crypto from "node:crypto";
import Meeting from "../models/meeting.js";

const defaultMediaState = {
    muted: false,
    cameraOff: false,
    screenSharing: false
};

// requestId -> pending request
const pendingJoinRequests = new Map();

// meetingId -> Set(identityKey)
const admittedParticipants = new Map();

// identityKey -> timeout
const admissionTimers = new Map();

const ADMISSION_RECONNECT_GRACE =
    5 * 60 * 1000;


const getIdentityKey = (socket) => {
    return `${socket.user.role}:${socket.user.id}`;
};


const getMeetingAdmissionSet = (
    meetingId
) => {

    if (
        !admittedParticipants.has(
            meetingId
        )
    ) {
        admittedParticipants.set(
            meetingId,
            new Set()
        );
    }

    return admittedParticipants.get(
        meetingId
    );
};


const clearAdmissionTimer = (
    meetingId,
    identityKey
) => {

    const timerKey =
        `${meetingId}:${identityKey}`;

    const timer =
        admissionTimers.get(timerKey);

    if (timer) {
        clearTimeout(timer);
        admissionTimers.delete(
            timerKey
        );
    }
};


const scheduleAdmissionExpiry = (
    meetingId,
    identityKey
) => {

    clearAdmissionTimer(
        meetingId,
        identityKey
    );

    const timerKey =
        `${meetingId}:${identityKey}`;

    const timer = setTimeout(
        () => {

            const admitted =
                admittedParticipants.get(
                    meetingId
                );

            admitted?.delete(
                identityKey
            );

            admissionTimers.delete(
                timerKey
            );

            if (
                admitted &&
                admitted.size === 0
            ) {
                admittedParticipants.delete(
                    meetingId
                );
            }

        },
        ADMISSION_RECONNECT_GRACE
    );

    admissionTimers.set(
        timerKey,
        timer
    );
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

    socket.on(
    "request-to-join",
    async (
        { meetingId },
        callback
    ) => {

        try {

            const normalizedMeetingId =
                meetingId
                    ?.trim()
                    .toUpperCase();

            if (!normalizedMeetingId) {

                return callback?.({
                    success: false,
                    message:
                        "Meeting ID is required"
                });

            }


            const meeting =
                await Meeting.findOne({
                    meetingId:
                        normalizedMeetingId,
                    isActive: true
                });


            if (!meeting) {

                return callback?.({
                    success: false,
                    message:
                        "Meeting not found or has ended"
                });

            }


            // Guest can only request access
            // to the meeting encoded in guest JWT.

            if (
                socket.user.role === "guest" &&
                socket.user.meetingId !==
                    normalizedMeetingId
            ) {

                return callback?.({
                    success: false,
                    message:
                        "Guest is not authorized for this meeting"
                });

            }


            const identityKey =
                getIdentityKey(socket);


            const isHost =
                socket.user.role === "user" &&
                meeting.host.toString() ===
                    socket.user.id;


            const admitted =
                getMeetingAdmissionSet(
                    normalizedMeetingId
                );


            // =========================================
            // HOST = AUTOMATICALLY APPROVED
            // =========================================

            if (isHost) {

                admitted.add(
                    identityKey
                );

                clearAdmissionTimer(
                    normalizedMeetingId,
                    identityKey
                );

                socket.data.admissionMeetingId =
                    normalizedMeetingId;


                return callback?.({
                    success: true,
                    status: "approved",
                    isHost: true
                });

            }


            // =========================================
            // PREVIOUSLY ADMITTED USER
            // =========================================

            if (
                admitted.has(
                    identityKey
                )
            ) {

                clearAdmissionTimer(
                    normalizedMeetingId,
                    identityKey
                );

                socket.data.admissionMeetingId =
                    normalizedMeetingId;


                return callback?.({
                    success: true,
                    status: "approved",
                    isHost: false
                });

            }


            // =========================================
            // FIND HOST SOCKET
            // =========================================

            const room =
                io.sockets.adapter.rooms.get(
                    normalizedMeetingId
                );


            let hostSocket = null;


            if (room) {

                for (
                    const socketId
                    of room
                ) {

                    const participantSocket =
                        io.sockets.sockets.get(
                            socketId
                        );


                    if (
                        participantSocket &&
                        participantSocket.user
                            .role === "user" &&
                        participantSocket.user
                            .id ===
                            meeting.host.toString()
                    ) {

                        hostSocket =
                            participantSocket;

                        break;

                    }

                }

            }


            if (!hostSocket) {

                return callback?.({
                    success: false,
                    message:
                        "Host is not currently in the meeting"
                });

            }


            // =========================================
            // PREVENT DUPLICATE REQUEST
            // =========================================

            for (
                const [
                    requestId,
                    request
                ]
                of pendingJoinRequests
            ) {

                if (
                    request.socketId ===
                        socket.id &&
                    request.meetingId ===
                        normalizedMeetingId
                ) {

                    return callback?.({
                        success: true,
                        status: "pending",
                        requestId
                    });

                }

            }


            // =========================================
            // CREATE REQUEST
            // =========================================

            const requestId =
                crypto.randomUUID();


            pendingJoinRequests.set(
                requestId,
                {
                    requestId,
                    socketId:
                        socket.id,
                    hostSocketId:
                        hostSocket.id,
                    meetingId:
                        normalizedMeetingId,
                    identityKey,
                    user: {
                        id:
                            socket.user.id,
                        name:
                            socket.user.name,
                        role:
                            socket.user.role
                    },
                    createdAt:
                        new Date()
                }
            );


            socket.data.pendingRequestId =
                requestId;


            hostSocket.emit(
                "join-request",
                {
                    requestId,

                    meetingId:
                        normalizedMeetingId,

                    user: {
                        id:
                            socket.user.id,
                        name:
                            socket.user.name,
                        role:
                            socket.user.role
                    }
                }
            );


            callback?.({
                success: true,
                status: "pending",
                requestId
            });

        } catch (error) {

            console.error(
                "Join request error:",
                error
            );


            callback?.({
                success: false,
                message:
                    "Failed to request meeting access"
            });

        }

    }
);

socket.on(
    "admit-user",
    async (
        { requestId },
        callback
    ) => {

        try {

            const request =
                pendingJoinRequests.get(
                    requestId
                );


            if (!request) {

                return callback?.({
                    success: false,
                    message:
                        "Join request no longer exists"
                });

            }


            const meeting =
                await Meeting.findOne({
                    meetingId:
                        request.meetingId,
                    isActive: true
                });


            if (!meeting) {

                pendingJoinRequests.delete(
                    requestId
                );

                return callback?.({
                    success: false,
                    message:
                        "Meeting has ended"
                });

            }


            const isHost =
                socket.user.role === "user" &&
                socket.user.id ===
                    meeting.host.toString() &&
                socket.data.meetingId ===
                    request.meetingId;


            if (!isHost) {

                return callback?.({
                    success: false,
                    message:
                        "Only the meeting host can admit users"
                });

            }


            const requester =
                io.sockets.sockets.get(
                    request.socketId
                );


            pendingJoinRequests.delete(
                requestId
            );


            if (!requester) {

                return callback?.({
                    success: false,
                    message:
                        "Requester is no longer connected"
                });

            }


            const admitted =
                getMeetingAdmissionSet(
                    request.meetingId
                );


            admitted.add(
                request.identityKey
            );


            clearAdmissionTimer(
                request.meetingId,
                request.identityKey
            );


            requester.data.admissionMeetingId =
                request.meetingId;

            requester.data.pendingRequestId =
                null;


            requester.emit(
                "join-approved",
                {
                    meetingId:
                        request.meetingId
                }
            );


            callback?.({
                success: true
            });

        } catch (error) {

            console.error(
                "Admit user error:",
                error
            );


            callback?.({
                success: false,
                message:
                    "Failed to admit user"
            });

        }

    }
);

socket.on(
    "reject-user",
    async (
        { requestId },
        callback
    ) => {

        try {

            const request =
                pendingJoinRequests.get(
                    requestId
                );


            if (!request) {

                return callback?.({
                    success: false,
                    message:
                        "Join request no longer exists"
                });

            }


            const meeting =
                await Meeting.findOne({
                    meetingId:
                        request.meetingId,
                    isActive: true
                });


            if (!meeting) {

                pendingJoinRequests.delete(
                    requestId
                );

                return callback?.({
                    success: false,
                    message:
                        "Meeting has ended"
                });

            }


            const isHost =
                socket.user.role === "user" &&
                socket.user.id ===
                    meeting.host.toString() &&
                socket.data.meetingId ===
                    request.meetingId;


            if (!isHost) {

                return callback?.({
                    success: false,
                    message:
                        "Only the meeting host can reject users"
                });

            }


            const requester =
                io.sockets.sockets.get(
                    request.socketId
                );


            pendingJoinRequests.delete(
                requestId
            );


            if (requester) {

                requester.data.pendingRequestId =
                    null;

                requester.emit(
                    "join-rejected",
                    {
                        meetingId:
                            request.meetingId,

                        message:
                            "The host rejected your request"
                    }
                );

            }


            callback?.({
                success: true
            });

        } catch (error) {

            console.error(
                "Reject user error:",
                error
            );


            callback?.({
                success: false,
                message:
                    "Failed to reject user"
            });

        }

    }
);



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

                const identityKey =
    getIdentityKey(socket);

const isHost =
    socket.user.role === "user" &&
    meeting.host.toString() ===
        socket.user.id;

const admitted =
    getMeetingAdmissionSet(
        normalizedMeetingId
    );

const approvedForMeeting =
    socket.data.admissionMeetingId ===
        normalizedMeetingId ||
    admitted.has(identityKey);

if (
    !isHost &&
    !approvedForMeeting
) {

    return callback({
        success: false,
        message:
            "Waiting for host approval"
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

                socket.data.admissionMeetingId =
                    normalizedMeetingId;


                // Every newly joined socket starts
                // with default media state.

                socket.data.mediaState = {
                    ...defaultMediaState
                };




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