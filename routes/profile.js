const express = require('express');
const cloudinary = require('cloudinary').v2;
const User = require('../models/User');
const Project = require('../models/Project');
const { isAuthenticated, isProfileComplete } = require('../middleware/auth');
const router = express.Router();

// Complete Profile
router.post('/complete-profile', isAuthenticated, async (req, res) => {
    try {
        const { name, schoolEmail } = req.body;
        if (!name || !schoolEmail.endsWith('.edu')) {
            return res.status(400).json({ error: 'Invalid name or school email' });
        }
        let profilePicUrl = 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg';
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

// Fetch User Projects
router.get('/my-projects', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const projects = await Project.find({ userId: req.session.userId }).populate('userId', 'name');
        res.json(projects.map(p => ({
            id: p._id,
            title: p.title,
            description: p.description,
            image: p.image || 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg',
            userId: p.userId._id
        })));
    } catch (error) {
        console.error('Fetch user projects error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Serve Profile Page
router.get('/profile.html', isAuthenticated, isProfileComplete, (req, res) => {
    res.sendFile(path.join(__dirname, '../views', 'profile.html'));
});

module.exports = router;