import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
    {
      name : {type : String , required : true},
      username : {type : String , required : true, unique},
      password : {type: String , required : true},
      token : {type : String}
    },
    { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;