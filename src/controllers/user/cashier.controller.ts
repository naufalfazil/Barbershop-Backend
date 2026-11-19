import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { desc, eq } from "drizzle-orm";

import { db } from "../../config/db";
import { users } from "../../config/schema";

export const createCashier = async (req: Request, res: Response) => {
  try {
    const { name, email, password, no_telepon } = req.body;

    // Validasi input
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Nama, email, dan password wajib diisi.",
      });
    }

    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        message: "Password minimal 8 karakter.",
      });
    }

    // Cek email
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(409).json({
        message: "Email sudah digunakan.",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Simpan akun kasir
    await db.insert(users).values({
      name,
      email,
      password: hashedPassword,
      no_telepon: no_telepon || null,
      role: "kasir",
      statusAktif: 1,
    });

    return res.status(201).json({
      message: "Akun kasir berhasil dibuat.",
    });
  } catch (error) {
    console.error("Create cashier error:", error);

    return res.status(500).json({
      message: "Terjadi kesalahan pada server.",
    });
  }
};


export const getCashiers = async (req: Request, res: Response) => {
  try {
    const cashierList = await db
      .select({
        idUser: users.idUser,
        name: users.name,
        email: users.email,
        no_telepon: users.no_telepon,
        statusAktif: users.statusAktif,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.role, "kasir"))
      .orderBy(desc(users.createdAt));

    return res.status(200).json({
      message: "Daftar kasir berhasil diambil.",
      data: cashierList,
    });
  } catch (error) {
    console.error("Get cashiers error:", error);

    return res.status(500).json({
      message: "Terjadi kesalahan pada server.",
    });
  }
};


export const updateCashierStatus = async (req: Request, res: Response) => {
  try {
    const idUser = Number(req.params.id);
    const { statusAktif } = req.body;

    if (!Number.isSafeInteger(idUser) || idUser <= 0) {
      return res.status(400).json({
        message: "ID kasir tidak valid.",
      });
    }

    if (statusAktif !== 0 && statusAktif !== 1) {
      return res.status(400).json({
        message: "statusAktif harus bernilai 0 atau 1.",
      });
    }

    const cashier = await db
      .select()
      .from(users)
      .where(eq(users.idUser, idUser))
      .limit(1);

    if (cashier.length === 0 || cashier[0].role !== "kasir") {
      return res.status(404).json({
        message: "Akun kasir tidak ditemukan.",
      });
    }

    await db
      .update(users)
      .set({ statusAktif })
      .where(eq(users.idUser, idUser));

    return res.status(200).json({
      message: statusAktif === 1
        ? "Akun kasir berhasil diaktifkan."
        : "Akun kasir berhasil dinonaktifkan.",
    });
  } catch (error) {
    console.error("Update cashier status error:", error);

    return res.status(500).json({
      message: "Terjadi kesalahan pada server.",
    });
  }
};
