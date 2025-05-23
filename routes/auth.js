const express = require('express');
const bcrypt = require('bcryptjs');
const cloudinary = require('cloudinary').v2;
const User = require('../models/User');
const { isAuthenticated, isProfileComplete } = require('../middleware/auth');
const upload = require('../middleware/upload'); // Ensure this is correctly imported

const router = express.Router();

// Current User (Requires Authentication)
router.get('/current-user', isAuthenticated, async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.json({ isLoggedIn: false });
        }

        const user = await User.findById(req.session.userId)
            .select('name email profilePic major department bio linkedin github personalWebsite personalEmail privacy isProfileComplete'); // <--- ENSURE 'personalEmail' IS HERE!

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
                department: user.department || '', // Assuming you have this
                bio: user.bio || '', // Assuming you have this
                linkedin: user.linkedin || '',
                github: user.github || '',
                personalWebsite: user.personalWebsite || '',
                personalEmail: user.personalEmail || '', // <--- ENSURE THIS IS INCLUDED IN THE RESPONSE OBJECT
                privacy: user.privacy,
                isProfileComplete: user.isProfileComplete
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
        console.log('Signup attempt (backend):', { email, name, password: password ? '[provided]' : '[missing]' });

        if (!email || !password || !name) {
            console.log('Signup failed (backend): Missing fields:', { email, name, password: password ? '[provided]' : '[missing]' });
            return res.status(400).json({ success: false, error: 'All fields are required' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log('Signup failed (backend): Email already exists:', { email });
            return res.status(400).json({ success: false, error: 'Email already exists' });
        }

        console.log('Signup (backend): Hashing password...');
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log('Signup (backend): Hashed password (first 10 chars):', hashedPassword.substring(0, 10) + '...');
        // IMPORTANT DEBUG LOG: Log the full hashed password being saved
        console.log('Signup (backend): Full hashed password to be saved:', hashedPassword);


        const user = new User({
            email,
            password: hashedPassword,
            name,
            isProfileComplete: false,
        });

        await user.save();
        console.log('Signup (backend): User created:', { userId: user._id });

        req.session.userId = user._id.toString();
        req.session.userName = user.name;

        await new Promise((resolve, reject) => {
            req.session.save(err => {
                if (err) {
                    console.error('Signup (backend): Session save error:', err);
                    reject(err);
                } else {
                    console.log('Signup (backend): Session saved:', { userId: user._id, sessionId: req.sessionID });
                    resolve();
                }
            });
        });

        res.json({ success: true, redirect: '/create-profile.html' });
    } catch (error) {
        console.error('Signup error (backend):', error);
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
        // IMPORTANT DEBUG LOGS: Log the plain text password and the stored hash
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

        await new Promise((resolve, reject) => {
            req.session.save(err => {
                if (err) {
                    console.error('Login (backend): Session save error:', err);
                    reject(err);
                } else {
                    console.log('Login (backend): Session saved:', { userId: user._id, sessionId: req.sessionID });
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


// Add this new route in your auth.js file
router.post('/complete-profile', isAuthenticated, upload.single('profilePic'), async (req, res) => {
    try {
        const userId = req.session.userId;
        const { personalEmail, major, linkedin, github, personalWebsite, bio, department } = req.body;
        console.log('Complete profile attempt:', { userId, personalEmail, major, linkedin, github, personalWebsite, bio, department, file: req.file ? req.file.originalname : 'no file' });

        const user = await User.findById(userId);
        if (!user) {
            console.log('Complete profile failed: User not found:', userId);
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        user.personalEmail = personalEmail || user.personalEmail;
        user.major = major || user.major;
        user.linkedin = linkedin || user.linkedin;
        user.github = github || user.github;
        user.personalWebsite = personalWebsite || user.personalWebsite;
        user.bio = bio || user.bio;
        user.department = department || user.department;

        if (req.file) {
            if (user.profilePic && !user.profilePic.includes('default-profile.jpg')) {
                const publicId = user.profilePic.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`profile_pics/${publicId}`);
            }
            user.profilePic = req.file.path; // Multer's CloudinaryStorage provides the URL
            console.log('New profile pic URL:', user.profilePic);
        }

        user.isProfileComplete = true;
        await user.save();

        req.session.isProfileComplete = true;
        await req.session.save();

        console.log('Profile completed for user:', userId);
        res.json({ success: true, redirect: '/index.html' });
    } catch (error) {
        console.error('Error completing profile:', error);
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
        const user = await User.findById(userId).select('name email profilePic major linkedin github personalWebsite');

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
            personalWebsite: user.personalWebsite
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
        }).select('_id name email profilePic major');

        res.json(users);
    } catch (error) {
        console.error('User search error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;