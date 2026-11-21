
import { Request, Response } from "express";
import {
    and,
    count,
    eq,
    lt,
    lte,
    or,
} from "drizzle-orm";

import { db } from "../../config/db";
import { pembayaran, pemesanan } from "../../config/schema";

export const getCashierDashboard = async (
    req: Request,
    res: Response
) => {
    try {
        // Tanggal dan waktu lokal server
        const now = new Date();

        const today = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        );

        const currentTime = [
            String(now.getHours()).padStart(2, "0"),
            String(now.getMinutes()).padStart(2, "0"),
            String(now.getSeconds()).padStart(2, "0"),
        ].join(":");

        // 1. Jumlah pembayaran yang menunggu verifikasi
        const [pembayaranPendingResult] = await db
            .select({
                total: count(),
            })
            .from(pembayaran)
            .where(
                eq(pembayaran.statusVerifikasi, "pending")
            );

        // 2. Jumlah booking hari ini
        const [bookingHariIniResult] = await db
            .select({
                total: count(),
            })
            .from(pemesanan)
            .where(
                eq(pemesanan.tanggalPemesanan, today)
            );

        // 3. Jumlah booking dengan status confirmed
        const [bookingConfirmedResult] = await db
            .select({
                total: count(),
            })
            .from(pemesanan)
            .where(
                eq(pemesanan.statusPemesanan, "confirmed")
            );

        // 4. Booking confirmed yang jadwalnya sudah tiba atau lewat
        const [bookingPerluDitanganiResult] = await db
            .select({
                total: count(),
            })
            .from(pemesanan)
            .where(
                and(
                    eq(pemesanan.statusPemesanan, "confirmed"),
                    or(
                        lt(pemesanan.tanggalPemesanan, today),
                        and(
                            eq(pemesanan.tanggalPemesanan, today),
                            lte(pemesanan.jamMulai, currentTime)
                        )
                    )
                )
            );

        return res.status(200).json({
            message: "Dashboard kasir berhasil diambil.",
            data: {
                pembayaranPending: pembayaranPendingResult.total,
                bookingHariIni: bookingHariIniResult.total,
                bookingConfirmed: bookingConfirmedResult.total,
                bookingPerluDitangani: bookingPerluDitanganiResult.total,
            },
        });
    } catch (error) {
        console.error("Get Cashier Dashboard Error:", error);

        return res.status(500).json({
            message: "Terjadi kesalahan pada server.",
        });
    }
};
