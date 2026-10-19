const multer = require("multer");
const path = require("path");

// Memory storage to stream directly to Cloudinary
const storage = multer.memoryStorage();

// File filter: Strictly validate JPEG format
const jpegFileFilter = (req, file, cb) => {
    const mime = (file.mimetype || "").toLowerCase();
    const ext = path.extname(file.originalname || "").toLowerCase();

    const isJpegMime = mime === "image/jpeg" || mime === "image/jpg" || mime === "image/pjpeg";
    const isJpegExt = ext === ".jpg" || ext === ".jpeg";

    if (isJpegMime || isJpegExt) {
        cb(null, true);
    } else {
        const error = new Error("Invalid file format! Only JPEG images (.jpg, .jpeg) are supported for student photograph.");
        error.code = "INVALID_FILE_TYPE";
        cb(error, false);
    }
};

// 5MB limit
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB max
    },
    fileFilter: jpegFileFilter
});

// Express middleware wrapper to capture Multer errors and return clean JSON
const handlePhotoUpload = (fieldName = "photo") => {
    const singleUpload = upload.single(fieldName);

    return (req, res, next) => {
        singleUpload(req, res, (err) => {
            if (err) {
                if (err.code === "LIMIT_FILE_SIZE") {
                    return res.status(400).json({
                        message: "Photograph exceeds maximum allowed file size. Maximum size is 5MB."
                    });
                }
                if (err.code === "INVALID_FILE_TYPE" || err.message?.includes("JPEG")) {
                    return res.status(400).json({
                        message: err.message || "Invalid file format! Only JPEG images (.jpg, .jpeg) are supported."
                    });
                }
                return res.status(400).json({
                    message: err.message || "Error processing image upload."
                });
            }
            next();
        });
    };
};

module.exports = {
    handlePhotoUpload,
    upload
};
