const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary (Keep this part for credentials)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage for all file uploads
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        if (!file) {
            return {};
        }

        // Determine upload type: Check for the hidden form field 'uploadType' 
        // that the project form should send. Default to profile if not present.
        const isProjectUpload = req.body.uploadType === 'project';

        let options = {
            format: 'auto' // Use auto to determine the best format
        };

        if (isProjectUpload) {
            // === PROJECT IMAGE LOGIC (Saves Original Size) ===
            options.folder = 'sharecase/projects';
            // Generate a unique public ID
            options.public_id = `project-${req.session.userId || Date.now()}-${file.originalname.split('.')[0]}`;
            // 🛑 FIX: Omit the 'transformation' property entirely to save the original file.
        } else {
            // === PROFILE PICTURE LOGIC (Requires 500x500 Crop) ===
            options.folder = 'sharecase/profiles';
            // Generate a unique public ID (using 'profile' prefix as before)
            options.public_id = `profile-${req.session.userId || Date.now()}`;
            // Add the fixed transformation for consistency in profile thumbnails
            options.transformation = [{ width: 500, height: 500, crop: 'fill' }]; 
        }

        console.log(`Uploading to: ${options.folder}, applying transformation: ${options.transformation ? '500x500' : 'none'}`);

        return options;
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
        // Allow no file to be uploaded (e.g., if just updating text fields)
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