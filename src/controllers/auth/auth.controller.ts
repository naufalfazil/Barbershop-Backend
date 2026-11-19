import { Request, Response } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { db } from "../../config/db";
import { users } from "../../config/schema";

class AuthController {
    // REGISTER
    async register(req: Request, res: Response) {
        try {
            const { name, email, password, no_telepon } = req.body;

            // Validasi input
            if (!name || !email || !password) {
                return res.status(400).json({
                    message: "Nama, email, dan password wajib diisi",
                });
            }

            if (
                typeof name !== "string" ||
                typeof email !== "string" ||
                typeof password !== "string"
            ) {
                return res.status(400).json({
                    message: "Format input tidak valid",
                });
            }

            if (password.length < 8) {
                return res.status(400).json({
                    message: "Password minimal 8 karakter",
                });
            }

            const emailNormalized = email.trim().toLowerCase();

            // Validasi format email sederhana
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalized)) {
                return res.status(400).json({
                    message: "Format email tidak valid",
                });
            }

            // Cek apakah email sudah digunakan
            const existingUser = await db
                .select()
                .from(users)
                .where(eq(users.email, emailNormalized));

            if (existingUser.length > 0) {
                return res.status(409).json({
                    message: "Email sudah terdaftar",
                });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 12);

            // Simpan user baru
            const result = await db.insert(users).values({
                name: name.trim(),
                email: emailNormalized,
                password: hashedPassword,
                no_telepon: no_telepon ?? null,
                role: "customer",
            });

            return res.status(201).json({
                message: "Registrasi berhasil",
                idUser: Number(result[0].insertId),
            });
        } catch (error) {
            console.error("Register error:", error);

            return res.status(500).json({
                message: "Terjadi kesalahan pada server",
            });
        }
    }

    // LOGIN
    async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    message: "Email dan password wajib diisi",
                });
            }

            if (
                typeof email !== "string" ||
                typeof password !== "string"
            ) {
                return res.status(400).json({
                    message: "Format input tidak valid",
                });
            }

            const emailNormalized = email.trim().toLowerCase();

            // Cari user berdasarkan email
            const result = await db
                .select()
                .from(users)
                .where(eq(users.email, emailNormalized));

            if (result.length === 0) {
                return res.status(401).json({
                    message: "Email atau password salah",
                });
            }

            const user = result[0];

            // Periksa apakah akun masih aktif
            if (user.statusAktif !== 1) {
                return res.status(403).json({
                    message: "Akun anda sedang dinonaktifkan. Hubungi admin.",
                });
            }

            // Bandingkan password dengan hash di database
            const passwordMatch = await bcrypt.compare(
                password,
                user.password
            );

            if (!passwordMatch) {
                return res.status(401).json({
                    message: "Email atau password salah",
                });
            }

            // Ambil JWT secret dari environment
            const jwtSecret = process.env.JWT_SECRET;

            if (!jwtSecret) {
                console.error("JWT_SECRET belum diatur");

                return res.status(500).json({
                    message: "Konfigurasi server belum lengkap",
                });
            }

            // Buat token JWT
            const expiresIn = (process.env.JWT_EXPIRES_IN ||
                "1d") as SignOptions["expiresIn"];

            
            const token = jwt.sign(
                {
                    idUser: user.idUser,
                    role: user.role,
                },
                jwtSecret,
                { expiresIn }
            );

            return res.status(200).json({
                message: "Login berhasil",
                token,
                user: {
                    idUser: user.idUser,
                    name: user.name,
                    email: user.email,
                    no_telepon: user.no_telepon,
                    role: user.role,
                },
            });
        } catch (error) {
            console.error("Login error:", error);

            return res.status(500).json({
                message: "Terjadi kesalahan pada server",
            });
        }
    }
}

export default new AuthController();
