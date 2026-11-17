
import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../config/db";
import { users } from "../config/schema";

async function createAdmin() {
    try {
        const name = process.env.ADMIN_NAME;
        const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
        const password = process.env.ADMIN_PASSWORD;

        // Validasi environment
        if (!name || !email || !password) {
            throw new Error("ADMIN_NAME, ADMIN_EMAIL, dan ADMIN_PASSWORD wajib diisi di .env");
        }

        if (password.length < 8) {
            throw new Error("Password admin minimal 8 karakter");
        }

        // Cek apakah email sudah terdaftar
        const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.email, email));

        if (existingUser.length > 0) {
            console.log("Akun dengan email tersebut sudah terdaftar.");
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Simpan akun admin
        await db.insert(users).values({
            name,
            email,
            password: hashedPassword,
            no_telepon: null,
            role: "admin",
        });

        console.log("Akun admin berhasil dibuat.");
        console.log("Email:", email);
    } catch (error) {
        console.error("Gagal membuat admin:", error);
        process.exitCode = 1;
    } finally {
        process.exit();
    }
}

createAdmin();
