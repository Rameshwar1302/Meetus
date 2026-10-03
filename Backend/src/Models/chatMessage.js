import mongoose, { Schema } from "mongoose";

const chatMessageSchema = new Schema(
    {
        meetingId: {
            type: String,
            required: true,
            index: true
        },

        senderId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        senderName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        senderRole: {
            type: String,
            enum: ["user", "guest"],
            required: true
        },

        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000
        }
    },
    {
        timestamps: true
    }
);

chatMessageSchema.index({
    meetingId: 1,
    createdAt: 1
});

const ChatMessage =
    mongoose.model(
        "ChatMessage",
        chatMessageSchema
    );

export default ChatMessage;