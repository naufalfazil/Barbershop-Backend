import { z } from "zod";

// Validasi data layanan saat membuat layanan
export const createServiceSchema = z.object({
    namaLayanan: z.string().trim().min(1, "Nama layanan wajib diisi").max(100, "Nama layanan maksimal 100 karakter"),
    deskripsi: z.string().trim().nullable().optional(),
    harga: z.coerce.number().positive("Harga harus lebih dari 0").finite("Harga harus berupa angka valid"),
    durasiMenit: z.coerce.number().int("Durasi harus berupa bilangan bulat").positive("Durasi harus lebih dari 0"),
});

// Validasi data saat mengubah layanan
export const updateServiceSchema = createServiceSchema;

// Validasi saat mengubah status layanan
export const updateServiceStatusSchema = z.object({
    status: z.enum(["published", "unavailable"], {
        error: "Status harus published atau unavailable",
    }),
});
