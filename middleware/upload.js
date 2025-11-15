const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const CloudinaryStorage = require('multer-storage-cloudinary');
require('dotenv').config();

// Debug: Log the CloudinaryStorage import
console.log('CloudinaryStorage:', CloudinaryStorage);

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Initialize Multer with CloudinaryStorage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    folder: (req, file) => {
        const userIdIdentifier = req.user ? req.user._id : req.session.userId || Date.now();
        switch (file.fieldname) {
            case 'image':
                return 'sharecase/projects';
            case 'artworkImage':
                return 'sharecase/artwork';
            case 'CADFile':
                return 'sharecase/cad';
            case 'profilePic':
                return 'sharecase/profiles';
            default:
                return 'sharecase/unknown';
        }
    },
    filename: (req, file, cb) => {
        const userIdIdentifier = req.user ? req.user._id : req.session.userId || Date.now();
        const fileNamePart = file.originalname.includes('.') ? file.originalname.split('.')[0] : file.originalname;
        const basePublicId = file.fieldname === 'profilePic' ? `profile-${userIdIdentifier}` : `${file.fieldname}-${userIdIdentifier}-${fileNamePart}`;
        cb(null, basePublicId);
    },
    allowedFormats: ['jpeg', 'png', 'gif', 'webp', 'gltf', 'glb'],
    transformation: (req, file) => {
        if (file.fieldname === 'profilePic') {
            return [{ width: 500, height: 500, crop: 'fill' }];
        }
        return [];
    },
    resource_type: (req, file) => {
        if (file.fieldname === 'CADFile') {
            return 'raw';
        }
        return 'image';
    }
});

const uploadFields = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // Global limit is 10MB
    fileFilter: (req, file, cb) => {
        console.log(`Multer Received Field: ${file.fieldname} | Type: ${file.mimetype} | Size: ${file.size || 'unknown'} | Original Name: ${file.originalname}`);
        const allowedImageFields = ['image', 'artworkImage', 'profilePic'];
        const allowedCADFields = ['CADFile'];

        if (allowedImageFields.includes(file.fieldname)) {
            const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            const maxSize = 2 * 1024 * 1024; // 2MB image limit

            if (!allowedImageTypes.includes(file.mimetype)) {
                return cb(new Error(`Invalid file type for ${file.fieldname}. Allowed: JPEG, PNG, GIF, WEBP.`), false);
            }
            if (file.size > maxSize) {
                return cb(new Error(`File ${file.fieldname} too large. Max 2MB.`), false);
            }
            cb(null, true);

        } else if (allowedCADFields.includes(file.fieldname)) {
            const allowedCADExtensions = /\.(gltf|glb)$/i;
            const maxSize = 10 * 1024 * 1024; // 10MB CAD limit

            if (!file.originalname.match(allowedCADExtensions)) {
                return cb(new Error(`Invalid CAD file type for ${file.fieldname}. Only .GLB and .GLTF files are supported for browser viewing.`), false);
            }
            if (file.size > maxSize) {
                return cb(new Error(`CAD file ${file.fieldname} too large. Max 10MB.`), false);
            }
            cb(null, true);

        } else {
            console.error('Multer Rejecting Unexpected Field:', file.fieldname);
            cb(new Error(`The field '${file.fieldname}' is not permitted.`), false);
        }
    }
});

module.exports = uploadFields;