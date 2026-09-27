import mongoose, { Schema } from "mongoose";

const meetingSchema = new Schema(
    {
      user_id : {type: String, required},
      id : {type : String, required: true, unique},
      startTime: {type: Date, default : Date.now, required:true},
      endTime: {},

    }
)

const Meeting = mongoose.model("Meeting", meetingSchema);

export default Meeting;