const express = require('express');
const bcrypt = require('bcryptjs');
const cloudinary = require('cloudinary').v2;
const User = require('../models/User');
const { isAuthenticated, isProfileComplete } = require('../middleware/auth'); // Ensure this path is correct
const upload = require('../middleware/upload'); // Multer for file uploads

const router = express.Router();

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

// Signup Route
router.post('/signup', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ success: false, error: 'All fields are required' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, error: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            email,
            password: hashedPassword,
            name,
            isProfileComplete: false,
            role: 'external',
            universityEmail: null,
            universityEmailVerified: false,
            followers: [],
            following: [],
            totalPoints: 0
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

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password are required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
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

// Follow/Unfollow User
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
            currentUser.following.pull(targetUserId);
            targetUser.followers.pull(currentUserId);
            await currentUser.save();
            await targetUser.save();
            res.json({ success: true, message: 'Unfollowed user.', isFollowing: false });
        } else {
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