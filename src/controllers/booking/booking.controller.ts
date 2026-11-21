
import { Response } from "express";
import { and, eq, inArray, desc } from "drizzle-orm";

import { db } from "../../config/db";
import {
    pegawaiBarber,
    layanan,
    pemesanan,
    users,
    riwayatReschedule,
} from "../../config/schema";

import { AuthRequest } from "../../middlewares/auth.middleware";

import {
    calculateEndTime,
    isValidCalendarDate,
    isWithinOperatingHours,
    timeToMinutes,
} from "../../utils/booking.utils";

const BLOCKING_STATUSES = [
    "awaiting_payment",
    "awaiting_verification",
    "confirmed",
] as const;

function generateBookingCode(): string {
    const random = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();

    const timestamp = Date.now().toString().slice(-6);

    return `BK-${timestamp}-${random}`;
}

// Mengambil tanggal lokal server dalam format YYYY-MM-DD
function getLocalDateString(date: Date): string {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-");
}

// Mengubah tanggal dan jam booking menjadi timestamp lokal
function getBookingTimestamp(
    tanggal: Date | string,
    jam: string
): number {
    let tanggalString: string;

    if (tanggal instanceof Date) {
        tanggalString = getLocalDateString(tanggal);
    } else {
        tanggalString = tanggal;
    }

    const [year, month, day] = tanggalString
        .slice(0, 10)
        .split("-")
        .map(Number);

    const [hour, minute, second = "0"] = jam
        .split(":");

    return new Date(
        year,
        month - 1,
        day,
        Number(hour),
        Number(minute),
        Number(second),
        0
    ).getTime();
}

// =====================================================
// CREATE BOOKING
// =====================================================

export async function createBooking(
    req: AuthRequest,
    res: Response
) {
    try {
        const idUser = req.user?.idUser;

        if (!idUser) {
            return res.status(401).json({
                message: "User tidak ditemukan. Silakan login kembali.",
            });
        }

        if (req.user?.role !== "customer") {
            return res.status(403).json({
                message: "Hanya customer yang dapat membuat booking.",
            });
        }

        const {
            idPegawai,
            idLayanan,
            tanggalPemesanan,
            jamMulai,
        } = req.body;

        const jamMulaiNormalized = String(jamMulai).replace(".", ":");

        const timeParts = jamMulaiNormalized.split(":");
        const jamMulaiValid = `${timeParts[0].padStart(2, "0")}:${timeParts[1].padStart(2, "0")}`;

        if (
            !idPegawai ||
            !idLayanan ||
            !tanggalPemesanan ||
            !jamMulai
        ) {
            return res.status(400).json({
                message: "Semua field booking wajib diisi.",
            });
        }

        if (!isValidCalendarDate(tanggalPemesanan)) {
            return res.status(400).json({
                message: "Tanggal booking tidak valid.",
            });
        }

        if (
            timeParts.length !== 2 ||
            !/^\d{2}$/.test(timeParts[0]) ||
            !/^\d{2}$/.test(timeParts[1]) ||
            Number(timeParts[0]) > 23 ||
            Number(timeParts[1]) > 59
        ) {
            return res.status(400).json({
                message: "Format jam mulai tidak valid. Gunakan HH:mm, contoh 13:00.",
            });
        }

        const today = getLocalDateString(new Date());

        if (tanggalPemesanan < today) {
            return res.status(400).json({
                message: "Tidak bisa booking untuk tanggal yang sudah lewat.",
            });
        }

        const tanggalPemesananDate = new Date(
            `${tanggalPemesanan}T00:00:00`
        );

        // Validasi barber
        const [barber] = await db
            .select()
            .from(pegawaiBarber)
            .where(
                and(
                    eq(pegawaiBarber.idPegawai, Number(idPegawai)),
                    eq(pegawaiBarber.statusAktif, 1)
                )
            )
            .limit(1);

        if (!barber) {
            return res.status(404).json({
                message: "Barber tidak ditemukan atau sedang tidak aktif.",
            });
        }

        // Validasi layanan
        const [service] = await db
            .select()
            .from(layanan)
            .where(
                and(
                    eq(layanan.idLayanan, Number(idLayanan)),
                    eq(layanan.status, "published"),
                    eq(layanan.statusAktif, 1)
                )
            )
            .limit(1);

        if (!service) {
            return res.status(404).json({
                message: "Layanan tidak ditemukan atau sedang tidak tersedia.",
            });
        }

        const duration = Number(service.durasiMenit);
        const price = Number(service.harga);

        // Validasi jam operasional 10.00–22.00
        if (!isWithinOperatingHours(jamMulaiValid, duration)) {
            return res.status(400).json({
                message:
                    "Booking harus berada dalam jam operasional 10.00–22.00, termasuk buffer 30 menit.",
            });
        }

        const startMinutes = timeToMinutes(jamMulaiValid);
        const endMinutes = startMinutes + duration;
        const endWithBuffer = endMinutes + 30;

        // Cek jadwal barber
        const existingBookings = await db
            .select()
            .from(pemesanan)
            .where(
                and(
                    eq(pemesanan.idPegawai, Number(idPegawai)),
                    eq(pemesanan.tanggalPemesanan, tanggalPemesananDate),
                    inArray(
                        pemesanan.statusPemesanan,
                        [...BLOCKING_STATUSES]
                    )
                )
            );

        for (const booking of existingBookings) {
            const existingStart = timeToMinutes(
                String(booking.jamMulai).slice(0, 5)
            );

            const existingEnd =
                timeToMinutes(
                    String(booking.jamSelesai).slice(0, 5)
                ) + 30;

            if (
                startMinutes < existingEnd &&
                endWithBuffer > existingStart
            ) {
                return res.status(409).json({
                    message: "Jadwal barber bentrok dengan booking lain.",
                });
            }
        }

        const jamSelesai = calculateEndTime(
            jamMulaiValid,
            duration
        );

        const bookingCode = generateBookingCode();

        await db.insert(pemesanan).values({
            kodePemesanan: bookingCode,
            idUser,
            idPegawai: Number(idPegawai),
            idLayanan: Number(idLayanan),
            tanggalPemesanan: tanggalPemesananDate,
            jamMulai: `${jamMulaiValid}:00`,
            jamSelesai,
            namaLayanan: service.namaLayanan,
            hargaLayanan: service.harga,
            durasiMenit: duration,
            statusPemesanan: "awaiting_payment",
            jumlahReschedule: 0,
            noShowDecision: "not_selected",
        });

        return res.status(201).json({
            message: "Booking berhasil dibuat.",
            data: {
                kodePemesanan: bookingCode,
                idPegawai: Number(idPegawai),
                idLayanan: Number(idLayanan),
                tanggalPemesanan,
                jamMulai: jamMulaiValid,
                jamSelesai,
                durasiMenit: duration,
                harga: price,
                statusPemesanan: "awaiting_payment",
            },
        });
    } catch (error) {
        console.error("Create booking error:", error);

        return res.status(500).json({
            message: "Terjadi kesalahan saat membuat booking.",
        });
    }
}

// =====================================================
// GET MY BOOKINGS
// =====================================================

export async function getMyBookings(
    req: AuthRequest,
    res: Response
) {
    try {
        const idUser = req.user?.idUser;

        if (!idUser) {
            return res.status(401).json({
                message: "User tidak ditemukan. Silakan login kembali.",
            });
        }

        if (req.user?.role !== "customer") {
            return res.status(403).json({
                message: "Endpoint ini hanya dapat diakses customer.",
            });
        }

        const bookings = await db
            .select({
                idPemesanan: pemesanan.idPemesanan,
                kodePemesanan: pemesanan.kodePemesanan,
                namaLayanan: pemesanan.namaLayanan,
                hargaLayanan: pemesanan.hargaLayanan,
                durasiMenit: pemesanan.durasiMenit,
                tanggalPemesanan: pemesanan.tanggalPemesanan,
                jamMulai: pemesanan.jamMulai,
                jamSelesai: pemesanan.jamSelesai,
                statusPemesanan: pemesanan.statusPemesanan,
                jumlahReschedule: pemesanan.jumlahReschedule,
                noShowDecision: pemesanan.noShowDecision,
                namaBarber: pegawaiBarber.namaPegawai,
                createdAt: pemesanan.createdAt,
            })
            .from(pemesanan)
            .leftJoin(
                pegawaiBarber,
                eq(
                    pemesanan.idPegawai,
                    pegawaiBarber.idPegawai
                )
            )
            .where(eq(pemesanan.idUser, idUser))
            .orderBy(desc(pemesanan.createdAt));

        return res.status(200).json({
            message: "Daftar booking berhasil diambil.",
            data: bookings,
        });
    } catch (error) {
        console.error("Get my bookings error:", error);

        return res.status(500).json({
            message: "Terjadi kesalahan saat mengambil daftar booking.",
        });
    }
}

// =====================================================
// GET BOOKING BY ID
// =====================================================

export async function getBookingById(
    req: AuthRequest,
    res: Response
) {
    try {
        const idUser = req.user?.idUser;
        const role = req.user?.role;
        const id = Number(req.params.id);

        if (!idUser) {
            return res.status(401).json({
                message: "User tidak ditemukan. Silakan login kembali.",
            });
        }

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                message: "ID booking tidak valid.",
            });
        }

        const [booking] = await db
            .select({
                idPemesanan: pemesanan.idPemesanan,
                kodePemesanan: pemesanan.kodePemesanan,
                idUser: pemesanan.idUser,
                idPegawai: pemesanan.idPegawai,
                idLayanan: pemesanan.idLayanan,
                namaLayanan: pemesanan.namaLayanan,
                hargaLayanan: pemesanan.hargaLayanan,
                durasiMenit: pemesanan.durasiMenit,
                tanggalPemesanan: pemesanan.tanggalPemesanan,
                jamMulai: pemesanan.jamMulai,
                jamSelesai: pemesanan.jamSelesai,
                statusPemesanan: pemesanan.statusPemesanan,
                jumlahReschedule: pemesanan.jumlahReschedule,
                noShowDecision: pemesanan.noShowDecision,
                createdAt: pemesanan.createdAt,
                namaBarber: pegawaiBarber.namaPegawai,
            })
            .from(pemesanan)
            .leftJoin(
                pegawaiBarber,
                eq(
                    pemesanan.idPegawai,
                    pegawaiBarber.idPegawai
                )
            )
            .where(eq(pemesanan.idPemesanan, id))
            .limit(1);

        if (!booking) {
            return res.status(404).json({
                message: "Booking tidak ditemukan.",
            });
        }

        if (
            role === "customer" &&
            booking.idUser !== idUser
        ) {
            return res.status(403).json({
                message: "Kamu tidak memiliki akses ke booking ini.",
            });
        }

        if (
            role !== "customer" &&
            role !== "admin" &&
            role !== "kasir"
        ) {
            return res.status(403).json({
                message: "Role tidak memiliki akses.",
            });
        }

        return res.status(200).json({
            message: "Detail booking berhasil diambil.",
            data: booking,
        });
    } catch (error) {
        console.error("Get booking by ID error:", error);

        return res.status(500).json({
            message: "Terjadi kesalahan saat mengambil detail booking.",
        });
    }
}

// =====================================================
// GET ALL BOOKINGS
// =====================================================

export async function getAllBookings(
    req: AuthRequest,
    res: Response
) {
    try {
        const role = req.user?.role;

        if (!req.user?.idUser) {
            return res.status(401).json({
                message: "User tidak ditemukan. Silakan login kembali.",
            });
        }

        if (role !== "admin" && role !== "kasir") {
            return res.status(403).json({
                message:
                    "Hanya admin dan kasir yang dapat melihat semua booking.",
            });
        }

        const bookings = await db
            .select({
                idPemesanan: pemesanan.idPemesanan,
                kodePemesanan: pemesanan.kodePemesanan,
                namaCustomer: users.name,
                emailCustomer: users.email,
                namaBarber: pegawaiBarber.namaPegawai,
                namaLayanan: pemesanan.namaLayanan,
                hargaLayanan: pemesanan.hargaLayanan,
                durasiMenit: pemesanan.durasiMenit,
                tanggalPemesanan: pemesanan.tanggalPemesanan,
                jamMulai: pemesanan.jamMulai,
                jamSelesai: pemesanan.jamSelesai,
                statusPemesanan: pemesanan.statusPemesanan,
                jumlahReschedule: pemesanan.jumlahReschedule,
                noShowDecision: pemesanan.noShowDecision,
                createdAt: pemesanan.createdAt,
            })
            .from(pemesanan)
            .leftJoin(
                users,
                eq(pemesanan.idUser, users.idUser)
            )
            .leftJoin(
                pegawaiBarber,
                eq(
                    pemesanan.idPegawai,
                    pegawaiBarber.idPegawai
                )
            )
            .orderBy(desc(pemesanan.createdAt));

        return res.status(200).json({
            message: "Semua booking berhasil diambil.",
            total: bookings.length,
            data: bookings,
        });
    } catch (error) {
        console.error("Get all bookings error:", error);

        return res.status(500).json({
            message: "Terjadi kesalahan saat mengambil semua booking.",
        });
    }
}

// =====================================================
// CANCEL BOOKING BY CUSTOMER
// =====================================================

export async function cancelBooking(
    req: AuthRequest,
    res: Response
) {
    try {
        const idUser = req.user?.idUser;
        const role = req.user?.role;
        const id = Number(req.params.id);

        if (!idUser) {
            return res.status(401).json({
                message: "User tidak ditemukan. Silakan login kembali.",
            });
        }

        if (role !== "customer") {
            return res.status(403).json({
                message: "Hanya customer yang dapat membatalkan booking.",
            });
        }

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                message: "ID booking tidak valid.",
            });
        }

        const [booking] = await db
            .select()
            .from(pemesanan)
            .where(
                and(
                    eq(pemesanan.idPemesanan, id),
                    eq(pemesanan.idUser, idUser)
                )
            )
            .limit(1);

        if (!booking) {
            return res.status(404).json({
                message: "Booking tidak ditemukan.",
            });
        }

        if (booking.statusPemesanan !== "completed") {
            return res.status(400).json({
                message:
                    "Hanya booking berstatus completed yang dapat dibatalkan.",
            });
        }

        if (!booking.completedAt) {
            return res.status(400).json({
                message: "Waktu penyelesaian booking tidak tersedia.",
            });
        }

        const completedAt = new Date(
            booking.completedAt
        ).getTime();

        const now = Date.now();
        const elapsedMilliseconds = now - completedAt;
        const limaBelasMenit = 15 * 60 * 1000;

        if (
            elapsedMilliseconds < 0 ||
            elapsedMilliseconds > limaBelasMenit
        ) {
            return res.status(400).json({
                message:
                    "Batas waktu pembatalan sudah habis. Booking hanya dapat dibatalkan maksimal 15 menit setelah completed.",
            });
        }

        await db
            .update(pemesanan)
            .set({
                statusPemesanan: "canceled",
            })
            .where(
                and(
                    eq(pemesanan.idPemesanan, id),
                    eq(pemesanan.idUser, idUser),
                    eq(pemesanan.statusPemesanan, "completed")
                )
            );

        return res.status(200).json({
            message: "Booking berhasil dibatalkan.",
            data: {
                idPemesanan: booking.idPemesanan,
                kodePemesanan: booking.kodePemesanan,
                statusPemesanan: "canceled",
            },
        });
    } catch (error) {
        console.error("Cancel booking error:", error);

        return res.status(500).json({
            message: "Terjadi kesalahan saat membatalkan booking.",
        });
    }
}

// =====================================================
// UPDATE BOOKING STATUS BY CASHIER
// =====================================================

export async function updateBookingStatus(
    req: AuthRequest,
    res: Response
) {
    try {
        const idUser = req.user?.idUser;
        const role = req.user?.role;
        const id = Number(req.params.id);
        const { statusPemesanan } = req.body;

        if (!idUser) {
            return res.status(401).json({
                message: "Silakan login kembali.",
            });
        }

        if (role !== "kasir") {
            return res.status(403).json({
                message: "Hanya kasir yang dapat mengubah status booking.",
            });
        }

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                message: "ID booking tidak valid.",
            });
        }

        const allowedStatuses = [
            "completed",
            "no_show",
            "canceled",
        ] as const;

        type BookingStatus = typeof allowedStatuses[number];

        if (
            typeof statusPemesanan !== "string" ||
            !allowedStatuses.includes(statusPemesanan as BookingStatus)
        ) {
            return res.status(400).json({
                message:
                    "Status tidak valid. Pilihan: completed, no_show, canceled.",
            });
        }

        // Beri tahu TypeScript bahwa status sudah lolos validasi
        const newStatus = statusPemesanan as BookingStatus;

        if (
            typeof statusPemesanan !== "string" ||
            !allowedStatuses.includes(
                statusPemesanan as typeof allowedStatuses[number]
            )
        ) {
            return res.status(400).json({
                message:
                    "Status tidak valid. Pilihan: completed, no_show, canceled.",
            });
        }

        const [booking] = await db
            .select()
            .from(pemesanan)
            .where(eq(pemesanan.idPemesanan, id))
            .limit(1);

        if (!booking) {
            return res.status(404).json({
                message: "Booking tidak ditemukan.",
            });
        }

        if (booking.statusPemesanan !== "confirmed") {
            return res.status(400).json({
                message:
                    "Hanya booking berstatus confirmed yang dapat diubah oleh kasir.",
            });
        }

        const now = Date.now();

        const waktuMulai = getBookingTimestamp(
            booking.tanggalPemesanan,
            String(booking.jamMulai)
        );

        const waktuSelesai = getBookingTimestamp(
            booking.tanggalPemesanan,
            String(booking.jamSelesai)
        );

        // No Show: minimal 30 menit setelah jam mulai
        if (
            statusPemesanan === "no_show" &&
            now < waktuMulai + 30 * 60 * 1000
        ) {
            return res.status(400).json({
                message:
                    "Booking hanya dapat ditandai no_show setelah 30 menit dari jam mulai booking.",
            });
        }

        // Completed: hanya setelah jam selesai layanan
        if (
            statusPemesanan === "completed" &&
            now < waktuSelesai
        ) {
            return res.status(400).json({
                message:
                    "Booking belum mencapai waktu selesai layanan.",
            });
        }

        const completedAt =
            statusPemesanan === "completed"
                ? new Date()
                : null;

        await db
            .update(pemesanan)
            .set({
                statusPemesanan: newStatus,
                completedAt,
            })
            .where(
                and(
                    eq(pemesanan.idPemesanan, id),
                    eq(pemesanan.statusPemesanan, "confirmed")
                )
            );

        return res.status(200).json({
            message: "Status booking berhasil diperbarui.",
            data: {
                idPemesanan: booking.idPemesanan,
                kodePemesanan: booking.kodePemesanan,
                statusPemesanan,
                completedAt,
            },
        });
    } catch (error) {
        console.error("Update booking status error:", error);

        return res.status(500).json({
            message: "Terjadi kesalahan saat mengubah status booking.",
        });
    }
}


export async function rescheduleBooking(
    req: AuthRequest,
    res: Response
) {
    try {
        const idUser = req.user?.idUser;
        const id = Number(req.params.id);
        const { tanggalBaru, jamMulaiBaru } = req.body;

        // 1. Validasi autentikasi dan role
        if (!idUser) {
            return res.status(401).json({
                message: "Silakan login kembali.",
            });
        }

        if (req.user?.role !== "customer") {
            return res.status(403).json({
                message: "Hanya customer yang dapat melakukan reschedule.",
            });
        }

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                message: "ID booking tidak valid.",
            });
        }

        if (
            typeof tanggalBaru !== "string" ||
            typeof jamMulaiBaru !== "string"
        ) {
            return res.status(400).json({
                message: "Tanggal dan jam baru wajib diisi dengan format yang benar.",
            });
        }

        // 2. Validasi tanggal dan format jam
        if (!isValidCalendarDate(tanggalBaru)) {
            return res.status(400).json({
                message: "Tanggal reschedule tidak valid.",
            });
        }

        if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(jamMulaiBaru)) {
            return res.status(400).json({
                message: "Format jam tidak valid. Gunakan HH:mm atau HH:mm:ss.",
            });
        }

        const today = getLocalDateString(new Date());

        if (tanggalBaru < today) {
            return res.status(400).json({
                message: "Tidak bisa reschedule ke tanggal yang sudah lewat.",
            });
        }

        // 3. Ambil booking milik customer
        const [booking] = await db
            .select()
            .from(pemesanan)
            .where(
                and(
                    eq(pemesanan.idPemesanan, id),
                    eq(pemesanan.idUser, idUser)
                )
            )
            .limit(1);

        if (!booking) {
            return res.status(404).json({
                message: "Booking tidak ditemukan.",
            });
        }

        // 4. Validasi status booking
        if (booking.statusPemesanan !== "confirmed") {
            return res.status(400).json({
                message: "Hanya booking berstatus confirmed yang dapat di-reschedule.",
            });
        }

        // 5. Maksimal satu kali reschedule
        if (booking.jumlahReschedule >= 1) {
            return res.status(400).json({
                message: "Kesempatan reschedule untuk booking ini sudah digunakan.",
            });
        }

        // 6. Validasi jam operasional dan buffer
        const duration = Number(booking.durasiMenit);

        if (!isWithinOperatingHours(jamMulaiBaru, duration)) {
            return res.status(400).json({
                message: "Jadwal baru harus berada dalam jam operasional 10.00–22.00, termasuk buffer 30 menit.",
            });
        }

        // 7. Jadwal baru harus berada di masa depan
        const waktuBaru = getBookingTimestamp(
            tanggalBaru,
            jamMulaiBaru
        );

        if (waktuBaru <= Date.now()) {
            return res.status(400).json({
                message: "Jadwal baru harus berada di masa depan.",
            });
        }

        // 8. Hitung jam selesai baru
        const jamSelesaiBaru = calculateEndTime(
            jamMulaiBaru,
            duration
        );

        const startMinutes = timeToMinutes(jamMulaiBaru);
        const endWithBuffer = startMinutes + duration + 30;

        const tanggalLamaString = booking.tanggalPemesanan instanceof Date
        ? getLocalDateString(booking.tanggalPemesanan)
        : String(booking.tanggalPemesanan).slice(0, 10);

        const tanggalLamaDate = new Date(
            `${tanggalLamaString}T00:00:00`
        );
        
        const tanggalBaruDate = new Date(
            `${tanggalBaru}T00:00:00`
        );

        // 9. Cek bentrok jadwal barber
        const existingBookings = await db
            .select()
            .from(pemesanan)
            .where(
                and(
                    eq(pemesanan.idPegawai, booking.idPegawai),
                    eq(pemesanan.tanggalPemesanan, tanggalBaruDate),
                    inArray(
                        pemesanan.statusPemesanan,
                        [...BLOCKING_STATUSES]
                    )
                )
            );

        for (const existing of existingBookings) {
            // Abaikan booking yang sedang di-reschedule
            if (existing.idPemesanan === booking.idPemesanan) {
                continue;
            }

            const existingStart = timeToMinutes(
                String(existing.jamMulai).slice(0, 5)
            );

            const existingEndWithBuffer =
                timeToMinutes(
                    String(existing.jamSelesai).slice(0, 5)
                ) + 30;

            if (
                startMinutes < existingEndWithBuffer &&
                endWithBuffer > existingStart
            ) {
                return res.status(409).json({
                    message: "Jadwal baru bentrok dengan booking lain.",
                });
            }
        }

        // 11. Simpan riwayat dan update booking dalam transaksi
        await db.transaction(async (tx) => {
            // Kunci booking agar dua permintaan bersamaan
            // tidak menggunakan kesempatan reschedule yang sama.
            const [currentBooking] = await tx
                .select()
                .from(pemesanan)
                .where(eq(pemesanan.idPemesanan, id))
                .for("update")
                .limit(1);

            if (
                !currentBooking ||
                currentBooking.idUser !== idUser ||
                currentBooking.statusPemesanan !== "confirmed" ||
                currentBooking.jumlahReschedule >= 1
            ) {
                throw new Error("RESCHEDULE_NOT_ALLOWED");
            }

            await tx.insert(riwayatReschedule).values({
                idPemesanan: booking.idPemesanan,
                tanggalLama: tanggalLamaDate,
                jamMulaiLama: String(booking.jamMulai),
                tanggalBaru: tanggalBaruDate,
                jamMulaiBaru,
                idUser,
            });

            await tx
                .update(pemesanan)
                .set({
                    tanggalPemesanan: tanggalBaruDate,
                    jamMulai: jamMulaiBaru,
                    jamSelesai: jamSelesaiBaru,
                    jumlahReschedule: 1,
                })
                .where(
                    and(
                        eq(pemesanan.idPemesanan, id),
                        eq(pemesanan.idUser, idUser),
                        eq(pemesanan.statusPemesanan, "confirmed"),
                        eq(pemesanan.jumlahReschedule, 0)
                    )
                );
        });

        return res.status(200).json({
            message: "Booking berhasil di-reschedule.",
            data: {
                idPemesanan: booking.idPemesanan,
                kodePemesanan: booking.kodePemesanan,
                tanggalLama: tanggalLamaString,
                jamMulaiLama: booking.jamMulai,
                tanggalBaru,
                jamMulaiBaru,
                jamSelesaiBaru,
                jumlahReschedule: 1,
            },
        });
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === "RESCHEDULE_NOT_ALLOWED"
        ) {
            return res.status(409).json({
                message: "Booking sudah berubah atau kesempatan reschedule sudah digunakan.",
            });
        }

        console.error("Reschedule booking error:", error);

        return res.status(500).json({
            message: "Terjadi kesalahan saat reschedule booking.",
        });
    }
}
