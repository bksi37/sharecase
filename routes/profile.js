// routes/profile.js
const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const User = require('../models/User');
const Project = require('../models/Project'); // Needed for /my-projects and delete-account
const { isAuthenticated } = require('../middleware/auth'); // isProfileComplete is not directly used as middleware here, but check `auth.js` for where it's applied
const bcrypt = require('bcryptjs');
const upload = require('../middleware/upload'); // Multer for file uploads

// Update Profile (General user profile update after initial completion)
router.post('/update-profile', isAuthenticated, upload.single('profilePic'), async (req, res) => {
    try {
        // Removed personalEmail from destructuring as per User model roadmap
        const { name, bio, linkedin, major, github, personalWebsite, department } = req.body;
        const userId = req.session.userId;

        console.log('Update profile attempt (profile.js):', { userId, name, major, linkedin, github, personalWebsite, bio, department, file: req.file ? req.file.originalname : 'no file' });

        let user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.name = name;
        user.major = major;
        user.bio = bio;
        user.github = github;
        user.personalWebsite = personalWebsite;
        user.department = department; // Added department update

        let processedLinkedin = linkedin;
        if (processedLinkedin && !processedLinkedin.startsWith('http://') && !processedLinkedin.startsWith('https://')) {
            processedLinkedin = `https://${processedLinkedin}`;
        }
        user.linkedin = processedLinkedin;

        if (req.file && req.file.path) {
            // Optional: Delete old profile pic from Cloudinary if it's not default
            if (user.profilePic && !user.profilePic.includes('default-profile.jpg')) {
                const publicIdMatch = user.profilePic.match(/sharecase\/profiles\/(.+)\.\w+$/);
                if (publicIdMatch && publicIdMatch[1]) {
                    const publicId = `sharecase/profiles/${publicIdMatch[1]}`;
                    await cloudinary.uploader.destroy(publicId);
                    console.log('Old profile pic deleted from Cloudinary:', publicId);
                }
            }
            user.profilePic = req.file.path;
            console.log('New profile pic URL assigned from Multer (profile.js):', user.profilePic);
        } else {
            console.log('No new profile pic uploaded in update-profile. Retaining existing or default.');
        }

        await user.save();

        // Update activity log for profile update
        await User.findByIdAndUpdate(userId, {
            $push: { activityLog: { action: 'Profile updated', timestamp: new Date() } }
        });

        // Update session userName just in case it was changed
        req.session.userName = user.name;
        await req.session.save();

        res.json({
            success: true,
            profilePic: user.profilePic,
            name: user.name,
            bio: user.bio,
            linkedin: user.linkedin,
            major: user.major,
            github: user.github,
            personalWebsite: user.personalWebsite,
            department: user.department
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
        // Delete user projects
        const projects = await Project.find({ userId: userId });
        for (const project of projects) {
            if (project.image && !project.image.includes('default-project.jpg')) {
                const publicIdMatch = project.image.match(/sharecase\/projects\/(.+)\.\w+$/);
                if (publicIdMatch && publicIdMatch[1]) {
                    const publicId = `sharecase/projects/${publicIdMatch[1]}`;
                    await cloudinary.uploader.destroy(publicId);
                    console.log(`Deleted project image ${publicId}`);
                }
            }
        }
        await Project.deleteMany({ userId: userId });

        // Delete user profile picture
        if (user.profilePic && !user.profilePic.includes('default-profile.jpg')) {
            const publicIdMatch = user.profilePic.match(/sharecase\/profiles\/(.+)\.\w+$/);
            if (publicIdMatch && publicIdMatch[1]) {
                const publicId = `sharecase/profiles/${publicIdMatch[1]}`;
                await cloudinary.uploader.destroy(publicId);
                console.log(`Deleted profile image ${publicId}`);
            }
        }
        // Delete user
        await User.findByIdAndDelete(userId);
        req.session.destroy(); // Clear session
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