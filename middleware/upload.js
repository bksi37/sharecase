// middleware/upload.js
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadFields = multer({
    storage: new CloudinaryStorage({
        cloudinary: cloudinary,
        params: async (req, file) => {
            if (!file) {
                return {};
            }
            let options = {};
            const userIdIdentifier = req.user ? req.user._id : req.session.userId || Date.now();
            // Using a simple check to safely split the original filename
            const fileNamePart = file.originalname.includes('.') ? file.originalname.split('.')[0] : file.originalname;
            const basePublicId = `${file.fieldname}-${userIdIdentifier}-${fileNamePart}`;

            // Default resource_type for image fields for clarity
            if (['image', 'artworkImage', 'profilePic'].includes(file.fieldname)) {
                options.resource_type = 'image';
            }
            
            switch (file.fieldname) {
                case 'image':
                    options.folder = 'sharecase/projects';
                    options.public_id = basePublicId;
                    // options.format = 'auto' REMOVED: Cloudinary will now use the original format (PNG, JPEG, etc.)
                    break;
                case 'artworkImage':
                    options.folder = 'sharecase/artwork';
                    options.public_id = basePublicId;
                    // options.format = 'auto' REMOVED
                    break;
                case 'CADFile':
                    options.folder = 'sharecase/cad';
                    options.public_id = basePublicId;
                    options.resource_type = 'raw';
                    break;
                case 'profilePic':
                    options.folder = 'sharecase/profiles';
                    // This public_id uses the user ID to ensure a unique, overwritable profile image
                    options.public_id = `profile-${userIdIdentifier}`; 
                    // options.format = 'auto' REMOVED
                    options.transformation = [{ width: 500, height: 500, crop: 'fill' }];
                    break;
                default:
                    options.resource_type = 'auto';
                    options.folder = 'sharecase/unknown';
            }
            return options;
        }
    }),
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
            if (file.size && file.size > maxSize) {
                return cb(new Error(`File ${file.fieldname} too large. Max 2MB.`), false);
            }
            cb(null, true);

        } else if (allowedCADFields.includes(file.fieldname)) {
            const allowedCADExtensions = /\.(obj|gltf|glb|stl|step|iges)$/i;
            const maxSize = 10 * 1024 * 1024; // 10MB CAD limit
            
            if (!file.originalname.match(allowedCADExtensions)) {
                return cb(new Error(`Invalid CAD file type for ${file.fieldname}. Allowed: OBJ, GLTF, GLB, STL, STEP, IGES.`), false);
            }
            if (file.size && file.size > maxSize) {
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