const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Project = require('../models/Project');
const bcrypt = require('bcryptjs');
const { isAuthenticated, isProfileComplete } = require('../middleware/auth');
const upload = require('../middleware/upload');
const cloudinary = require('cloudinary').v2;
const crypto = require('crypto');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// Current User (Requires Authentication)
router.get('/current-user', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId)
            .select('name email profilePic major department linkedin github personalWebsite privacy isProfileComplete role universityEmail universityEmailVerified followers following totalPoints');

        if (!user) {
            req.session.destroy();
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
                socialLinks: {
                    linkedin: user.linkedin || '',
                    github: user.github || '',
                    website: user.personalWebsite || ''
                },
                privacy: user.privacy,
                isProfileComplete: user.isProfileComplete,
                role: user.role,
                universityEmail: user.universityEmail || '',
                universityEmailVerified: user.universityEmailVerified,
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
        console.log('Verification URL being sent:', verificationUrl);

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
                // This is the key change.
        if (!user.isVerified) {
            return res.status(401).json({ 
                error: 'Please verify your email before logging in.',
                resendVerification: true // Signal the frontend to show a resend button
            });
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
        // Check if the user has a university email to set their role to 'student'
        if (user.universityEmail) {
            user.role = 'student';
        }
        await user.save();

        res.redirect('/login.html?verified=true');

    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).send('An error occurred during email verification.');
    }
});

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

        // Updated success message to include a warning about the delay
        res.json({ 
            success: true, 
            message: 'Verification email resent successfully. Please check your inbox in a few minutes and remember to check your spam folder.' 
        });

    } catch (error) {
        console.error('Error resending verification email:', error);
        res.status(500).json({ success: false, error: 'Server error during resending verification email.' });
    }
});

// Complete Profile (Initial setup after signup, uses Multer for profilePic)
router.post('/complete-profile', isAuthenticated, upload.single('profilePic'), async (req, res) => {
    try {
        const userId = req.session.userId;
        const name = req.session.userName;
        const { major, linkedin, github, personalWebsite, department, universityEmail } = req.body;

        if (!name || !major) {
            return res.status(400).json({ success: false, error: 'Name and Major are required.' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        user.name = name;
        user.major = major;
        user.department = department;
        user.universityEmail = universityEmail || null;
        user.linkedin = linkedin;
        user.github = github;
        user.personalWebsite = personalWebsite;

        // Automatically change role to 'student' if a university email is provided
        if (user.universityEmail) {
            user.role = 'student';
        }

        if (user.linkedin && !user.linkedin.startsWith('http')) {
            user.linkedin = `https://${user.linkedin}`;
        }
        if (user.github && !user.github.startsWith('http')) {
            user.github = `https://${user.github}`;
        }
        if (user.personalWebsite && !user.personalWebsite.startsWith('http')) {
            user.personalWebsite = `https://${user.personalWebsite}`;
        }

        if (req.file && req.file.path) {
            user.profilePic = req.file.path;
        }

        user.isProfileComplete = true;
        await user.save();

        req.session.isProfileComplete = true;
        req.session.userRole = user.role; // Update the session role
        await req.session.save();

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
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        user.isProfileComplete = true;
        await user.save();

        req.session.isProfileComplete = true;
        await req.session.save();

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
            socialLinks: {
                linkedin: user.linkedin || '',
                github: user.github || '',
                website: user.personalWebsite || ''
            },
            role: user.role,
            totalPoints: user.totalPoints || 0,
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

module.exports = router;