const express = require('express');
const cloudinary = require('cloudinary').v2;
const User = require('../models/User');
const { isAuthenticated } = require('../middleware/auth');
const router = express.Router();

// Complete Profile
router.post('/complete-profile', isAuthenticated, async (req, res) => {
    try {
        const { name, schoolEmail } = req.body;
        if (!name || !schoolEmail.endsWith('.edu')) {
            return res.status(400).json({ error: 'Invalid name or school email' });
        }
        let profilePicUrl = 'https://res.cloudinary.com/dphfedhek/image/upload/v1745178934/default-profile.jpg';
        if (req.files && req.files.profilePic) {
            const file = req.files.profilePic;
            const result = await cloudinary.uploader.upload(`data:${file.mimetype};base64,${file.data.toString('base64')}`, {
                folder: 'sharecase/profiles',
                format: 'jpg'
            });
            profilePicUrl = result.secure_url;
        }
        const user = await User.findById(req.session.userId);
        user.name = name;
        user.schoolEmail = schoolEmail;
        user.profilePic = profilePicUrl;
        user.isProfileComplete = true;
        await user.save();
        res.redirect('/index.html');
    } catch (error) {
        console.error('Complete profile error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;