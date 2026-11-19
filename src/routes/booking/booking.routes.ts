import { Router } from "express";
import { createBooking, getMyBookings, getBookingById, getAllBookings, cancelBooking, updateBookingStatus } from "../../controllers/booking/booking.controller";
import { authenticateToken } from "../../middlewares/auth.middleware";

const router = Router();

// Membuat booking (customer yang sudah login)
router.post("/", authenticateToken, createBooking);

router.get("/my", authenticateToken, getMyBookings);

router.get("/:id", authenticateToken, getBookingById);

router.get("/", authenticateToken, getAllBookings);

router.patch("/:id/cancel", authenticateToken, cancelBooking);

router.patch("/:id/status", authenticateToken, updateBookingStatus);


export default router;
