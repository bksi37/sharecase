const express = require('express');
const bcrypt = require('bcryptjs');
const cloudinary = require('cloudinary').v2;
const User = require('../models/User');
const { isAuthenticated, isProfileComplete } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Current User (Requires Authentication)
router.get('/current-user', isAuthenticated, async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.json({ isLoggedIn: false });
        }

        const user = await User.findById(req.session.userId)
            .select('name email profilePic major department bio linkedin github personalWebsite privacy isProfileComplete role universityEmail universityEmailVerified');

        if (!user) {
            req.session.destroy();
            return res.json({ isLoggedIn: false });
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
                bio: user.bio || '',
                linkedin: user.linkedin || '',
                github: user.github || '',
                personalWebsite: user.personalWebsite || '',
                privacy: user.privacy,
                isProfileComplete: user.isProfileComplete,
                role: user.role,
                universityEmail: user.universityEmail || '',
                universityEmailVerified: user.universityEmailVerified
            }
        });

    } catch (error) {
        console.error('Error fetching current user:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Signup Route
router.post('/signup', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        console.log('Signup attempt:', { email, name, password: password ? '[provided]' : '[missing]' });

        if (!email || !password || !name) {
            console.log('Signup failed: Missing fields:', { email, name, password: password ? '[provided]' : '[missing]' });
            return res.status(400).json({ success: false, error: 'All fields are required' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log('Signup failed: Email already exists:', { email });
            return res.status(400).json({ success: false, error: 'Email already exists' });
        }

        const user = new User({
            email,
            password: password,
            name,
            isProfileComplete: false,
            role: 'external',
            universityEmail: null,
            universityEmailVerified: false
        });

        await user.save();
        console.log('Signup: User created:', { userId: user._id, role: user.role });

        req.session.userId = user._id.toString();
        req.session.userName = user.name;
        req.session.isProfileComplete = user.isProfileComplete;
        req.session.userRole = user.role;

        await new Promise((resolve, reject) => {
            req.session.save(err => {
                if (err) {
                    console.error('Signup: Session save error:', err);
                    reject(err);
                } else {
                    console.log('Signup: Session saved:', { userId: user._id, sessionId: req.sessionID, userRole: req.session.userRole });
                    resolve();
                }
            });
        });
        res.json({ success: true, redirect: '/create-profile.html' });
    } catch (error) {
        console.error('Signup error:', error);
        if (error.code === 11000) {
            return res.status(400).json({ success: false, error: 'Email already exists' });
        }
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Login Route
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Login attempt (backend):', { email, password: password ? '[provided]' : '[missing]' });

        if (!email || !password) {
            console.log('Login failed (backend): Missing fields:', { email, password: password ? '[provided]' : '[missing]' });
            return res.status(400).json({ success: false, error: 'Email and password are required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            console.log('Login failed (backend): User not found:', { email });
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        console.log('Login (backend): Comparing password for user:', { userId: user._id });
        console.log('Login (backend): Plain text password from request:', password);
        console.log('Login (backend): Hashed password from database:', user.password);

        const isMatch = await bcrypt.compare(password, user.password);
        console.log('Login (backend): bcrypt.compare result:', isMatch);

        if (!isMatch) {
            console.log('Login failed (backend): Invalid password for:', { email });
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        req.session.userId = user._id.toString();
        req.session.userName = user.name;
        req.session.isProfileComplete = user.isProfileComplete;
        req.session.userRole = user.role;

        await new Promise((resolve, reject) => {
            req.session.save(err => {
                if (err) {
                    console.error('Login (backend): Session save error:', err);
                    reject(err);
                } else {
                    console.log('Login (backend): Session saved:', { userId: user._id, sessionId: req.sessionID, userRole: req.session.userRole });
                    resolve();
                }
            });
        });

        const redirect = user.isProfileComplete ? '/index.html' : '/create-profile.html';
        console.log('Login successful (backend):', { userId: user._id, redirect });
        res.json({ success: true, redirect });
    } catch (error) {
        console.error('Login error (backend):', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Complete Profile (Updated for Multer)
router.post('/complete-profile', isAuthenticated, upload.single('profilePic'), async (req, res) => {
    try {
        const userId = req.session.userId;
        const { name, major, linkedin, github, personalWebsite, bio, department } = req.body;
        console.log('Complete profile attempt:', { userId, name, major, linkedin, github, personalWebsite, bio, department, file: req.file ? req.file.originalname : 'no file' });

        const user = await User.findById(userId);
        if (!user) {
            console.log('Complete profile failed: User not found:', userId);
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        user.name = name;
        user.major = major;
        user.linkedin = linkedin;
        user.github = github;
        user.personalWebsite = personalWebsite;
        user.bio = bio;
        user.department = department;

        let processedLinkedin = linkedin;
        if (processedLinkedin && !processedLinkedin.startsWith('http://') && !processedLinkedin.startsWith('https://')) {
            processedLinkedin = `https://${processedLinkedin}`;
        }
        user.linkedin = processedLinkedin;

        if (req.file && req.file.path) {
            // Optional: Add logic to delete old profile pic from Cloudinary if it's not default
            // if (user.profilePic && !user.profilePic.includes('default-profile.jpg')) {
            //     const publicId = user.profilePic.split('/').pop().split('.')[0];
            //     await cloudinary.uploader.destroy(`sharecase/profiles/${publicId}`);
            // }
            user.profilePic = req.file.path;
            console.log('New profile pic URL assigned from Multer (profile.js):', user.profilePic);
        } else {
            console.log('No new profile pic uploaded in update-profile. Retaining existing.');
        }

        user.isProfileComplete = true;
        await user.save();

        req.session.isProfileComplete = true;
        await req.session.save();

        console.log('Profile completed for user:', userId);
        res.json({ success: true, redirect: '/index.html' });
    } catch (error) {
        console.error('Error completing profile:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, error: error.message });
        }
        // Ensure 'multer' is imported if you use 'multer.MulterError'
        // if (error instanceof multer.MulterError) {
        //     console.error('Multer Error during update-profile:', error.message);
        //     return res.status(400).json({ success: false, error: `File upload error: ${error.message}` });
        // }
        res.status(500).json({ success: false, error: 'Server error', details: error.message });
    }
});

//skip-profile-completion
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
        const user = await User.findById(userId).select('name email profilePic major linkedin github personalWebsite role');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            profilePic: user.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg',
            major: user.major,
            linkedin: user.linkedin,
            github: user.github,
            personalWebsite: user.personalWebsite,
            role: user.role
        });

    } catch (error) {
        console.error('Error fetching public user details:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid user ID format' });
        }
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// Search Users for Collaboration (Requires Authentication for search functionality)
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
            ]
        }).select('_id name email profilePic major role');

        res.json(users);
    } catch (error) {
        console.error('User search error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- NEW ROUTE: Get Overall User Analytics (for Admins/ShareCase Workers) ---
router.get('/admin/analytics/users', isAuthenticated, async (req, res) => {
    try {
        // --- Authorization Check: Only 'admin' or 'sharecase_worker' can access ---
        if (req.session.userRole !== 'admin' && req.session.userRole !== 'sharecase_worker') {
            return res.status(403).json({ message: 'Access denied. Insufficient privileges.' });
        }

        const totalUsers = await User.countDocuments();
        const usersByRole = await User.aggregate([
            { $group: { _id: "$role", count: { $sum: 1 } } }
        ]);
        const newUsersLast30Days = await User.countDocuments({
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        });

        res.json({
            totalUsers,
            usersByRole,
            newUsersLast30Days
        });

    } catch (error) {
        console.error('Error fetching user analytics:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- NEW ROUTE: Follow/Unfollow User ---
router.post('/user/:id/follow', isAuthenticated, async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const currentUserId = req.session.userId;

        if (targetUserId === currentUserId) {
            return res.status(400).json({ message: 'Cannot follow yourself.' });
        }

        const currentUser = await User.findById(currentUserId);
        const targetUser = await User.findById(targetUserId);

        if (!currentUser || !targetUser) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const isFollowing = currentUser.following.includes(targetUserId);

        if (isFollowing) {
            // Unfollow
            currentUser.following.pull(targetUserId);
            targetUser.followers.pull(currentUserId);
            await currentUser.save();
            await targetUser.save();
            res.json({ success: true, message: 'Unfollowed user.', isFollowing: false });
        } else {
            // Follow
            currentUser.following.push(targetUserId);
            targetUser.followers.push(currentUserId);
            await currentUser.save();
            await targetUser.save();
            res.json({ success: true, message: 'Followed user.', isFollowing: true });
        }

    } catch (error) {
        console.error('Error following/unfollowing user:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
