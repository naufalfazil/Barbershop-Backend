import { z } from "zod";

export const createBookingSchema = z.object({
    idPegawai: z.coerce
        .number()
        .int("ID barber harus berupa bilangan bulat")
        .positive("ID barber tidak valid"),

    idLayanan: z.coerce
        .number()
        .int("ID layanan harus berupa bilangan bulat")
        .positive("ID layanan tidak valid"),

    tanggalPemesanan: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),

    jamMulai: z.string()
        .regex(
            /^([01]\d|2[0-3]):[0-5]\d$/,
            "Format jam harus HH:mm"
        ),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
