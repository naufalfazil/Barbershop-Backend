
import { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../config/db";
import { layanan } from "../../config/schema";
import {
    uploadImage,
    deleteImage,
} from "../../utils/cloudinary.utils";

class ServiceController {

    // GET: Menampilkan semua layanan published
    async getAll(req: Request, res: Response) {
        try {
            const data = await db
                .select()
                .from(layanan)
                .where(eq(layanan.status, "published"));

            return res.status(200).json({
                message: "Data layanan berhasil diambil",
                data,
            });
        } catch (error) {
            console.error("Get services error:", error);

            return res.status(500).json({
                message: "Gagal mengambil data layanan",
            });
        }
    }

    // GET: Menampilkan detail layanan berdasarkan ID
    async getById(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);

            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({
                    message: "ID layanan tidak valid",
                });
            }

            const data = await db
                .select()
                .from(layanan)
                .where(eq(layanan.idLayanan, id));

            if (data.length === 0 || data[0].status === "deleted") {
                return res.status(404).json({
                    message: "Layanan tidak ditemukan",
                });
            }

            return res.status(200).json({
                message: "Detail layanan berhasil diambil",
                data: data[0],
            });
        } catch (error) {
            console.error("Get service detail error:", error);

            return res.status(500).json({
                message: "Gagal mengambil detail layanan",
            });
        }
    }

    // POST: Menambahkan layanan baru
    async create(req: Request, res: Response) {
        let uploadedImage: {
            url: string;
            publicId: string;
        } | null = null;

        try {
            const {
                namaLayanan,
                deskripsi,
                harga,
                durasiMenit,
            } = req.body;

            if (
                typeof namaLayanan !== "string" ||
                namaLayanan.trim() === "" ||
                (deskripsi !== undefined &&
                    deskripsi !== null &&
                    typeof deskripsi !== "string") ||
                harga === undefined ||
                harga === null ||
                !Number.isFinite(Number(harga)) ||
                Number(harga) <= 0 ||
                !Number.isInteger(Number(durasiMenit)) ||
                Number(durasiMenit) <= 0
            ) {
                return res.status(400).json({
                    message: "Data layanan tidak valid",
                });
            }

            // Upload foto jika admin mengirim file
            if (req.file) {
                uploadedImage = await uploadImage(
                    req.file.buffer,
                    "barbershop/services"
                );
            }

            const result = await db.insert(layanan).values({
                namaLayanan: namaLayanan.trim(),
                deskripsi: deskripsi ?? null,
                harga: String(harga),
                durasiMenit: Number(durasiMenit),
                fotoUrl: uploadedImage?.url ?? null,
                fotoPublicId: uploadedImage?.publicId ?? null,
                status: "published",
            });

            return res.status(201).json({
                message: "Layanan berhasil ditambahkan",
                id: Number(result[0].insertId),
                fotoUrl: uploadedImage?.url ?? null,
            });
        } catch (error) {
            console.error("Create service error:", error);

            // Bersihkan foto jika database gagal menyimpan
            if (uploadedImage) {
                try {
                    await deleteImage(uploadedImage.publicId);
                } catch (deleteError) {
                    console.error(
                        "Gagal membersihkan foto Cloudinary:",
                        deleteError
                    );
                }
            }

            return res.status(500).json({
                message: "Gagal menambahkan layanan",
            });
        }
    }

    // PUT: Mengubah seluruh data layanan
    async update(req: Request, res: Response) {
        let uploadedImage: {
            url: string;
            publicId: string;
        } | null = null;

        let oldPublicId: string | null = null;
        let databaseUpdated = false;

        try {
            const id = Number(req.params.id);

            const {
                namaLayanan,
                deskripsi,
                harga,
                durasiMenit,
            } = req.body;

            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({
                    message: "ID layanan tidak valid",
                });
            }

            if (
                typeof namaLayanan !== "string" ||
                namaLayanan.trim() === "" ||
                (deskripsi !== undefined &&
                    deskripsi !== null &&
                    typeof deskripsi !== "string") ||
                harga === undefined ||
                harga === null ||
                !Number.isFinite(Number(harga)) ||
                Number(harga) <= 0 ||
                !Number.isInteger(Number(durasiMenit)) ||
                Number(durasiMenit) <= 0
            ) {
                return res.status(400).json({
                    message: "Data layanan tidak valid",
                });
            }

            const existing = await db
                .select()
                .from(layanan)
                .where(eq(layanan.idLayanan, id));

            if (
                existing.length === 0 ||
                existing[0].status === "deleted"
            ) {
                return res.status(404).json({
                    message: "Layanan tidak ditemukan",
                });
            }

            oldPublicId = existing[0].fotoPublicId;

            // Upload foto baru jika admin mengirim file
            if (req.file) {
                uploadedImage = await uploadImage(
                    req.file.buffer,
                    "barbershop/services"
                );
            }

            await db
                .update(layanan)
                .set({
                    namaLayanan: namaLayanan.trim(),
                    deskripsi: deskripsi ?? null,
                    harga: String(harga),
                    durasiMenit: Number(durasiMenit),

                    // Jika tidak ada foto baru, pertahankan foto lama
                    ...(uploadedImage && {
                        fotoUrl: uploadedImage.url,
                        fotoPublicId: uploadedImage.publicId,
                    }),
                })
                .where(eq(layanan.idLayanan, id));

            databaseUpdated = true;

            // Hapus foto lama setelah database berhasil diperbarui
            if (uploadedImage && oldPublicId) {
                try {
                    await deleteImage(oldPublicId);
                } catch (deleteError) {
                    console.error(
                        "Gagal menghapus foto lama:",
                        deleteError
                    );
                }
            }

            return res.status(200).json({
                message: "Layanan berhasil diperbarui",
                fotoUrl: uploadedImage?.url ?? existing[0].fotoUrl,
            });
        } catch (error) {
            console.error("Update service error:", error);

            // Jika database belum berhasil diperbarui,
            // hapus foto baru yang telanjur diunggah
            if (uploadedImage && !databaseUpdated) {
                try {
                    await deleteImage(uploadedImage.publicId);
                } catch (deleteError) {
                    console.error(
                        "Gagal membersihkan foto baru:",
                        deleteError
                    );
                }
            }

            return res.status(500).json({
                message: "Gagal memperbarui layanan",
            });
        }
    }

    // PATCH: Mengubah status layanan
    async updateStatus(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);
            const { status } = req.body;

            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({
                    message: "ID layanan tidak valid",
                });
            }

            if (
                status !== "published" &&
                status !== "unavailable"
            ) {
                return res.status(400).json({
                    message: "Status harus published atau unavailable",
                });
            }

            const existing = await db
                .select()
                .from(layanan)
                .where(eq(layanan.idLayanan, id));

            if (
                existing.length === 0 ||
                existing[0].status === "deleted"
            ) {
                return res.status(404).json({
                    message: "Layanan tidak ditemukan",
                });
            }

            await db
                .update(layanan)
                .set({ status })
                .where(eq(layanan.idLayanan, id));

            return res.status(200).json({
                message: status === "published"
                    ? "Layanan berhasil diaktifkan"
                    : "Layanan berhasil dinonaktifkan",
            });
        } catch (error) {
            console.error("Update service status error:", error);

            return res.status(500).json({
                message: "Gagal mengubah status layanan",
            });
        }
    }

    // DELETE: Soft delete layanan
    delete = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                message: "ID layanan tidak valid",
            });
        }

        const existing = await db
            .select()
            .from(layanan)
            .where(eq(layanan.idLayanan, id))
            .limit(1);

        if (existing.length === 0 || existing[0].status === "deleted") {
            return res.status(404).json({
                message: "Layanan tidak ditemukan",
            });
        }

        // Tandai layanan sebagai deleted di database.
        await db
            .update(layanan)
            .set({
                status: "deleted",
                updatedAt: new Date(),
            })
            .where(eq(layanan.idLayanan, id));

        // Hapus foto dari Cloudinary jika layanan memiliki foto.
        if (existing[0].fotoPublicId) {
            try {
                await deleteImage(existing[0].fotoPublicId);
            } catch (error) {
                console.error("Gagal menghapus foto layanan dari Cloudinary:", error);

                return res.status(200).json({
                    message: "Layanan berhasil dihapus, tetapi foto gagal dihapus dari Cloudinary",
                });
            }
        }

        return res.status(200).json({
            message: "Layanan dan fotonya berhasil dihapus",
        });
    } catch (error) {
        console.error("Delete service error:", error);

        return res.status(500).json({
            message: "Terjadi kesalahan pada server",
        });
    }
};
}

export default new ServiceController();
