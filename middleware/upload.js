const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary
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

            let options = {
                format: 'auto'
            };

            switch (file.fieldname) {
                case 'image':
                    options.folder = 'sharecase/projects';
                    options.public_id = `project-${req.session.userId || Date.now()}-${file.originalname.split('.')[0]}`;
                    console.log(`Uploading project image to: ${options.folder}, no transformation`);
                    break;

                case 'artworkImage':
                    options.folder = 'sharecase/artwork';
                    options.public_id = `artwork-${req.session.userId || Date.now()}-${file.originalname.split('.')[0]}`;
                    console.log(`Uploading artwork image to: ${options.folder}, no transformation`);
                    break;

                case 'CADFile':
                    options.folder = 'sharecase/cad';
                    options.public_id = `cad-${req.session.userId || Date.now()}-${file.originalname.split('.')[0]}`;
                    options.resource_type = 'raw'; // For CAD files
                    console.log(`Uploading CAD file to: ${options.folder}, no transformation`);
                    break;

                default:
                    if (file.fieldname === 'profilePic') {
                        options.folder = 'sharecase/profiles';
                        options.public_id = `profile-${req.session.userId || Date.now()}`;
                        options.transformation = [{ width: 500, height: 500, crop: 'fill' }];
                        console.log(`Uploading profile pic to: ${options.folder}, with 500x500 crop`);
                    } else {
                        return { resource_type: 'auto', folder: 'sharecase/unknown' };
                    }
                    break;
            }

            return options;
        }
    }),
    limits: {
        files: 3
    },
    fileFilter: (req, file, cb) => {
        if (!file) {
            return cb(null, true);
        }

        const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (file.fieldname === 'image' || file.fieldname === 'artworkImage') {
            if (allowedImageTypes.includes(file.mimetype)) {
                if (file.size > 2 * 1024 * 1024) {
                    return cb(new multer.MulterError('LIMIT_FILE_SIZE', 'Image file too large (max 2MB)'), false);
                }
                cb(null, true);
            } else {
                cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Invalid image type'), false);
            }
        } else if (file.fieldname === 'CADFile') {
            if (file.originalname.match(/\.(obj|gltf|stl|step|iges)$/i)) {
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

module.exports = uploadFields;