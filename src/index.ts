import express from "express";
import serviceRoutes from "./routes/service/service.routes";
import authRoutes from "./routes/auth/auth.routes";
import barberRoutes from "./routes/barber/barber.routes";
import bookingRoutes from "./routes/booking/booking.routes";
import cashierRoutes from "./routes/user/cashier.routes";
import paymentRoutes from "./routes/payment/payment.routes";
import dashboardRoutes from "./routes/dashboard/dashboard.routes";


const app = express();
const PORT = 3000;

// Middleware untuk membaca JSON dari request
app.use(express.json());

// Route utama
app.get("/", (req, res) => {
    res.send("Hello Express + TypeScript!");
});

app.use("/api/auth", authRoutes);

// Hubungkan routes layanan
app.use("/api/services", serviceRoutes);

app.use("/api/barbers", barberRoutes);

app.use("/api/bookings", bookingRoutes);

app.use("/api/users", cashierRoutes);

app.use("/api/payments", paymentRoutes);

app.use("/api/dashboard", dashboardRoutes);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
