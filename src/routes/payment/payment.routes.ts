
import { Router } from "express";
import { getQris, getPendingPayments, getPaymentById, verifyPayment,} from "../../controllers/payment/payment.controller";
import { authenticateToken } from "../../middlewares/auth.middleware";
import { uploadPaymentProof } from "../../controllers/payment/payment.controller";
import { uploadPaymentProof as uploadPaymentProofMiddleware } from "../../middlewares/upload.middleware";
import { authorizeRole } from "../../middlewares/role.middleware";


const router = Router();

router.get("/qris", authenticateToken, getQris);

router.post("/:idBooking", authenticateToken, authorizeRole("customer"), uploadPaymentProofMiddleware, uploadPaymentProof );

router.get("/pending", authenticateToken, authorizeRole("kasir"), getPendingPayments );
router.get("/:id", authenticateToken, authorizeRole("kasir"), getPaymentById );

router.patch("/:id/verify", authenticateToken, authorizeRole("kasir"), verifyPayment );


export default router;
