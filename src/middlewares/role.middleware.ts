import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";

type UserRole = "customer" | "admin" | "kasir";

export function authorizeRole(...allowedRoles: UserRole[]) {
    return (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        const authReq = req as AuthRequest;

        if (!authReq.user) {
            return res.status(401).json({
                message: "Autentikasi diperlukan.",
            });
        }

        if (!allowedRoles.includes(authReq.user.role)) {
            return res.status(403).json({
                message: "Kamu tidak memiliki izin untuk mengakses fitur ini.",
            });
        }

        next();
    };
}
