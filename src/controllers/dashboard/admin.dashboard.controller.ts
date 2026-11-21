
import { Request, Response } from "express";
import { eq, count, sum } from "drizzle-orm";

import { db } from "../../config/db";
import {
    users,
    pemesanan,
    pembayaran,
} from "../../config/schema";

export const getAdminDashboard = async (
    req: Request,
    res: Response
) => {
    try {
        // Mengambil tanggal hari ini dalam format YYYY-MM-DD
        const now = new Date();

        const today = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        );

        // 1. Total seluruh booking
        const [totalBookingResult] = await db
            .select({
                total: count(),
            })
            .from(pemesanan);

        // 2. Total booking hari ini
        const [bookingHariIniResult] = await db
            .select({
                total: count(),
            })
            .from(pemesanan)
            .where(
                eq(pemesanan.tanggalPemesanan, today)
            );

        // 3. Total customer aktif
        const [totalCustomerResult] = await db
            .select({
                total: count(),
            })
            .from(users)
            .where(
                eq(users.role, "customer")
            );

        // 4. Total pendapatan dari pembayaran yang disetujui
        const [totalPendapatanResult] = await db
            .select({
                total: sum(pembayaran.jumlahBayar),
            })
            .from(pembayaran)
            .where(
                eq(pembayaran.statusVerifikasi, "approved")
            );

        return res.status(200).json({
            message: "Dashboard admin berhasil diambil.",
            data: {
                totalBooking: totalBookingResult.total,
                bookingHariIni: bookingHariIniResult.total,
                totalCustomer: totalCustomerResult.total,
                totalPendapatan: totalPendapatanResult.total ?? "0",
            },
        });
    } catch (error) {
        console.error("Get Admin Dashboard Error:", error);

        return res.status(500).json({
            message: "Terjadi kesalahan pada server.",
        });
    }
};
