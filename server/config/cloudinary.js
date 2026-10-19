const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const path = require("path");

// Configure Cloudinary from environment variables (trimmed for safety)
cloudinary.config({
    cloud_name: (process.env.CLOUDINARY_CLOUD_NAME || "").trim(),
    api_key: (process.env.CLOUDINARY_API_KEY || "").trim(),
    api_secret: (process.env.CLOUDINARY_API_SECRET || "").trim(),
    secure: true
});

/**
 * Check if Cloudinary credentials are fully configured in environment
 */
const isCloudinaryConfigured = () => {
    return Boolean(
        (process.env.CLOUDINARY_CLOUD_NAME || "").trim() &&
        (process.env.CLOUDINARY_API_KEY || "").trim() &&
        (process.env.CLOUDINARY_API_SECRET || "").trim()
    );
};

/**
 * Upload a JPEG image buffer to Cloudinary
 * (With automatic fallback to local /uploads directory if Cloudinary credentials are not configured)
 * 
 * @param {Buffer} fileBuffer - Image file buffer from Multer memoryStorage
 * @param {string} originalName - Original filename
 * @param {string} folder - Target folder in Cloudinary (default: 'smart_exam_students')
 * @returns {Promise<{ url: string, public_id: string, provider: 'cloudinary' | 'local' }>}
 */
const uploadStudentImage = (fileBuffer, originalName, folder = "smart_exam_students") => {
    return new Promise((resolve, reject) => {
        // If Cloudinary is configured, upload directly to Cloudinary
        if (isCloudinaryConfigured()) {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: folder,
                    resource_type: "image",
                    format: "jpg", // Force JPEG format
                    transformation: [
                        { width: 600, height: 750, crop: "limit", quality: "auto:good" }
                    ]
                },
                (error, result) => {
                    if (error) {
                        console.error("[Cloudinary] Upload error:", error);
                        // Fallback to local storage if Cloudinary network or auth fails
                        try {
                            const fallbackResult = saveToLocalStorage(fileBuffer, originalName);
                            return resolve(fallbackResult);
                        } catch (err) {
                            return reject(error);
                        }
                    }
                    resolve({
                        url: result.secure_url,
                        public_id: result.public_id,
                        provider: "cloudinary"
                    });
                }
            );

            uploadStream.end(fileBuffer);
        } else {
            // Local fallback when Cloudinary API keys are not yet provided
            try {
                const localResult = saveToLocalStorage(fileBuffer, originalName);
                resolve(localResult);
            } catch (err) {
                reject(err);
            }
        }
    });
};

/**
 * Delete image from Cloudinary or local storage by public_id
 * 
 * @param {string} publicId - Cloudinary public_id or local identifier
 * @returns {Promise<{ result: string }>}
 */
const deleteStudentImage = async (publicId) => {
    if (!publicId) return { result: "not_found" };

    try {
        if (publicId.startsWith("local_fallback_")) {
            // Remove local file
            const filename = publicId.replace("local_fallback_", "");
            const filePath = path.join(__dirname, "../uploads", filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            return { result: "ok" };
        }

        if (isCloudinaryConfigured()) {
            return await cloudinary.uploader.destroy(publicId);
        }

        return { result: "skipped" };
    } catch (err) {
        console.warn("[Cloudinary] Delete warning:", err.message);
        return { result: "error", error: err.message };
    }
};

/**
 * Helper to save buffer to local uploads directory (fallback)
 */
const saveToLocalStorage = (fileBuffer, originalName) => {
    const uploadsDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const ext = path.extname(originalName) || ".jpg";
    const filename = `student_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
    const filePath = path.join(uploadsDir, filename);

    fs.writeFileSync(filePath, fileBuffer);

    return {
        url: `/uploads/${filename}`,
        public_id: `local_fallback_${filename}`,
        provider: "local"
    };
};

module.exports = {
    cloudinary,
    isCloudinaryConfigured,
    uploadStudentImage,
    deleteStudentImage
};
