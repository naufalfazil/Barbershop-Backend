
import { z } from "zod";

export const registerSchema = z.object({
    name: z.string().trim().min(1, "Nama wajib diisi"),
    email: z.string().trim().email("Format email tidak valid"),
    password: z.string().min(8, "Password minimal 8 karakter"),
    no_telepon: z.string().trim().max(20, "Nomor telepon maksimal 20 karakter").optional().nullable(),
});

export const loginSchema = z.object({
    email: z.string().trim().email("Format email tidak valid"),
    password: z.string().min(1, "Password wajib diisi"),
});
