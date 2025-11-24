// middleware/upload.js  ← THIS IS THE FIXED VERSION (Cloudinary v2 + no multer-storage-cloudinary)

const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const streamifier = require('streamifier');
require('dotenv').config();

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer: store files in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max
  fileFilter: (req, file, cb) => {
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const allowedCAD = /\.(glb|gltf|obj|stl|step)$/i;

    if (['image', 'artworkImage', 'profilePic'].includes(file.fieldname)) {
      if (!allowedImageTypes.includes(file.mimetype)) return cb(new Error('Invalid image'), false);
      if (file.size > 3 * 1024 * 1024) return cb(new Error('Image > 3MB'), false);
    }
    if (file.fieldname === 'CADFile') {
      if (!allowedCAD.test(file.originalname)) return cb(new Error('Invalid CAD format'), false);
      if (file.size > 12 * 1024 * 1024) return cb(new Error('CAD > 12MB'), false);
    }
    cb(null, true);
  }
});

// Helper: upload buffer to Cloudinary
const uploadToCloudinary = (buffer, file, req) => {
  return new Promise((resolve, reject) => {
    const userId = req.session?.userId || req.user?._id || 'unknown';

    let folder = 'sharecase/unknown';
    switch (file.fieldname) {
      case 'image':        folder = 'sharecase/projects'; break;
      case 'artworkImage': folder = 'sharecase/artwork'; break;
      case 'CADFile':      folder = 'sharecase/cad'; break;
      case 'profilePic':   folder = 'sharecase/profiles'; break;
    }

    const baseId = file.originalname.split('.')[0].replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 20);
    const public_id = `${file.fieldname}-${userId}-${baseId}-${Date.now()}`;

    const isCAD = file.fieldname === 'CADFile';
    const options = {
      folder,
      public_id,
      resource_type: isCAD ? 'raw' : 'image',
      format: isCAD ? null : file.originalname.split('.').pop().toLowerCase(),
      transformation: file.fieldname === 'profilePic'
        ? [{ width: 500, height: 500, crop: 'fill', gravity: 'face' }]
        : []
    };

    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });

    streamifier.createReadStream(buffer).pipe(stream);
  });
};

module.exports = { upload, uploadToCloudinary };