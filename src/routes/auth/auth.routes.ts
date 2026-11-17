import { Router } from "express";
import AuthController from "../../controllers/auth/auth.controller";
import { validate } from "../../middlewares/validate.middleware";
import { registerSchema, loginSchema } from "../../validations/auth.validation";

const router = Router();

router.post("/register", validate(registerSchema), AuthController.register.bind(AuthController));
router.post("/login", validate(loginSchema), AuthController.login.bind(AuthController));

export default router;
