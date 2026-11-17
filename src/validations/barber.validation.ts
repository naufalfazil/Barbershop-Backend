import { z } from "zod";

export const createBarberSchema = z.object({
    namaPegawai: z.string() .trim() .min(1, "Nama barber wajib diisi"),
    deskripsi: z.string() .trim() .nullable() .optional(),
});

export const updateBarberSchema = createBarberSchema;

export const updateBarberStatusSchema = z.object({
    statusAktif: z.coerce
        .number()
        .int()
        .refine(
            (value) => value === 0 || value === 1,
            "Status harus 0 (nonaktif) atau 1 (aktif)"
        ),
});