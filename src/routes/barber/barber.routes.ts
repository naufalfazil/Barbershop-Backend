import { Router } from "express";

import barberController from "../../controllers/barber/barber.controller";
import { authenticateToken } from "../../middlewares/auth.middleware";
import { authorizeRole } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { uploadBarberPhoto } from "../../middlewares/upload.middleware";
import { createBarberSchema, updateBarberSchema, updateBarberStatusSchema } from "../../validations/barber.validation";

const router = Router();

// Melihat daftar barber aktif
router.get("/", barberController.getAll);

// Melihat detail barber
router.get("/:id", barberController.getById);

// admin
router.post( "/", authenticateToken, authorizeRole("admin"), uploadBarberPhoto, validate(createBarberSchema), barberController.create);

router.put( "/:id", authenticateToken, authorizeRole("admin"), uploadBarberPhoto, validate(updateBarberSchema), barberController.update);

router.patch( "/:id/status", authenticateToken, authorizeRole("admin"), validate(updateBarberStatusSchema), barberController.updateStatus);

export default router;
