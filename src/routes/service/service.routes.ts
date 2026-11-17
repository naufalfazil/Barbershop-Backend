import { Router } from "express";
import ServiceController from "../../controllers/service/service.controller";

const router = Router();

router.get("/", ServiceController.getAll.bind(ServiceController));
router.get("/:id", ServiceController.getById.bind(ServiceController));
router.post("/", ServiceController.create.bind(ServiceController));
router.put("/:id", ServiceController.update.bind(ServiceController));

// Mengaktifkan / menonaktifkan layanan
router.patch("/:id/status", ServiceController.updateStatus.bind(ServiceController));

// DELETE secara soft delete
router.delete("/:id", ServiceController.delete.bind(ServiceController));

export default router;
