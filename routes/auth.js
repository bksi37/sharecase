// routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Project = require('../models/Project');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const { isAuthenticated, isProfileComplete } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const Notification = require('../models/Notification');


// Signup
router.post('/signup', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        const existingUser = await User.findOne({ email });

        if (!email || !password || !name) {
            return res.status(400).json({ success: false, error: 'All fields are required' });
        }

        if (existingUser) {
            return res.status(409).json({ error: 'User with that email already exists.' });
        }

        const emailVerificationToken = crypto.randomBytes(32).toString('hex');
        const user = new User({
            email,
            password,
            name,
            role: 'external',
            isProfileComplete: false,
            emailVerificationToken,
            isVerified: false
        });

        await user.save();
// --- ADD WELCOME NOTIFICATION LOGIC HERE ---
        const welcomeNotification = new Notification({
            userId: user._id,
            message: `Welcome to ShareCase, ${user.name}! We're glad to have you.`,
            type: 'mention', // Use a standard type like 'mention' or create a new 'welcome' enum type
            read: false,
        });
        await welcomeNotification.save();
        // ------------------------------------------
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${emailVerificationToken}`;

        await resend.emails.send({
            from: 'noreply@sharecase.live',
            to: email,
            subject: 'Verify your ShareCase account',
            html: `
                <p>Hello,</p>
                <p>Thank you for signing up for ShareCase. Please click the link below to verify your account:</p>
                <a href="${verificationUrl}">Verify Account</a>
                <p>If you did not sign up for ShareCase, you can safely ignore this email.</p>
            `,
        });

        res.status(201).json({
            success: true,
            message: 'User created successfully. Please check your email to verify your account.'
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Server error during signup.' });
    }
});

// Email Verification
router.get('/verify-email', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) {
            return res.status(400).send('Verification token is missing.');
        }

        const user = await User.findOne({ emailVerificationToken: token });
        if (!user) {
            return res.status(404).send('Invalid or expired verification token.');
        }

        user.isVerified = true;
        user.emailVerificationToken = undefined;
        await user.save();

        res.redirect('/login.html?verified=true');
    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).send('An error occurred during email verification.');
    }
});

// Resend Verification Email
router.post('/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }

        if (user.isVerified) {
            return res.status(400).json({ success: false, error: 'Account is already verified.' });
        }

        const newEmailVerificationToken = crypto.randomBytes(32).toString('hex');
        user.emailVerificationToken = newEmailVerificationToken;
        await user.save();

        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${newEmailVerificationToken}`;
        await resend.emails.send({
            from: 'noreply@sharecase.live',
            to: email,
            subject: 'Verify your ShareCase account',
            html: `
                <p>Hello,</p>
                <p>We received a request to resend your account verification link. Please click the link below to verify your account:</p>
                <a href="${verificationUrl}">Verify Account</a>
                <p>If you did not request this, you can safely ignore this email.</p>
            `,
        });

        res.json({
            success: true,
            message: 'Verification email resent successfully. Please check your inbox in a few minutes and remember to check your spam folder.'
        });
    } catch (error) {
        console.error('Error resending verification email:', error);
        res.status(500).json({ success: false, error: 'Server error during resending verification email.' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        if (!user.isVerified) {
            return res.status(401).json({
                error: 'Please verify your email before logging in.',
                resendVerification: true
            });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        req.session.userId = user._id.toString();
        req.session.userName = user.name;
        req.session.isProfileComplete = user.isProfileComplete;
        req.session.userRole = user.role;
        req.session.userProfilePic = user.profilePic;

        const redirect = user.isProfileComplete ? '/index.html' : '/create-profile.html?redirected=true';
        res.json({ success: true, message: 'Logged in successfully.', redirect });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

// Complete Profile
router.post('/complete-profile', isAuthenticated, upload.single('profilePic'), async (req, res) => {
    try {
        const userId = req.session.userId;
        const { name, major, department, schoolEmail, graduationYear, linkedin, github, personalWebsite, isStudent, isAlumni } = req.body;

        if (!name || !major) {
            return res.status(400).json({ success: false, error: 'Name and Major are required.' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        user.name = name;
        user.major = major;
        user.department = department || '';
        user.schoolEmail = schoolEmail || '';
        user.graduationYear = graduationYear || '';
        user.socialLinks = {
            linkedin: linkedin ? (linkedin.startsWith('http') ? linkedin : `https://${linkedin}`) : '',
            github: github ? (github.startsWith('http') ? github : `https://${github}`) : '',
            website: personalWebsite ? (personalWebsite.startsWith('http') ? personalWebsite : `https://${personalWebsite}`) : ''
        };

        if (req.file && req.file.path) {
            user.profilePic = req.file.path;
            req.session.userProfilePic = user.profilePic;
        }

        user.isProfileComplete = true;
        if (isStudent === 'on' && schoolEmail && schoolEmail.match(/\.edu$/)) {
            user.role = 'student';
            user.isVerifiedStudent = true;
        } else if (isAlumni === 'on' && schoolEmail && schoolEmail.match(/\.edu$/)) {
            user.role = 'alumni';
            user.isVerifiedAlumni = true;
        } else {
            user.role = 'external';
            user.isVerifiedStudent = false;
            user.isVerifiedAlumni = false;
        }

        await user.save();
        req.session.isProfileComplete = true;
        req.session.userRole = user.role;
        await req.session.save();

        res.json({ success: true, redirect: '/index.html' });
    } catch (error) {
        console.error('Error completing profile:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, error: error.message });
        }
        if (error instanceof multer.MulterError) {
            return res.status(400).json({ success: false, error: error.message });
        }
        res.status(500).json({ success: false, error: 'Server error', details: error.message });
    }
});

// Skip Profile Completion
router.post('/skip-profile-completion', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        user.isProfileComplete = true;
        user.role = 'external';
        await user.save();

        req.session.isProfileComplete = true;
        req.session.userRole = user.role;
        await req.session.save();

        res.json({ success: true, redirect: '/index.html' });
    } catch (error) {
        console.error('Error skipping profile:', error);
        res.status(500).json({ success: false, error: 'Server error', details: error.message });
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        res.json({ success: true, redirect: '/login.html' });
    });
});

// Current User
router.get('/current-user', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ isLoggedIn: false, message: 'Not authenticated' });
    }
    try {
        const user = await User.findById(req.session.userId).lean();
        if (!user) {
            return res.status(404).json({ isLoggedIn: false, message: 'User not found' });
        }
        res.json({
            isLoggedIn: true,
            user: {
                _id: user._id.toString(),
                name: user.name,
                email: user.email,
                profilePic: user.profilePic,
                role: user.role,
                totalPoints: user.totalPoints || 0,
                socialLinks: user.socialLinks || { github: '', linkedin: '', website: '' },
                isProfileComplete: user.isProfileComplete || false,
                followers: user.followers || [],
                following: user.following || [],
                followersCount: user.followers ? user.followers.length : 0,
                followingCount: user.following ? user.following.length : 0,
                major: user.major || '',
                department: user.department || '',
                schoolEmail: user.schoolEmail || '',
                graduationYear: user.graduationYear || '',
                isVerifiedStudent: user.isVerifiedStudent || false,
                isVerifiedAlumni: user.isVerifiedAlumni || false,
                twoFactorAuth: user.twoFactorAuth || false,
                notifications: user.notifications || 'all',
                theme: user.theme || 'light',
                privacy: user.privacy || 'public'
            }
        });
    } catch (error) {
        console.error('Error fetching current user:', error);
        res.status(500).json({ isLoggedIn: false, message: 'Server error' });
    }
});

// Public User Details
router.get('/user-details/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await User.findById(userId)
            .select('name profilePic major department socialLinks role totalPoints followers following');

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }

        res.json({
            _id: user._id.toString(),
            name: user.name,
            profilePic: user.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg',
            major: user.major || '',
            department: user.department || '',
            socialLinks: {
                linkedin: user.socialLinks?.linkedin || '',
                github: user.socialLinks?.github || '',
                website: user.socialLinks?.website || ''
            },
            role: user.role,
            totalPoints: user.totalPoints || 0,
            followersCount: user.followers ? user.followers.length : 0
        });
    } catch (error) {
        console.error('Error in /user-details/:userId:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, error: 'Invalid user ID format' });
        }
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// Fetch User's Followers
router.get('/user/:id/followers', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('followers');
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const followers = await User.find({ _id: { $in: user.followers } })
            .select('name profilePic major')
            .lean();
        res.json(followers.map(f => ({
            _id: f._id.toString(),
            name: f.name,
            profilePic: f.profilePic,
            major: f.major
        })));
    } catch (error) {
        console.error('Error fetching followers:', error);
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// Fetch User's Following
router.get('/user/:id/following', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('following');
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const following = await User.find({ _id: { $in: user.following } })
            .select('name profilePic major')
            .lean();
        res.json(following.map(f => ({
            _id: f._id.toString(),
            name: f.name,
            profilePic: f.profilePic,
            major: f.major
        })));
    } catch (error) {
        console.error('Error fetching following:', error);
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// Toggle Follow/Unfollow
router.post('/user/:id/follow', isAuthenticated, async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const currentUserId = req.session.userId;

        if (currentUserId === targetUserId) {
            return res.status(400).json({ error: 'You cannot follow yourself.' });
        }

        const targetUser = await User.findById(targetUserId);
        const currentUser = await User.findById(currentUserId);

        if (!targetUser || !currentUser) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const isFollowing = currentUser.following.includes(targetUserId);

        if (isFollowing) {
            currentUser.following.pull(targetUserId);
            targetUser.followers.pull(currentUserId);
            await Promise.all([currentUser.save(), targetUser.save()]);
            res.json({ success: true, isFollowing: false, followersCount: targetUser.followers.length });
        } else {
            currentUser.following.push(targetUserId);
            targetUser.followers.push(currentUserId);
            await Promise.all([currentUser.save(), targetUser.save()]);
            res.json({ success: true, isFollowing: true, followersCount: targetUser.followers.length });
        }
    } catch (error) {
        console.error('Error toggling follow status:', error);
        res.status(500).json({ error: 'Server error toggling follow status.' });
    }
});

// Search Users for Collaboration
router.get('/users/search', isAuthenticated, async (req, res) => {
    try {
        const query = req.query.q;
        if (!query || query.trim() === '') {
            return res.status(400).json({ error: 'Search query is required' });
        }

        const searchTerm = new RegExp(query, 'i');

        const users = await User.find({
            $or: [
                { name: { $regex: searchTerm } },
                { email: { $regex: searchTerm } },
                { major: { $regex: searchTerm } },
                { department: { $regex: searchTerm } }
            ],
            isProfileComplete: true
        }).select('_id name email profilePic major department role');

        res.json(users);
    } catch (error) {
        console.error('User search error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// routes/auth.js
router.get('/notifications', isAuthenticated, async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.session.userId })
            .sort({ timestamp: -1 })
            .limit(10)
            .lean();
        
        // Ensure we explicitly return the array, even if empty!
        return res.json(notifications); // This should return [] if none are found.
    } catch (error) {
        // ... error handling
    }
});

// DELETE route to remove a single notification
router.delete('/notifications/:id', isAuthenticated, async (req, res) => {
    try {
        const notificationId = req.params.id;
        
        // Find the notification and ensure it belongs to the logged-in user
        const result = await Notification.findOneAndDelete({
            _id: notificationId,
            userId: req.session.userId
        });

        if (!result) {
            return res.status(404).json({ success: false, error: 'Notification not found or access denied.' });
        }

        // Optional: Update the user's notification list/count if necessary

        res.json({ success: true, message: 'Notification removed.' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ success: false, error: 'Server error during deletion.' });
    }
});

module.exports = router;