import multer from "multer";

const storage = multer.memoryStorage();

const imageFilter: multer.Options["fileFilter"] = (
    _req,
    file,
    callback
) => {
    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
        return callback(
            new Error("Foto harus berformat JPG, PNG, atau WEBP")
        );
    }

    callback(null, true);
};

const upload = multer({
    storage,
    limits: {
        fileSize: 2 * 1024 * 1024,
    },
    fileFilter: imageFilter,
});

export const uploadBarberPhoto = upload.single("foto");
export const uploadServicePhoto = upload.single("foto");
