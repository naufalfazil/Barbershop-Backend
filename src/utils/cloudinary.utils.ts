
import cloudinary from "../config/cloudinary";

export function uploadImage(
    buffer: Buffer,
    folder: string
): Promise<{ url: string; publicId: string }> {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: "image",
            },
            (error, result) => {
                if (error) return reject(error);

                if (!result) {
                    return reject(new Error("Upload foto gagal"));
                }

                resolve({
                    url: result.secure_url,
                    publicId: result.public_id,
                });
            }
        );

        stream.end(buffer);
    });
}

export async function deleteImage(publicId: string) {
    return cloudinary.uploader.destroy(publicId);
}
