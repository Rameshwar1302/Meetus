import ChatMessage from "../models/chatMessage.js";
import Meeting from "../models/meeting.js";

const MAX_MESSAGE_LENGTH = 1000;
const CHAT_HISTORY_LIMIT = 100;

export const registerChatHandlers = (io, socket) => {

    // ==========================================
    // SEND MESSAGE
    // ==========================================

    socket.on(
        "send-message",
        async ({ message }, callback) => {

            try {

                const meetingId =
                    socket.data.meetingId;

                // User must actually be inside a meeting
                if (!meetingId) {

                    return callback?.({
                        success: false,
                        message:
                            "You are not in a meeting"
                    });
                }

                // Validate message
                if (
                    typeof message !== "string" ||
                    !message.trim()
                ) {

                    return callback?.({
                        success: false,
                        message:
                            "Message cannot be empty"
                    });
                }

                const cleanedMessage =
                    message.trim();

                if (
                    cleanedMessage.length >
                    MAX_MESSAGE_LENGTH
                ) {

                    return callback?.({
                        success: false,
                        message:
                            `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`
                    });
                }

                // Verify meeting is still active
                const meeting =
                    await Meeting.findOne({
                        meetingId,
                        isActive: true
                    }).select("_id");

                if (!meeting) {

                    return callback?.({
                        success: false,
                        message:
                            "Meeting has ended"
                    });
                }

                // ==================================
                // CREATE MESSAGE
                // ==================================

                const chatMessage =
                    await ChatMessage.create({

                        meetingId,

                        senderId:
                            socket.user.role === "user"
                                ? socket.user.id
                                : null,

                        senderName:
                            socket.user.name,

                        senderRole:
                            socket.user.role,

                        message:
                            cleanedMessage

                    });

                // ==================================
                // MESSAGE SENT TO EVERYONE
                // ==================================

                const response = {

                    id:
                        chatMessage._id.toString(),

                    meetingId:
                        chatMessage.meetingId,

                    senderId:
                        chatMessage.senderId
                            ?.toString() || null,

                    senderName:
                        chatMessage.senderName,

                    senderRole:
                        chatMessage.senderRole,

                    message:
                        chatMessage.message,

                    createdAt:
                        chatMessage.createdAt

                };

                io.to(meetingId).emit(
                    "chat-message",
                    response
                );

                callback?.({
                    success: true
                });

            } catch (error) {

                console.error(
                    "Send chat message error:",
                    error
                );

                callback?.({
                    success: false,
                    message:
                        "Failed to send message"
                });
            }
        }
    );


    // ==========================================
    // GET CHAT HISTORY
    // ==========================================

    socket.on(
        "get-chat-history",
        async (callback) => {

            try {

                const meetingId =
                    socket.data.meetingId;

                if (!meetingId) {

                    return callback?.({
                        success: false,
                        message:
                            "You are not in a meeting"
                    });
                }

                const messages =
                    await ChatMessage.find({
                        meetingId
                    })
                    .sort({
                        createdAt: -1
                    })
                    .limit(
                        CHAT_HISTORY_LIMIT
                    )
                    .lean();

                // Reverse so frontend receives
                // oldest → newest
                messages.reverse();

                const formattedMessages =
                    messages.map((message) => ({
                        id:
                            message._id.toString(),

                        meetingId:
                            message.meetingId,

                        senderId:
                            message.senderId
                                ?.toString() || null,

                        senderName:
                            message.senderName,

                        senderRole:
                            message.senderRole,

                        message:
                            message.message,

                        createdAt:
                            message.createdAt
                    }));

                callback?.({
                    success: true,
                    messages:
                        formattedMessages
                });

            } catch (error) {

                console.error(
                    "Get chat history error:",
                    error
                );

                callback?.({
                    success: false,
                    message:
                        "Failed to load chat history"
                });
            }
        }
    );
};