import { Router } from "express";
import ServiceController from "../../controllers/service/service.controller";
import { authenticateToken } from "../../middlewares/auth.middleware";
import { authorizeRole } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { uploadServicePhoto } from "../../middlewares/upload.middleware";
import { createServiceSchema, updateServiceSchema, updateServiceStatusSchema } from "../../validations/service.validation";

const router = Router();

router.get("/", ServiceController.getAll.bind(ServiceController));
router.get("/:id", ServiceController.getById.bind(ServiceController));

router.post("/", authenticateToken, authorizeRole("admin"), uploadServicePhoto, validate(createServiceSchema), ServiceController.create.bind(ServiceController));

router.put("/:id", authenticateToken, authorizeRole("admin"), uploadServicePhoto, validate(updateServiceSchema) , ServiceController.update.bind(ServiceController));

router.patch("/:id/status", authenticateToken, authorizeRole("admin"), validate(updateServiceStatusSchema) , ServiceController.updateStatus.bind(ServiceController));

router.delete( "/:id",authenticateToken,authorizeRole("admin"),ServiceController.delete.bind(ServiceController));

export default router;
