
import { Response } from "express";
import { and, eq, inArray, desc, sql } from "drizzle-orm";
import { db } from "../../config/db";
import { pegawaiBarber, layanan, pemesanan, users } from "../../config/schema";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { calculateEndTime, isValidCalendarDate, isWithinOperatingHours, timeToMinutes } from "../../utils/booking.utils";

const BLOCKING_STATUSES = [
    "awaiting_payment",
    "awaiting_verification",
    "confirmed",
] as const;

function generateBookingCode(): string {
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    return `BK-${timestamp}-${random}`;
}

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

        // 1. Validasi input dasar
        if (!idPegawai || !idLayanan || !tanggalPemesanan || !jamMulai) {
            return res.status(400).json({
                message: "Semua field booking wajib diisi.",
            });
        }

        if (!isValidCalendarDate(tanggalPemesanan)) {
            return res.status(400).json({
                message: "Tanggal booking tidak valid.",
            });
        }

        // 2. Validasi tanggal booking
        const today = new Date();
        const todayString = [
            today.getFullYear(),
            String(today.getMonth() + 1).padStart(2, "0"),
            String(today.getDate()).padStart(2, "0"),
        ].join("-");

        if (tanggalPemesanan < todayString) {
            return res.status(400).json({
                message: "Tidak bisa booking untuk tanggal yang sudah lewat.",
            });
        }

        // 3. Validasi barber
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

        // 4. Validasi layanan
        const [service] = await db
            .select()
            .from( layanan )
            .where(
                and(
                    eq( layanan.idLayanan, Number(idLayanan) ),
                    eq( layanan.status, "published" ),
                    eq( layanan.statusAktif, 1 )
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

        // 5. Validasi jam operasional
        if (!isWithinOperatingHours(jamMulai, duration)) {
            return res.status(400).json({
                message: "Booking harus berada dalam jam operasional 10.00–22.00, termasuk buffer 30 menit.",
            });
        }

        const startMinutes = timeToMinutes(jamMulai);
        const endMinutes = startMinutes + duration;
        const endWithBuffer = endMinutes + 30;

        // 6. Cek jadwal barber pada tanggal yang dipilih
        const existingBookings = await db
            .select()
            .from(pemesanan)
            .where(
                and(
                    eq(pemesanan.idPegawai, Number(idPegawai)),
                    eq(pemesanan.tanggalPemesanan, tanggalPemesanan),
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

            const existingEnd = timeToMinutes(
                String(booking.jamSelesai).slice(0, 5)
            ) + 30;

            // Interval booking baru termasuk buffer
            if (
                startMinutes < existingEnd &&
                endWithBuffer > existingStart
            ) {
                return res.status(409).json({
                    message: "Jadwal barber bentrok dengan booking lain.",
                });
            }
        }

        // 7. Hitung jam selesai
        const jamSelesai = calculateEndTime(jamMulai, duration);

        // 8. Simpan booking
        const bookingCode = generateBookingCode();

        await db.insert(pemesanan).values({
            kodePemesanan: bookingCode,
            idUser,
            idPegawai: Number(idPegawai),
            idLayanan: Number(idLayanan),
            tanggalPemesanan,
            jamMulai,
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
                jamMulai,
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
                eq(pemesanan.idPegawai, pegawaiBarber.idPegawai)
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
                eq(pemesanan.idPegawai, pegawaiBarber.idPegawai)
            )
            .where(eq(pemesanan.idPemesanan, id))
            .limit(1);

        if (!booking) {
            return res.status(404).json({
                message: "Booking tidak ditemukan.",
            });
        }

        // Customer hanya boleh melihat booking miliknya
        if (role === "customer" && booking.idUser !== idUser) {
            return res.status(403).json({
                message: "Kamu tidak memiliki akses ke booking ini.",
            });
        }

        // Admin dan kasir boleh melihat booking siapa pun
        if (role !== "customer" && role !== "admin" && role !== "kasir") {
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

        // Hanya admin dan kasir yang boleh melihat seluruh booking
        if (role !== "admin" && role !== "kasir") {
            return res.status(403).json({
                message: "Hanya admin dan kasir yang dapat melihat semua booking.",
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
                eq(pemesanan.idPegawai, pegawaiBarber.idPegawai)
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
                message: "Hanya booking berstatus completed yang dapat dibatalkan.",
            });
        }

        if (!booking.completedAt) {
            return res.status(400).json({
                message: "Waktu penyelesaian booking tidak tersedia.",
            });
        }

        const completedAt = new Date(booking.completedAt).getTime();
        const now = Date.now();
        const elapsedMilliseconds = now - completedAt;
        const limaBelasMenit = 15 * 60 * 1000;

        if (
            elapsedMilliseconds < 0 ||
            elapsedMilliseconds > limaBelasMenit
        ) {
            return res.status(400).json({
                message: "Batas waktu pembatalan sudah habis. Booking hanya dapat dibatalkan maksimal 15 menit setelah completed.",
            });
        }

        // Update hanya jika status masih completed
        const result = await db
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


export async function updateBookingStatus(
    req: AuthRequest,
    res: Response
) {
    try {
        const idUser = req.user?.idUser;
        const role = req.user?.role;
        const id = Number(req.params.id);
        const { statusPemesanan } = req.body;

        // Hanya kasir
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

        if (!allowedStatuses.includes(statusPemesanan)) {
            return res.status(400).json({
                message: "Status tidak valid. Pilihan: completed, no_show, canceled.",
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

        // Untuk sementara, perubahan status kasir hanya dari confirmed
        if (booking.statusPemesanan !== "confirmed") {
            return res.status(400).json({
                message: "Hanya booking berstatus confirmed yang dapat diubah oleh kasir.",
            });
        }

        await db
            .update(pemesanan)
            .set({
                statusPemesanan,
                completedAt:
                    statusPemesanan === "completed"
                        ? new Date()
                        : null,
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
                completedAt:
                    statusPemesanan === "completed"
                        ? new Date()
                        : null,
            },
        });
    } catch (error) {
        console.error("Update booking status error:", error);

        return res.status(500).json({
            message: "Terjadi kesalahan saat mengubah status booking.",
        });
    }
}
