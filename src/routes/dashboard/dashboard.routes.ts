import { Router } from "express";

import { getAdminDashboard } from "../../controllers/dashboard/admin.dashboard.controller";
import { authenticateToken } from "../../middlewares/auth.middleware";
import { authorizeRole } from "../../middlewares/role.middleware";

import { getCashierDashboard } from "../../controllers/dashboard/cashier.dashboard.controller";

const router = Router();

router.get("/admin", authenticateToken, authorizeRole("admin"), getAdminDashboard );

// Dashboard khusus kasir
router.get("/kasir", authenticateToken, authorizeRole("kasir"), getCashierDashboard );

export default router;