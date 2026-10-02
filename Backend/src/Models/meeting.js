import mongoose, { Schema } from "mongoose";

const meetingSchema = new Schema(
    {
        meetingId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },

        host: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        accessMode: {
            type: String,
            enum: ["guest", "authenticated"],
            default: "guest",
            required: true
        },

        startTime: {
            type: Date,
            default: Date.now
        },

        endTime: {
            type: Date,
            default: null
        },

        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

const Meeting = mongoose.model("Meeting", meetingSchema);

export default Meeting;