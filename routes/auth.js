const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Project = require('../models/Project'); // This import may not be strictly needed here, but keeping for completeness
const bcrypt = require('bcryptjs');
const { isAuthenticated, isProfileComplete } = require('../middleware/auth');
const upload = require('../middleware/upload');
const cloudinary = require('cloudinary').v2; // Multer for file uploads
const crypto = require('crypto');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// Current User (Requires Authentication)
router.get('/current-user', isAuthenticated, async (req, res) => {
    try {
        // isAuthenticated middleware ensures req.session.userId exists here
        const user = await User.findById(req.session.userId)
            .select('name email profilePic major department linkedin github personalWebsite privacy isProfileComplete role universityEmail universityEmailVerified followers following totalPoints');

        if (!user) {
            req.session.destroy(); // Clear invalid session
            // This case should ideally be rare if isAuthenticated is working correctly
            return res.status(404).json({ isLoggedIn: false, error: 'User not found after authentication check.' });
        }

        res.json({
            isLoggedIn: true,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                profilePic: user.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg',
                major: user.major || '',
                department: user.department || '',
                // Group social links into an object as expected by frontend
                socialLinks: {
                    linkedin: user.linkedin || '',
                    github: user.github || '',
                    website: user.personalWebsite || '' // Using 'website' for personalWebsite
                },
                privacy: user.privacy,
                isProfileComplete: user.isProfileComplete,
                role: user.role,
                universityEmail: user.universityEmail || '',
                universityEmailVerified: user.universityEmailVerified,
                // Rename counts to match frontend's expected properties
                followersCount: user.followers ? user.followers.length : 0,
                followingCount: user.following ? user.following.length : 0,
                totalPoints: user.totalPoints || 0
            }
        });

    } catch (error) {
        console.error('Error fetching current user:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- User Signup ---
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

// --- User Login ---
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        if (!user.isVerified) {
            return res.status(401).json({ error: 'Please verify your email before logging in.' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        req.session.userId = user._id.toString();
        req.session.userName = user.name;
        req.session.isProfileComplete = user.isProfileComplete;
        req.session.userRole = user.role;

        const redirect = user.isProfileComplete ? '/index.html' : '/create-profile.html';
        res.json({ success: true, message: 'Logged in successfully.', redirect });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

// --- Email Verification Route ---
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
        user.emailVerificationToken = null;
        await user.save();

        res.redirect('/login.html?verified=true');

    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).send('An error occurred during email verification.');
    }
});

// Complete Profile (Initial setup after signup, uses Multer for profilePic)
router.post('/complete-profile', isAuthenticated, upload.single('profilePic'), async (req, res) => {
    try {
        const userId = req.session.userId;
        const { name, major, linkedin, github, personalWebsite, department, universityEmail } = req.body;
        console.log('Complete profile attempt:', { userId, name, major, linkedin, github, personalWebsite, department, universityEmail, file: req.file ? req.file.originalname : 'no file' });

        const user = await User.findById(userId);
        if (!user) {
            console.log('Complete profile failed: User not found:', userId);
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        user.name = name;
        user.major = major;
        user.department = department;
        user.universityEmail = universityEmail || null;

        // Process social links
        user.linkedin = linkedin;
        user.github = github;
        user.personalWebsite = personalWebsite;

        // Ensure URLs have https:// prefix if they don't already
        if (user.linkedin && !user.linkedin.startsWith('http://') && !user.linkedin.startsWith('https://')) {
            user.linkedin = `https://${user.linkedin}`;
        }
        if (user.github && !user.github.startsWith('http://') && !user.github.startsWith('https://')) {
            user.github = `https://${user.github}`;
        }
        if (user.personalWebsite && !user.personalWebsite.startsWith('http://') && !user.personalWebsite.startsWith('https://')) {
            user.personalWebsite = `https://${user.personalWebsite}`;
        }


        if (req.file && req.file.path) {
            user.profilePic = req.file.path;
            console.log('New profile pic URL assigned from Multer (auth.js):', user.profilePic);
        } else {
            console.log('No new profile pic uploaded in complete-profile. Retaining existing or default.');
        }

        user.isProfileComplete = true;
        await user.save();

        req.session.isProfileComplete = true;
        req.session.userRole = user.role;
        req.session.userName = user.name;
        await req.session.save();

        console.log('Profile completed for user:', userId);
        res.json({ success: true, redirect: '/index.html' });
    } catch (error) {
        console.error('Error completing profile:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, error: error.message });
        }
        res.status(500).json({ success: false, error: 'Server error', details: error.message });
    }
});

// Skip Profile Completion
router.post('/skip-profile-completion', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        console.log('Skip profile attempt:', { userId });

        const user = await User.findById(userId);
        if (!user) {
            console.log('Skip profile failed: User not found:', userId);
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        user.isProfileComplete = true;
        await user.save();

        req.session.isProfileComplete = true;
        await req.session.save();

        console.log('User skipped profile completion:', userId);
        res.json({ success: true, redirect: '/index.html' });
    } catch (error) {
        console.error('Error skipping profile completion:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        console.log('Logout successful');
        res.json({ success: true, redirect: '/login.html' });
    });
});

// Fetch Public User Details by ID (no authentication needed for public access)
router.get('/user-details/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId)
            .select('name email profilePic major department bio linkedin github personalWebsite role totalPoints followers following');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            profilePic: user.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg',
            major: user.major || '',
            department: user.department || '',
            // Group social links into an object as expected by frontend
            socialLinks: {
                linkedin: user.linkedin || '',
                github: user.github || '',
                website: user.personalWebsite || '' // Using 'website' for personalWebsite
            },
            role: user.role,
            totalPoints: user.totalPoints || 0,
            // Rename counts to match frontend's expected properties
            followersCount: user.followers ? user.followers.length : 0,
            followingCount: user.following ? user.following.length : 0
        });

    } catch (error) {
        console.error('Error fetching public user details:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid user ID format' });
        }
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// Search Users for Collaboration (Requires Authentication)
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

// Route to toggle a follow/unfollow action
router.post('/user/:id/follow', isAuthenticated, async (req, res) => {
    try {
        const targetUserId = req.params.id; // The user to be followed/unfollowed
        const currentUserId = req.session.userId; // The user performing the action

        // Prevent a user from following themselves
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
            // Unfollow logic: remove from both arrays
            currentUser.following.pull(targetUserId); // Use Mongoose's .pull() method
            targetUser.followers.pull(currentUserId);
            await Promise.all([currentUser.save(), targetUser.save()]);
            res.json({ success: true, isFollowing: false, followersCount: targetUser.followers.length });
        } else {
            // Follow logic: add to both arrays
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

module.exports = router;