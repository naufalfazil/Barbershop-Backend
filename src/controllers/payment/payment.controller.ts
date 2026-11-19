import { Request, Response } from "express";
import { paymentConfig } from "../../config/payment";
import { eq, desc } from "drizzle-orm";
import { db } from "../../config/db";
import { pembayaran, pemesanan } from "../../config/schema";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { uploadImage, deleteImage,} from "../../utils/cloudinary.utils";

export const getQris = async (req: Request, res: Response) => {
  try {
    if (!paymentConfig.qrisImageUrl) {
      return res.status(503).json({
        message: "Informasi QRIS belum tersedia.",
      });
    }

    return res.status(200).json({
      message: "Informasi QRIS berhasil diambil.",
      data: {
        metodePembayaran: "QRIS",
        qrisImageUrl: paymentConfig.qrisImageUrl,
      },
    });
  } catch (error) {
    console.error("Get QRIS error:", error);

    return res.status(500).json({
      message: "Terjadi kesalahan pada server.",
    });
  }
};


export const uploadPaymentProof = async (
  req: AuthRequest,
  res: Response
) => {
  let newPublicId: string | null = null;

  try {
    const idUser = req.user?.idUser;
    const idBooking = Number(req.params.idBooking);

    if (!idUser) {
      return res.status(401).json({
        message: "Silakan login terlebih dahulu.",
      });
    }

    if (!Number.isSafeInteger(idBooking) || idBooking <= 0) {
      return res.status(400).json({
        message: "ID pemesanan tidak valid.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Bukti pembayaran wajib diunggah.",
      });
    }

    // Cari booking sekaligus memastikan kepemilikannya.
    const [booking] = await db
      .select()
      .from(pemesanan)
      .where(eq(pemesanan.idPemesanan, idBooking))
      .limit(1);

    if (!booking || booking.idUser !== idUser) {
      return res.status(404).json({
        message: "Pemesanan tidak ditemukan.",
      });
    }

    if (
      booking.statusPemesanan !== "awaiting_payment"
    ) {
      return res.status(400).json({
        message: "Pemesanan tidak dapat menerima bukti pembayaran.",
      });
    }

    const [existingPayment] = await db
      .select()
      .from(pembayaran)
      .where(eq(pembayaran.idPemesanan, idBooking))
      .limit(1);

    if (
      existingPayment &&
      existingPayment.statusVerifikasi !== "rejected"
    ) {
      return res.status(400).json({
        message: "Pembayaran sudah dikirim atau sudah disetujui.",
      });
    }

    // Upload bukti baru ke Cloudinary.
    const uploaded = await uploadImage(
      req.file.buffer,
      "barbershop/payments"
    );

    newPublicId = uploaded.publicId;

    if (existingPayment) {
      // Simpan bukti baru pada data pembayaran yang sama.
      await db
        .update(pembayaran)
        .set({
          jumlahBayar: booking.hargaLayanan,
          buktiPembayaranUrl: uploaded.url,
          buktiPembayaranPublicId: uploaded.publicId,
          statusVerifikasi: "pending",
          idKasir: null,
          waktuVerifikasi: null,
          alasanPenolakan: null,
        })
        .where(
          eq(pembayaran.idPembayaran, existingPayment.idPembayaran)
        );

      // Hapus bukti lama setelah database berhasil diperbarui.
      try {
        await deleteImage(existingPayment.buktiPembayaranPublicId);
      } catch (error) {
        console.error("Gagal menghapus bukti lama:", error);
      }
    } else {
      await db.insert(pembayaran).values({
        idPemesanan: idBooking,
        jumlahBayar: booking.hargaLayanan,
        metodePembayaran: "QRIS",
        buktiPembayaranUrl: uploaded.url,
        buktiPembayaranPublicId: uploaded.publicId,
        statusVerifikasi: "pending",
      });
    }

    newPublicId = null;

    // Ubah status booking setelah pembayaran tersimpan.
    await db
      .update(pemesanan)
      .set({
        statusPemesanan: "awaiting_verification",
      })
      .where(eq(pemesanan.idPemesanan, idBooking));

    return res.status(201).json({
      message: "Bukti pembayaran berhasil dikirim dan menunggu verifikasi.",
    });
  } catch (error) {
    // Bersihkan file baru jika proses penyimpanan gagal.
    if (newPublicId) {
      try {
        await deleteImage(newPublicId);
      } catch (deleteError) {
        console.error("Gagal membersihkan file:", deleteError);
      }
    }

    console.error("Upload payment proof error:", error);

    return res.status(500).json({
      message: "Terjadi kesalahan pada server.",
    });
  }
};


export const getPendingPayments = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const results = await db
      .select({
        idPembayaran: pembayaran.idPembayaran,
        idPemesanan: pembayaran.idPemesanan,
        jumlahBayar: pembayaran.jumlahBayar,
        metodePembayaran: pembayaran.metodePembayaran,
        buktiPembayaranUrl: pembayaran.buktiPembayaranUrl,
        statusVerifikasi: pembayaran.statusVerifikasi,
        createdAt: pembayaran.createdAt,

        kodePemesanan: pemesanan.kodePemesanan,
        namaLayanan: pemesanan.namaLayanan,
        tanggalPemesanan: pemesanan.tanggalPemesanan,
        jamMulai: pemesanan.jamMulai,
        jamSelesai: pemesanan.jamSelesai,
        statusPemesanan: pemesanan.statusPemesanan,
      })
      .from(pembayaran)
      .innerJoin(
        pemesanan,
        eq(pembayaran.idPemesanan, pemesanan.idPemesanan)
      )
      .where(eq(pembayaran.statusVerifikasi, "pending"))
      .orderBy(desc(pembayaran.createdAt));

    return res.status(200).json({
      message: "Daftar pembayaran pending berhasil diambil.",
      total: results.length,
      data: results,
    });
  } catch (error) {
    console.error("Get pending payments error:", error);

    return res.status(500).json({
      message: "Terjadi kesalahan pada server.",
    });
  }
};


export const getPaymentById = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const idPembayaran = Number(req.params.id);

    if (!Number.isSafeInteger(idPembayaran) || idPembayaran <= 0) {
      return res.status(400).json({
        message: "ID pembayaran tidak valid.",
      });
    }

    const [result] = await db
      .select({
        idPembayaran: pembayaran.idPembayaran,
        idPemesanan: pembayaran.idPemesanan,
        jumlahBayar: pembayaran.jumlahBayar,
        metodePembayaran: pembayaran.metodePembayaran,
        buktiPembayaranUrl: pembayaran.buktiPembayaranUrl,
        statusVerifikasi: pembayaran.statusVerifikasi,
        idKasir: pembayaran.idKasir,
        waktuVerifikasi: pembayaran.waktuVerifikasi,
        alasanPenolakan: pembayaran.alasanPenolakan,
        createdAt: pembayaran.createdAt,

        kodePemesanan: pemesanan.kodePemesanan,
        idUser: pemesanan.idUser,
        namaLayanan: pemesanan.namaLayanan,
        hargaLayanan: pemesanan.hargaLayanan,
        tanggalPemesanan: pemesanan.tanggalPemesanan,
        jamMulai: pemesanan.jamMulai,
        jamSelesai: pemesanan.jamSelesai,
        statusPemesanan: pemesanan.statusPemesanan,
      })
      .from(pembayaran)
      .innerJoin(
        pemesanan,
        eq(pembayaran.idPemesanan, pemesanan.idPemesanan)
      )
      .where(eq(pembayaran.idPembayaran, idPembayaran))
      .limit(1);

    if (!result) {
      return res.status(404).json({
        message: "Data pembayaran tidak ditemukan.",
      });
    }

    return res.status(200).json({
      message: "Detail pembayaran berhasil diambil.",
      data: result,
    });
  } catch (error) {
    console.error("Get payment detail error:", error);

    return res.status(500).json({
      message: "Terjadi kesalahan pada server.",
    });
  }
};


export const verifyPayment = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const idKasir = req.user?.idUser;
    const idPembayaran = Number(req.params.id);
    const { keputusan, alasanPenolakan } = req.body;

    if (!idKasir) {
      return res.status(401).json({
        message: "Silakan login terlebih dahulu.",
      });
    }

    if (
      !Number.isSafeInteger(idPembayaran) ||
      idPembayaran <= 0
    ) {
      return res.status(400).json({
        message: "ID pembayaran tidak valid.",
      });
    }

    if (!["approved", "rejected"].includes(keputusan)) {
      return res.status(400).json({
        message: "Keputusan harus approved atau rejected.",
      });
    }

    if (
      keputusan === "rejected" &&
      (typeof alasanPenolakan !== "string" ||
        !alasanPenolakan.trim())
    ) {
      return res.status(400).json({
        message: "Alasan penolakan wajib diisi.",
      });
    }

    if (
      alasanPenolakan !== undefined &&
      typeof alasanPenolakan !== "string"
    ) {
      return res.status(400).json({
        message: "Alasan penolakan harus berupa teks.",
      });
    }

    await db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(pembayaran)
        .where(eq(pembayaran.idPembayaran, idPembayaran))
        .limit(1)
        .for("update");

      if (!payment) {
        throw new Error("PAYMENT_NOT_FOUND");
      }

      if (payment.statusVerifikasi !== "pending") {
        throw new Error("PAYMENT_ALREADY_VERIFIED");
      }

      const [booking] = await tx
        .select()
        .from(pemesanan)
        .where(
          eq(pemesanan.idPemesanan, payment.idPemesanan)
        )
        .limit(1)
        .for("update");

      if (!booking) {
        throw new Error("BOOKING_NOT_FOUND");
      }

      if (booking.statusPemesanan !== "awaiting_verification") {
        throw new Error("BOOKING_STATUS_INVALID");
      }

      await tx
        .update(pembayaran)
        .set({
          statusVerifikasi: keputusan,
          idKasir,
          waktuVerifikasi: new Date(),
          alasanPenolakan:
            keputusan === "rejected"
              ? alasanPenolakan.trim()
              : null,
        })
        .where(
          eq(pembayaran.idPembayaran, idPembayaran)
        );

      await tx
        .update(pemesanan)
        .set({
          statusPemesanan:
            keputusan === "approved"
              ? "confirmed"
              : "awaiting_payment",
        })
        .where(
          eq(pemesanan.idPemesanan, payment.idPemesanan)
        );
    });

    return res.status(200).json({
      message:
        keputusan === "approved"
          ? "Pembayaran berhasil disetujui. Booking telah dikonfirmasi."
          : "Pembayaran ditolak. Customer dapat mengunggah bukti baru.",
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PAYMENT_NOT_FOUND") {
        return res.status(404).json({
          message: "Pembayaran tidak ditemukan.",
        });
      }

      if (error.message === "PAYMENT_ALREADY_VERIFIED") {
        return res.status(400).json({
          message: "Pembayaran sudah diverifikasi sebelumnya.",
        });
      }

      if (error.message === "BOOKING_NOT_FOUND") {
        return res.status(404).json({
          message: "Data pemesanan tidak ditemukan.",
        });
      }

      if (error.message === "BOOKING_STATUS_INVALID") {
        return res.status(400).json({
          message: "Status pemesanan tidak sesuai untuk verifikasi.",
        });
      }
    }

    console.error("Verify payment error:", error);

    return res.status(500).json({
      message: "Terjadi kesalahan pada server.",
    });
  }
};



