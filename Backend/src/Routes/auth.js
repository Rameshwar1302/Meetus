import { Router } from "express";

const router = Router();

router.route("/login");
router.route("/register");
router.route("/add_activity");
router.route("/get_allActivity");


export default router;