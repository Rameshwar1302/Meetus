import { Router } from "express";
import {Login, Register} from "../Controller/user.js";


const router = Router();

router.route("/login").post(Login);
router.route("/register").post(Register);
router.route("/register");
router.route("/add_activity");
router.route("/get_allActivity");


export default router;