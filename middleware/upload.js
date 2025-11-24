// middleware/upload.js
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
require('dotenv').config();

// 🛑 FIX: Change the import to capture the default export of the module.
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Debug
console.log('CloudinaryStorage loaded:', !!CloudinaryStorage);

// Cloudinary config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
        const userId = req.session.userId || req.user?._id || 'unknown';

        // Dynamic folder
        let folder = 'sharecase/unknown';
        switch (file.fieldname) {
            case 'image':         folder = 'sharecase/projects'; break;
            case 'artworkImage':  folder = 'sharecase/artwork'; break;
            case 'CADFile':       folder = 'sharecase/cad'; break;
            case 'profilePic':    folder = 'sharecase/profiles'; break;
        }

        // --- Simplified and Safer Public ID Generation ---
        // Take the first part of the original filename, sanitize it, and limit its length
        const baseId = file.originalname.split('.')[0].replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 20); 
        // Construct the public ID using field name, user ID, short base name, and a unique timestamp
        const public_id = `${file.fieldname}-${userId}-${baseId}-${Date.now()}`;
        // --- End simplification ---

        // Dynamic file extension/format
        const ext = file.originalname.includes('.') 
            ? file.originalname.split('.').pop().toLowerCase() 
            : 'file';
        
        // Resource type
        const resource_type = file.fieldname === 'CADFile' ? 'raw' : 'image';

        // Format & transformation
        const format = resource_type === 'raw' ? null : ext;
        const transformation = file.fieldname === 'profilePic'
            ? [{ width: 500, height: 500, crop: 'fill', gravity: 'face' }]
            : [];

        // 🛑 CRITICAL DEBUG LOG
        const uploadParams = {
            folder,
            public_id,
            format,
            resource_type,
            transformation,
        };
        console.log('--- Cloudinary Params Generated ---', uploadParams);

        return uploadParams;
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB safe max
    fileFilter: (req, file, cb) => {
        console.log(`Multer Received Field: ${file.fieldname} | Type: ${file.mimetype} | Size: ${file.size || 'streaming'} | Name: ${file.originalname}`);

        const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        const allowedCAD = /\.(glb|gltf|obj|stl|step)$/i;

        if (['image', 'artworkImage', 'profilePic'].includes(file.fieldname)) {
            if (!allowedImageTypes.includes(file.mimetype)) {
                return cb(new Error('Invalid image type. Only JPEG, PNG, GIF, WEBP allowed.'), false);
            }
            if (file.size > 3 * 1024 * 1024) {
                return cb(new Error('Image too large. Max 3MB.'), false);
            }
        }

        if (file.fieldname === 'CADFile') {
            if (!allowedCAD.test(file.originalname)) {
                return cb(new Error('Only .glb, .gltf, .obj, .stl, .step allowed for CAD.'), false);
            }
            if (file.size > 12 * 1024 * 1024) {
                return cb(new Error('CAD file too large. Max 12MB.'), false);
            }
        }

        cb(null, true);
    }
});

module.exports = upload;