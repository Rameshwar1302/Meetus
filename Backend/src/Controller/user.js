import User from "../Models/users.js";
import httpStatus from "http-status"
import bcrypt, {hash} from "bcrypt" 


const Register = async (req, res) => {
     try{
        const {name, username, password} = req.body;

        if (!name || !username || !password) {
         return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: "name, username and password are required",
      });
    }

        const existingUser = await User.findOne({username});

        if(existingUser){
           return res.status(httpStatus.CONFLICT).json({
        success: false,
        message: "User already exists",
        });
      }
    

      const hashedpassword = await bcrypt.hash(password, 10);

      const newUser = new User({
        name : name,
        username : username,
        password: hashedpassword
      });

      await newUser.save();

      return res.status(httpStatus.CREATED).json({success : true, message : "User Added Successfully"});

     }catch (error) {
        console.log(error);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success : false,
            message : "Internal Server Error"
        });
     }
}

const Login = async (req, res) => {
    try {
      const {username, password} = req.body;

    //   if( !username || !password){
    //     res.status(httpStatus.NOT_ACCEPTABLE).json({success : false, message:""})
    //   }

      const user = await User.findOne({username});

      if(!user){
        return res.status(400).json({
            success : false, 
            message : "User not found"
        });
      }

      const isMatched = await bcrypt.copare(password, user.password);

      if(!isMatched){
         return res.status(httpStatus.).json({
            success:false,
            message: "Password Not matched"
         })
      }

      return res.status(httpStatus.ACCEPTED).json({
        success: false,
        message: "Loged in Successfully",
        user: {
        username: user.username,
        name: user.name,
        },
      })

    } catch (error) {
         console.log(error);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success : false,
            message : "Internal Server Error"
        });
     }
}