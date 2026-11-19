import { Router } from "express";

import { createCashier, getCashiers, updateCashierStatus } from "../../controllers/user/cashier.controller";
import { authenticateToken } from "../../middlewares/auth.middleware";
import { authorizeRole } from "../../middlewares/role.middleware";

const router = Router();

router.use(authenticateToken, authorizeRole("admin"));

router.post("/cashier", createCashier);
router.get("/cashiers", getCashiers);
router.patch("/cashier/:id/status", updateCashierStatus);

export default router;
