import express from "express";
import serviceRoutes from "./routes/service/service.routes";

const app = express();
const PORT = 3000;

// Middleware untuk membaca JSON dari request
app.use(express.json());

// Route utama
app.get("/", (req, res) => {
    res.send("Hello Express + TypeScript!");
});

// Hubungkan routes layanan
app.use("/api/services", serviceRoutes);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
