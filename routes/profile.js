// routes/profile.js
const express = require('express');
const router = express.Router();
const fs = require('fs'); 
const cloudinary = require('cloudinary').v2;
const User = require('../models/User');
const Project = require('../models/Project');
const { isAuthenticated } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const upload = require('../middleware/upload'); 

// Update Profile (General user profile update after initial completion)
router.post('/update-profile', isAuthenticated, upload.single('profilePic'), async (req, res) => {
    // 🛑 CRITICAL: Store the original temporary file path provided by Multer
    const tempFilePath = req.file ? req.file.path : null;

    try {
        const { name, linkedin, major, github, personalWebsite, department, universityEmail } = req.body;
        const userId = req.session.userId;

        let user = await User.findById(userId);
        if (!user) {
            // GUARDRAIL: Delete file if user not found
            if (tempFilePath) fs.unlinkSync(tempFilePath);
            return res.status(404).json({ error: 'User not found' });
        }

        user.name = name || user.name;
        user.major = major || user.major;
        user.department = department || user.department;
        user.universityEmail = user.universityEmail || universityEmail || null;

        // Social Media URL validation (Logic maintained)
        if (linkedin && linkedin.trim() !== '') {
            user.linkedin = linkedin.startsWith('http') ? linkedin : `https://${linkedin}`;
        }
        if (github && github.trim() !== '') {
            user.github = github.startsWith('http') ? github : `https://${github}`;
        }
        if (personalWebsite && personalWebsite.trim() !== '') {
            user.personalWebsite = personalWebsite.startsWith('http') ? personalWebsite : `https://${personalWebsite}`;
        }

        // Role change logic
        if (user.role === 'external' && user.universityEmail && user.universityEmail.endsWith('.edu')) {
            user.role = 'student';
        }

        // 🛑 CRITICAL FIX: Cloudinary Upload and URL Assignment
        if (tempFilePath) {
            let uploadedSuccessfully = false;
            try {
                // 1. Delete old image (DISABLED AS REQUESTED)
                /*
                if (user.profilePic && !user.profilePic.includes('default-profile.jpg')) {
                    const publicIdMatch = user.profilePic.match(/sharecase\/profiles\/([^/]+?)(?:\.\w+)?$/);
                    if (publicIdMatch && publicIdMatch[1]) {
                        const publicId = `sharecase/profiles/${publicIdMatch[1]}`;
                        await cloudinary.uploader.destroy(publicId).catch(err => {
                            console.warn(`Failed to destroy old Cloudinary asset ${publicId}: ${err.message}`);
                        });
                    }
                }
                */

                // 2. Upload the new file from Multer's temporary path (tempFilePath)
                const result = await cloudinary.uploader.upload(tempFilePath, {
                    folder: 'sharecase/profiles',
                    public_id: `profile-${userId}`, 
                    overwrite: true,
                    transformation: [{ width: 400, height: 400, gravity: "face", crop: "thumb" }]
                });

                // 3. Assign the final, working Cloudinary URL
                user.profilePic = result.secure_url;
                uploadedSuccessfully = true;

            } catch (uploadError) {
                console.error('Cloudinary Upload Failed (400/Timeout):', uploadError);
                // If upload fails, the profilePic field remains unchanged.
            } finally {
                // 4. CLEANUP: Delete the temporary file using the correct local path (tempFilePath)
                try {
                    fs.unlinkSync(tempFilePath); 
                } catch (unlinkError) {
                    console.warn(`Failed to delete local temp file ${tempFilePath}: ${unlinkError.message}`);
                }
            }
            
            // 🛑 GUARDRAIL: Send success message only if the file uploaded
            if (uploadedSuccessfully) {
                console.log(`Profile picture updated successfully for user ${userId}.`);
            } else if (req.file) {
                // If upload failed but a file was sent, inform the user it was a service error.
                 // We don't throw an error here, but we ensure the message reflects the outcome.
            }
        }
        // 🛑 END CRITICAL FIX

        await user.save();

        // Activity log and session updates
        let logMessage = 'Profile updated.';
        if (req.file && user.profilePic && user.profilePic.startsWith('http')) {
            logMessage = 'Profile picture changed.'; // Log specific change only if the URL is valid/new
        }
        
        await User.findByIdAndUpdate(userId, {
            $push: { activityLog: { action: logMessage, timestamp: new Date() } }
        });

        req.session.userName = user.name;
        req.session.userRole = user.role;
        await req.session.save();

        res.json({
            success: true,
            profilePic: user.profilePic,
            name: user.name,
            major: user.major,
            department: user.department,
            role: user.role,
            linkedin: user.linkedin,
            github: user.github,
            personalWebsite: user.personalWebsite,
            message: logMessage 
        });

    } catch (error) {
        console.error('Profile update error (profile.js):', error);
        
        // FINAL GUARDRAIL: Ensure temp file is deleted if the server crashed before the 'finally' block
        if (tempFilePath) {
            try { fs.unlinkSync(tempFilePath); } catch (e) { /* silent fail */ }
        }
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'An unexpected server error occurred during profile update.' });
    }
});

// Change Password
router.post('/change-password', isAuthenticated, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        // 🛑 SECURITY GUARDRAIL: Check for empty passwords
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'All password fields are required.' });
        }
        
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }
        // 🛑 SECURITY GUARDRAIL: Enforce a minimum length for new passwords (e.g., 8)
        if (newPassword.length < 8) {
             return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
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
        // 🛑 STABILITY GUARDRAIL: Use $set for robust updates instead of relying on default update behavior
        const { notifications, theme, privacy, twoFactorAuth } = req.body;
        
        await User.findByIdAndUpdate(req.session.userId, {
            $set: {
                notifications: notifications,
                theme: theme,
                privacy: privacy,
                twoFactorAuth: twoFactorAuth
            }
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
        const user = await User.findById(req.session.userId).select('activityLog'); // 🛑 STABILITY: Select only necessary field
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
        
        // --- 🛑 STABILITY: Delete all user-associated assets from Cloudinary ---
        
        // 1. Delete associated project images
        const projects = await Project.find({ userId: userId });
        const projectPublicIds = projects.map(p => {
            const match = p.image ? p.image.match(/sharecase\/projects\/([^/]+?)(?:\.\w+)?$/) : null;
            return match ? `sharecase/projects/${match[1]}` : null;
        }).filter(id => id);

        if (projectPublicIds.length > 0) {
            await cloudinary.api.delete_resources(projectPublicIds);
        }
        
        // 2. Delete user's profile picture
        if (user.profilePic && !user.profilePic.includes('default-profile.jpg')) {
            const publicIdMatch = user.profilePic.match(/sharecase\/profiles\/([^/]+?)(?:\.\w+)?$/);
            if (publicIdMatch && publicIdMatch[1]) {
                const publicId = `sharecase/profiles/${publicIdMatch[1]}`;
                await cloudinary.uploader.destroy(publicId);
            }
        }
        
        // 3. Delete DB records
        await Project.deleteMany({ userId: userId });
        await User.findByIdAndDelete(userId);
        
        // --- END STABILITY ---

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
            .select('title description image isPublished likes views points projectType year'); // 🛑 STABILITY: Added 'year' for frontend portfolio list

        res.json(projects.map(p => ({
            id: p._id,
            title: p.title,
            image: p.image || 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg',
            description: p.description,
            isPublished: p.isPublished,
            likes: p.likes || 0,
            views: p.views || 0,
            points: p.points || 0,
            projectType: p.projectType || 'Other',
            year: p.year || 'N/A' // 🛑 Added
        })));
    } catch (error) {
        console.error('My projects error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
 
module.exports = router;