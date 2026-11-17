import { Request, Response } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "../../config/db";
import { pegawaiBarber } from "../../config/schema";
import { uploadImage, deleteImage } from "../../utils/cloudinary.utils";

class BarberController {
    // GET /api/barbers
    getAll = async (req: Request, res: Response) => {
        try {
            const data = await db
                .select()
                .from(pegawaiBarber)
                .where(eq(pegawaiBarber.statusAktif, 1))
                .orderBy(desc(pegawaiBarber.createdAt));

            return res.status(200).json({
                message: "Berhasil mengambil data barber",
                data,
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                message: "Gagal mengambil data barber",
            });
        }
    };

    // GET /api/barbers/:id
    getById = async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);

            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({
                    message: "ID barber tidak valid",
                });
            }

            const [barber] = await db
                .select()
                .from(pegawaiBarber)
                .where(eq(pegawaiBarber.idPegawai, id))
                .limit(1);

            if (!barber) {
                return res.status(404).json({
                    message: "Barber tidak ditemukan",
                });
            }

            return res.status(200).json({
                message: "Berhasil mengambil detail barber",
                data: barber,
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                message: "Gagal mengambil detail barber",
            });
        }
    };

    // POST /api/barbers
    create = async (req: Request, res: Response) => {
        let uploadedImage: {
            url: string;
            publicId: string;
        } | null = null;

        try {
            const { namaPegawai, deskripsi } = req.body;

            if (
                typeof namaPegawai !== "string" ||
                namaPegawai.trim() === ""
            ) {
                return res.status(400).json({
                    message: "Nama barber wajib diisi",
                });
            }

            // Upload foto jika file dikirim
            if (req.file) {
                uploadedImage = await uploadImage(
                    req.file.buffer,
                    "barbershop/barbers"
                );
            }

            const result = await db.insert(pegawaiBarber).values({
                namaPegawai: namaPegawai.trim(),
                deskripsi: deskripsi ?? null,
                fotoUrl: uploadedImage?.url ?? null,
                fotoPublicId: uploadedImage?.publicId ?? null,
                statusAktif: 1,
            });

            return res.status(201).json({
                message: "Barber berhasil ditambahkan",
                idPegawai: Number(result[0].insertId),
                fotoUrl: uploadedImage?.url ?? null,
            });
        } catch (error) {
            console.error(error);

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
                message: "Gagal menambahkan barber",
            });
        }
    };

    // PUT /api/barbers/:id
    update = async (req: Request, res: Response) => {
        let uploadedImage: {
            url: string;
            publicId: string;
        } | null = null;

        let oldPublicId: string | null = null;
        let databaseUpdated = false;

        try {
            const id = Number(req.params.id);

            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({
                    message: "ID barber tidak valid",
                });
            }

            const [existing] = await db
                .select()
                .from(pegawaiBarber)
                .where(eq(pegawaiBarber.idPegawai, id))
                .limit(1);

            if (!existing) {
                return res.status(404).json({
                    message: "Barber tidak ditemukan",
                });
            }

            const { namaPegawai, deskripsi } = req.body;

            if (
                typeof namaPegawai !== "string" ||
                namaPegawai.trim() === ""
            ) {
                return res.status(400).json({
                    message: "Nama barber wajib diisi",
                });
            }

            oldPublicId = existing.fotoPublicId;

            // Upload foto baru jika file dikirim
            if (req.file) {
                uploadedImage = await uploadImage(
                    req.file.buffer,
                    "barbershop/barbers"
                );
            }

            await db
                .update(pegawaiBarber)
                .set({
                    namaPegawai: namaPegawai.trim(),
                    deskripsi: deskripsi ?? null,

                    // Jika tidak ada foto baru, pertahankan foto lama
                    ...(uploadedImage && {
                        fotoUrl: uploadedImage.url,
                        fotoPublicId: uploadedImage.publicId,
                    }),
                })
                .where(eq(pegawaiBarber.idPegawai, id));

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
                message: "Data barber berhasil diperbarui",
                fotoUrl: uploadedImage?.url ?? existing.fotoUrl,
            });
        } catch (error) {
            console.error(error);

            // Jika database gagal, hapus foto baru yang telanjur diunggah
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
                message: "Gagal memperbarui data barber",
            });
        }
    };

    // PATCH /api/barbers/:id/status
    updateStatus = async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);

            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({
                    message: "ID barber tidak valid",
                });
            }

            const [existing] = await db
                .select()
                .from(pegawaiBarber)
                .where(eq(pegawaiBarber.idPegawai, id))
                .limit(1);

            if (!existing) {
                return res.status(404).json({
                    message: "Barber tidak ditemukan",
                });
            }

            await db
                .update(pegawaiBarber)
                .set({
                    statusAktif: req.body.statusAktif,
                })
                .where(eq(pegawaiBarber.idPegawai, id));

            return res.status(200).json({
                message: "Status barber berhasil diperbarui",
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                message: "Gagal memperbarui status barber",
            });
        }
    };
}

export default new BarberController();
