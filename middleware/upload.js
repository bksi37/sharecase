// middleware/upload.js - CORRECTED FOR YOUR USE CASE
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log('Cloudinary config:', {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY ? '[set]' : 'missing',
    api_secret: process.env.CLOUDINARY_API_SECRET ? '[set]' : 'missing'
});

// Storage for file uploads
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        console.log('Multer params:', { userId: req.session.userId, file: file ? file.originalname : 'no file' });
        if (!file) {
            console.log('No file provided, skipping upload');
            return {}; // Return empty params to prevent an error when no file is present
        }
        const folderName = 'sharecase/profiles';
        const publicId = `profile-${req.session.userId || Date.now()}-${file.originalname.split('.')[0]}`;
        return {
            folder: folderName,
            format: 'jpg',
            public_id: publicId,
            transformation: [{ width: 500, height: 500, crop: 'fill' }]
        };
    },
});

// Multer instance for file uploads (this is the one you need for profilePic)
const uploadFile = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB
        files: 1
    },
    fileFilter: (req, file, cb) => {
        console.log('File filter called:', { file: file ? file.mimetype : 'no file' });
        // If no file is present, let it pass (Multer will handle it later by not setting req.file)
        if (!file) {
            return cb(null, true);
        }
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Invalid file type'), false);
        }
    }
});

// REMOVE 'uploadText' if you're not using it or if it's not needed for this export
// const uploadText = multer();

// Export the 'uploadFile' instance directly, so 'upload.single' works
module.exports = uploadFile;