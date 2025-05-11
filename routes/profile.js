const express = require('express');
const cloudinary = require('cloudinary').v2;
const User = require('../models/User');
const Project = require('../models/Project');
const { isAuthenticated } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const router = express.Router();

// Complete Profile
router.post('/complete-profile', isAuthenticated, async (req, res) => {
    try {
        const { name, schoolEmail } = req.body;
        const userId = req.session.userId;
        let profilePicUrl = null;
        if (req.files && req.files.profilePic) {
            const result = await cloudinary.uploader.upload(req.files.profilePic.tempFilePath, {
                folder: 'sharecase/profiles',
                transformation: [{ width: 150, height: 150, crop: 'fill' }]
            });
            profilePicUrl = result.secure_url;
        }
        const updateData = { name, schoolEmail, isProfileComplete: true };
        if (profilePicUrl) updateData.profilePic = profilePicUrl;
        await User.findByIdAndUpdate(userId, updateData);
        await User.findByIdAndUpdate(userId, {
            $push: { activityLog: { action: 'Profile completed', timestamp: new Date() } }
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Profile completion error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update Profile
router.post('/update-profile', isAuthenticated, async (req, res) => {
    try {
        const { name, schoolEmail } = req.body;
        const userId = req.session.userId;
        let profilePicUrl = null;
        if (req.files && req.files.profilePic) {
            const result = await cloudinary.uploader.upload(req.files.profilePic.tempFilePath, {
                folder: 'sharecase/profiles',
                transformation: [{ width: 150, height: 150, crop: 'fill' }]
            });
            profilePicUrl = result.secure_url;
        }
        const updateData = { name, schoolEmail };
        if (profilePicUrl) updateData.profilePic = profilePicUrl;
        await User.findByIdAndUpdate(userId, updateData);
        await User.findByIdAndUpdate(userId, {
            $push: { activityLog: { action: 'Profile updated', timestamp: new Date() } }
        });
        res.json({ success: true, profilePic: profilePicUrl });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Change Password
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

// Update Preferences
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

// Activity Log
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

// Delete Account
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
                await cloudinary.uploader.destroy(`sharecase/projects/${publicId}`);
            }
        }
        await Project.deleteMany({ user: userId });
        // Delete user profile picture
        if (user.profilePic) {
            const publicId = user.profilePic.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(`sharecase/profiles/${publicId}`);
        }
        // Delete user
        await User.findByIdAndDelete(userId);
        req.session.destroy();
        res.json({ success: true });
    } catch (error) {
        console.error('Account deletion error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// My Projects
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