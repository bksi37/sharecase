const express = require('express');
const bcrypt = require('bcryptjs');
const cloudinary = require('cloudinary').v2;
const User = require('../models/User');
const { isAuthenticated, isProfileComplete } = require('../middleware/auth');
const router = express.Router();

// Current User
router.get('/current-user', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            name: user.name,
            profilePic: user.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg'
        });
    } catch (error) {
        console.error('Fetch current user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Signup
router.post('/signup', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        console.log('Signup attempt:', { email });
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ email, password: hashedPassword, name, profileComplete: false });
        await user.save();
        req.session.userId = user._id.toString();
        req.session.userName = user.name;
        await req.session.save();
        console.log('Signup successful:', { userId: user._id });
        res.json({ success: true, redirect: '/create-profile.html' });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Login attempt:', { email });
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const user = await User.findOne({ email });
        if (!user || !await bcrypt.compare(password, user.password)) {
            console.log('Invalid credentials:', { email });
            return res.status(400).json({ error: 'Invalid email or password' });
        }
        req.session.userId = user._id.toString();
        req.session.userName = user.name;
        await req.session.save(err => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ error: 'Session error' });
            }
            console.log('Login successful:', { userId: user._id, profileComplete: user.profileComplete });
            const redirect = user.profileComplete === true ? '/index.html' : '/create-profile.html';
            res.json({
                success: true,
                isProfileComplete: user.profileComplete,
                redirect
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Complete Profile
router.post('/complete-profile', isAuthenticated, async (req, res) => {
    try {
        const { name, linkedin } = req.body;
        console.log('Complete profile attempt:', { userId: req.session.userId, name, linkedin });
        const user = await User.findById(req.session.userId);
        if (!user) {
            console.log('User not found:', req.session.userId);
            return res.status(404).json({ error: 'User not found' });
        }
        let profilePic = user.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg';
        if (req.files && req.files.profilePic) {
            const file = req.files.profilePic;
            const result = await cloudinary.uploader.upload(`data:${file.mimetype};base64,${file.data.toString('base64')}`, {
                folder: 'sharecase/profiles',
                format: 'jpg'
            });
            profilePic = result.secure_url;
        }
        user.name = name || user.name;
        user.linkedin = linkedin || '';
        user.profilePic = profilePic;
        user.profileComplete = true;
        await user.save();
        await req.session.save();
        console.log('Profile completed:', { userId: user._id, profileComplete: user.profileComplete });
        res.json({ success: true, redirect: '/index.html' });
    } catch (error) {
        console.error('Complete profile error:', error);
        res.status(500).json({ error: 'Server error' });
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

module.exports = router;