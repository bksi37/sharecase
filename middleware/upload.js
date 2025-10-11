const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary (Keep this part for credentials)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer configuration for multiple fields
const uploadFields = multer({
    storage: new CloudinaryStorage({
        cloudinary: cloudinary,
        params: async (req, file) => {
            if (!file) {
                return {};
            }

            // Determine upload type based on fieldname
            let options = {
                format: 'auto' // Use auto to determine the best format
            };

            switch (file.fieldname) {
                case 'image': // Project thumbnail (all types)
                    options.folder = 'sharecase/projects';
                    options.public_id = `project-${req.session.userId || Date.now()}-${file.originalname.split('.')[0]}`;
                    // No transformation: Save original to preserve aspect ratio
                    console.log(`Uploading project image to: ${options.folder}, no transformation`);
                    break;

                case 'artworkImage': // Art-specific image
                    options.folder = 'sharecase/artwork';
                    options.public_id = `artwork-${req.session.userId || Date.now()}-${file.originalname.split('.')[0]}`;
                    // No transformation: Save original
                    console.log(`Uploading artwork image to: ${options.folder}, no transformation`);
                    break;

                case 'CADFile': // Engineering CAD file
                    options.folder = 'sharecase/cad';
                    options.public_id = `cad-${req.session.userId || Date.now()}-${file.originalname.split('.')[0]}`;
                    // No transformation: Save original file
                    console.log(`Uploading CAD file to: ${options.folder}, no transformation`);
                    break;

                default: // Fallback for profile pics or other (e.g., if used in auth routes)
                    if (file.fieldname === 'profilePic') {
                        options.folder = 'sharecase/profiles';
                        options.public_id = `profile-${req.session.userId || Date.now()}`;
                        options.transformation = [{ width: 500, height: 500, crop: 'fill' }];
                        console.log(`Uploading profile pic to: ${options.folder}, with 500x500 crop`);
                    } else {
                        // Reject unknown fields
                        return { resource_type: 'auto', folder: 'sharecase/unknown' };
                    }
                    break;
            }

            return options;
        }
    }),
    limits: {
        // Global limit: 1 file per field, but sizes vary by field
        files: 3 // Max 3 files total (image + artworkImage + CADFile)
    },
    fileFilter: (req, file, cb) => {
        // Allow no file (optional uploads)
        if (!file) {
            return cb(null, true);
        }

        const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const allowedCADTypes = ['application/octet-stream', 'model/obj', 'model/gltf-binary']; // MIME for .obj, .gltf, .stl (often octet-stream)

        if (file.fieldname === 'image' || file.fieldname === 'artworkImage') {
            if (allowedImageTypes.includes(file.mimetype)) {
                // Enforce size limit per field (2MB for images)
                if (file.size > 2 * 1024 * 1024) {
                    return cb(new multer.MulterError('LIMIT_FILE_SIZE', 'Image file too large (max 2MB)'), false);
                }
                cb(null, true);
            } else {
                cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Invalid image type'), false);
            }
        } else if (file.fieldname === 'CADFile') {
            // Accept common CAD/3D formats (MIME can vary, so broad check)
            if (file.originalname.match(/\.(obj|gltf|stl|step|iges)$/i)) {
                // Enforce 10MB limit for CAD
                if (file.size > 10 * 1024 * 1024) {
                    return cb(new multer.MulterError('LIMIT_FILE_SIZE', 'CAD file too large (max 10MB)'), false);
                }
                cb(null, true);
            } else {
                cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Invalid CAD file type'), false);
            }
        } else if (file.fieldname === 'profilePic') {
            if (allowedImageTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Invalid profile image type'), false);
            }
        } else {
            cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Unknown file field'), false);
        }
    }
});

// Export the fields-based upload (use in routes like: uploadFields.fields([...]))
module.exports = uploadFields;