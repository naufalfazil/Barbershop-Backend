import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

interface TokenPayload extends JwtPayload {
    idUser: number;
    role: "customer" | "admin" | "kasir";
}

export interface AuthRequest extends Request {
    user?: TokenPayload;
}

export function authenticateToken(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Token tidak ditemukan. Silakan login.",
            });
        }

        const token = authHeader.split(" ")[1];
        const secret = process.env.JWT_SECRET;

        if (!secret) {
            console.error("JWT_SECRET belum diatur.");
            return res.status(500).json({
                message: "Konfigurasi server belum lengkap.",
            });
        }

        const decoded = jwt.verify(token, secret);

        if (
            typeof decoded === "string" ||
            typeof decoded.idUser !== "number" ||
            !["customer", "admin", "kasir"].includes(decoded.role as string)
        ) {
            return res.status(401).json({
                message: "Token tidak valid.",
            });
        }

        (req as AuthRequest).user = decoded as TokenPayload;

        next();
    } catch (error) {
        return res.status(401).json({
            message: "Token tidak valid atau sudah kedaluwarsa.",
        });
    }
}
