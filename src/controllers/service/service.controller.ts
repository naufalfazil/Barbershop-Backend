
import { Request, Response } from "express";
import { eq, ne } from "drizzle-orm";
import { db } from "../../config/db";
import { layanan } from "../../config/schema";

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

            const result = await db.insert(layanan).values({
                namaLayanan: namaLayanan.trim(),
                deskripsi: deskripsi ?? null,
                harga: String(harga),
                durasiMenit: Number(durasiMenit),
                status: "published",
            });

            return res.status(201).json({
                message: "Layanan berhasil ditambahkan",
                id: result[0].insertId,
            });
        } catch (error) {
            console.error("Create service error:", error);

            return res.status(500).json({
                message: "Gagal menambahkan layanan",
            });
        }
    }

    // PUT: Mengubah seluruh data layanan
    async update(req: Request, res: Response) {
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

            if (existing.length === 0 || existing[0].status === "deleted") {
                return res.status(404).json({
                    message: "Layanan tidak ditemukan",
                });
            }

            await db
                .update(layanan)
                .set({
                    namaLayanan: namaLayanan.trim(),
                    deskripsi: deskripsi ?? null,
                    harga: String(harga),
                    durasiMenit: Number(durasiMenit),
                })
                .where(eq(layanan.idLayanan, id));

            return res.status(200).json({
                message: "Layanan berhasil diperbarui",
            });
        } catch (error) {
            console.error("Update service error:", error);

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

            if (existing.length === 0 || existing[0].status === "deleted") {
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
    async delete(req: Request, res: Response) {
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
                .where(eq(layanan.idLayanan, id));

            if (existing.length === 0 || existing[0].status === "deleted") {
                return res.status(404).json({
                    message: "Layanan tidak ditemukan",
                });
            }

            await db
                .update(layanan)
                .set({ status: "deleted" })
                .where(eq(layanan.idLayanan, id));

            return res.status(200).json({
                message: "Layanan berhasil dihapus",
            });
        } catch (error) {
            console.error("Delete service error:", error);

            return res.status(500).json({
                message: "Gagal menghapus layanan",
            });
        }
    }
}

export default new ServiceController();
