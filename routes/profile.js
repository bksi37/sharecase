const express = require('express');
const cloudinary = require('cloudinary').v2;
const User = require('../models/User');
const Project = require('../models/Project');
const { isAuthenticated } = require('../middleware/auth'); // No need for isProfileComplete here
const bcrypt = require('bcryptjs');
const router = express.Router();

// Complete Profile (Keep as is, assumes req.files for initial profile completion)
router.post('/complete-profile', isAuthenticated, async (req, res) => {
    try {
        const { name, schoolEmail } = req.body;
        const userId = req.session.userId;
        let profilePicUrl = null;

        // Check if req.files.profilePic exists and has tempFilePath (from express-fileupload)
        if (req.files && req.files.profilePic && req.files.profilePic.tempFilePath) {
            const result = await cloudinary.uploader.upload(req.files.profilePic.tempFilePath, {
                folder: 'sharecase/profiles', // Original folder
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
router.post('/update-profile', isAuthenticated, async (req, res) => { // Removed 'upload.single' middleware
    try {
        // Extract new fields: bio and linkedin, along with existing ones
        const { name, schoolEmail, bio, linkedin } = req.body;
        const userId = req.session.userId;

        let user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update fields if provided (or clear if empty string is sent)
        user.name = name || user.name; // Keep existing name if new name is empty
        user.schoolEmail = schoolEmail; // Allow setting to empty
        user.bio = bio; // Allow setting to empty

        // Process LinkedIn URL: ensure it has https:// prefix if not already present
        let processedLinkedin = linkedin;
        if (processedLinkedin && !processedLinkedin.startsWith('http://') && !processedLinkedin.startsWith('https://')) {
            processedLinkedin = `https://${processedLinkedin}`;
        }
        user.linkedin = processedLinkedin; // Allow setting to empty

        // Handle profile picture upload using req.files (from express-fileupload)
        if (req.files && req.files.profilePic && req.files.profilePic.tempFilePath) {
            const result = await cloudinary.uploader.upload(req.files.profilePic.tempFilePath, { // Use tempFilePath
                folder: 'sharecase/profiles', // Use the same folder as complete-profile for consistency
                public_id: `profile_${userId}`, // Use user ID for consistent public_id
                overwrite: true // Overwrite previous profile picture
            });
            user.profilePic = result.secure_url;
        }

        await user.save(); // Save the updated user document

        // Add activity log entry
        await User.findByIdAndUpdate(userId, {
            $push: { activityLog: { action: 'Profile updated', timestamp: new Date() } }
        });

        // Respond with success and updated profilePic (if applicable) and other relevant data
        res.json({
            success: true,
            profilePic: user.profilePic, // Send back the updated URL
            name: user.name,
            bio: user.bio,
            linkedin: user.linkedin,
            schoolEmail: user.schoolEmail
        });
    } catch (error) {
        console.error('Profile update error:', error);
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