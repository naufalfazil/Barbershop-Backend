import { Router } from "express";
import { createBooking, getMyBookings, getBookingById, getAllBookings, cancelBooking, updateBookingStatus, rescheduleBooking } from "../../controllers/booking/booking.controller";
import { authenticateToken } from "../../middlewares/auth.middleware";
import { authorizeRole } from "../../middlewares/role.middleware";

const router = Router();

// Customer
router.post("/", authenticateToken, authorizeRole("customer"), createBooking );

router.get("/my", authenticateToken, authorizeRole("customer"), getMyBookings);
router.patch("/:id/cancel", authenticateToken, authorizeRole("customer"), cancelBooking);

// Customer, admin, dan kasir
router.get("/:id", authenticateToken, authorizeRole("customer", "admin", "kasir"), getBookingById
);

// Admin dan kasir
router.get( "/", authenticateToken, authorizeRole("admin", "kasir"), getAllBookings);

// Kasir
router.patch("/:id/status", authenticateToken, authorizeRole("kasir"), updateBookingStatus);

router.patch("/:id/reschedule", authenticateToken, authorizeRole("customer"), rescheduleBooking);

export default router;
