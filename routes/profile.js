// routes/profile.js
const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const User = require('../models/User');
const Project = require('../models/Project');
const { isAuthenticated, isProfileComplete } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const upload = require('../middleware/upload');

// Update Profile (General user profile update after initial completion)
// Update Profile
router.post('/update-profile', isAuthenticated, upload.single('profilePic'), async (req, res) => {
    try {
        const { name, linkedin, major, github, personalWebsite, department, universityEmail } = req.body;
        const userId = req.session.userId;

        console.log('Update profile attempt (profile.js):', { userId, name, major, linkedin, github, personalWebsite, department, universityEmail, file: req.file ? req.file.originalname : 'no file' });

        let user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.name = name;
        user.major = major;
        user.department = department;

        // FIX: Ensure socialLinks object exists before setting properties
        if (!user.socialLinks) {
            user.socialLinks = {};
        }

        user.socialLinks.linkedin = linkedin;
        user.socialLinks.github = github;
        user.socialLinks.website = personalWebsite;
        
        user.universityEmail = universityEmail || null;

        if (user.role === 'external' && user.universityEmail && user.universityEmail.endsWith('.edu')) {
            user.role = 'student';
        }

        if (req.file && req.file.path) {
            if (user.profilePic && !user.profilePic.includes('default-profile.jpg')) {
                const publicIdMatch = user.profilePic.match(/sharecase\/profiles\/(.+)\.\w+$/);
                if (publicIdMatch && publicIdMatch[1]) {
                    const publicId = `sharecase/profiles/${publicIdMatch[1]}`;
                    await cloudinary.uploader.destroy(publicId);
                }
            }
            user.profilePic = req.file.path;
        }

        await user.save();

        await User.findByIdAndUpdate(userId, {
            $push: { activityLog: { action: 'Profile updated', timestamp: new Date() } }
        });

        req.session.userName = user.name;
        req.session.userRole = user.role;
        await req.session.save();

        res.json({
            success: true,
            profilePic: user.profilePic,
            name: user.name,
            linkedin: user.socialLinks.linkedin,
            major: user.major,
            github: user.socialLinks.github,
            personalWebsite: user.socialLinks.website,
            department: user.department,
            role: user.role
        });
    } catch (error) {
        console.error('Profile update error (profile.js):', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
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
        res.json({ success: true, message: 'Password changed successfully.' });
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
        res.json({ success: true, message: 'Preferences updated successfully.' });
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
        const projects = await Project.find({ userId: userId });
        for (const project of projects) {
            if (project.image && !project.image.includes('default-project.jpg')) {
                const publicIdMatch = project.image.match(/sharecase\/projects\/(.+)\.\w+$/);
                if (publicIdMatch && publicIdMatch[1]) {
                    const publicId = `sharecase/projects/${publicIdMatch[1]}`;
                    await cloudinary.uploader.destroy(publicId);
                }
            }
        }
        await Project.deleteMany({ userId: userId });

        if (user.profilePic && !user.profilePic.includes('default-profile.jpg')) {
            const publicIdMatch = user.profilePic.match(/sharecase\/profiles\/(.+)\.\w+$/);
            if (publicIdMatch && publicIdMatch[1]) {
                const publicId = `sharecase/profiles/${publicIdMatch[1]}`;
                await cloudinary.uploader.destroy(publicId);
            }
        }
        await User.findByIdAndDelete(userId);
        req.session.destroy();
        res.json({ success: true, message: 'Account deleted successfully.' });
    } catch (error) {
        console.error('Account deletion error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// My Projects (Projects by the logged-in user)
router.get('/my-projects', isAuthenticated, async (req, res) => {
    try {
        const projects = await Project.find({ userId: req.session.userId })
            .select('title description image isPublished likes views points projectType');

        res.json(projects.map(p => ({
            id: p._id,
            title: p.title,
            image: p.image || 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg',
            description: p.description,
            isPublished: p.isPublished,
            likes: p.likes || 0,
            views: p.views || 0,
            points: p.points || 0,
            projectType: p.projectType || 'Other'
        })));
    } catch (error) {
        console.error('My projects error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;