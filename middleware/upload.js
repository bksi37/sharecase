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
            return {};
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

// Multer instance
const uploadFile = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB
        files: 1
    },
    fileFilter: (req, file, cb) => {
        console.log('File filter:', { file: file ? file.mimetype : 'no file' });
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

module.exports = uploadFile;