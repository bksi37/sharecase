// routes/profile.js
const express = require('express');
const router = express.Router(); // <-- THIS IS THE MISSING LINE!
const cloudinary = require('cloudinary').v2;
const User = require('../models/User');
const Project = require('../models/Project');
const { isAuthenticated, isProfileComplete } = require('../middleware/auth'); // Added isProfileComplete as it's used in profile routes
const bcrypt = require('bcryptjs');
const upload = require('../middleware/upload');


// Update Profile (Updated for Multer)
router.post('/update-profile', isAuthenticated, upload.single('profilePic'), async (req, res) => {
    try {
        const { name, personalEmail, bio, linkedin, major, github, personalWebsite } = req.body;
        const userId = req.session.userId;

        console.log('Update profile attempt (profile.js):', { userId, name, personalEmail, major, linkedin, github, personalWebsite });
        console.log('Multer processed req.file (profile.js):', req.file); // Debugging: Check if req.file is populated

        let user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update fields if provided (or clear if empty string is sent for non-required fields)
        user.name = name; // Update name in settings
        user.personalEmail = personalEmail;
        user.major = major;
        user.bio = bio;
        user.github = github;
        user.personalWebsite = personalWebsite;

        // Process LinkedIn URL
        let processedLinkedin = linkedin;
        if (processedLinkedin && !processedLinkedin.startsWith('http://') && !processedLinkedin.startsWith('https://')) {
            processedLinkedin = `https://${processedLinkedin}`;
        }
        user.linkedin = processedLinkedin;

        // Handle profile picture upload using req.file (from Multer)
        if (req.file && req.file.path) {
            user.profilePic = req.file.path; // Multer's CloudinaryStorage already gives you the secure_url
            console.log('New profile pic URL assigned from Multer (profile.js):', user.profilePic);
        } else {
            // If no new file was uploaded, retain the existing profilePic.
            // If the user *wants* to remove their picture, you'd need a separate checkbox/button for that.
            console.log('No new profile pic uploaded in update-profile. Retaining existing.');
        }

        await user.save();

        await User.findByIdAndUpdate(userId, {
            $push: { activityLog: { action: 'Profile updated', timestamp: new Date() } }
        });

        res.json({
            success: true,
            profilePic: user.profilePic, // Send back the updated pic URL
            name: user.name, // Send back updated name for header
            bio: user.bio,
            linkedin: user.linkedin,
            personalEmail: user.personalEmail,
            major: user.major,
            github: user.github,
            personalWebsite: user.personalWebsite
        });
    } catch (error) {
        console.error('Profile update error (profile.js):', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        // Handle Multer errors specifically
        if (error instanceof multer.MulterError) {
             console.error('Multer Error during update-profile:', error.message);
             return res.status(400).json({ error: `File upload error: ${error.message}` });
        }
        res.status(500).json({ error: 'Server error' });
    }
});


// Change Password (Existing code - no changes needed here for this request)
router.post('/change-password', isAuthenticated, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.findByIdAndUpdate(user._id, { password: hashedPassword });
        await User.findByIdAndUpdate(user._id, {
            $push: { activityLog: { action: 'Password changed', timestamp: new Date() } }
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update Preferences (Existing code - no changes needed here for this request)
router.post('/update-preferences', isAuthenticated, async (req, res) => {
    try {
        const { notifications, theme, privacy, twoFactorAuth } = req.body;
        await User.findByIdAndUpdate(req.session.userId, {
            notifications,
            theme,
            privacy,
            twoFactorAuth
        });
        await User.findByIdAndUpdate(req.session.userId, {
            $push: { activityLog: { action: 'Preferences updated', timestamp: new Date() } }
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Preferences update error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Activity Log (Existing code - no changes needed here for this request)
router.get('/activity-log', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user.activityLog || []);
    } catch (error) {
        console.error('Activity log error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete Account (Existing code - no changes needed here for this request)
router.delete('/delete-account', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Delete user projects
        const projects = await Project.find({ user: userId });
        for (const project of projects) {
            if (project.image) {
                const publicId = project.image.split('/').pop().split('.')[0];
                // Assuming project images are in 'sharecase/projects' folder on Cloudinary
                await cloudinary.uploader.destroy(`sharecase/projects/${publicId}`);
            }
        }
        await Project.deleteMany({ user: userId });
        // Delete user profile picture
        if (user.profilePic) {
            const publicId = user.profilePic.split('/').pop().split('.')[0].split('-')[0]; // Adjust to get original public_id if different format
            // Assuming profile pictures are in 'sharecase/profiles' folder on Cloudinary
            await cloudinary.uploader.destroy(`sharecase/profiles/${publicId}`);
        }
        // Delete user
        await User.findByIdAndDelete(userId);
        req.session.destroy(); // Clear session
        res.json({ success: true });
    } catch (error) {
        console.error('Account deletion error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// My Projects (Existing code - no changes needed here for this request)
router.get('/my-projects', isAuthenticated, async (req, res) => {
    try {
        const projects = await Project.find({ user: req.session.userId });
        res.json(projects);
    } catch (error) {
        console.error('My projects error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;