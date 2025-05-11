const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { check, validationResult } = require('express-validator');
const router = express.Router();

// Signup
router.post('/signup', [
    check('email').isEmail().withMessage('Invalid email'),
    check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { email, password } = req.body;
        if (!email.endsWith('.edu')) {
            return res.status(400).json({ error: 'Please use a .edu email' });
        }
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        user = new User({ email, password: hashedPassword });
        await user.save();
        req.session.userId = user._id;
        res.json({ success: true });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }
        req.session.userId = user._id;
        // Check if the request is AJAX (based on Accept header or X-Requested-With)
        const isAjax = req.get('X-Requested-With') === 'XMLHttpRequest' || req.accepts('json');
        if (isAjax) {
            // For AJAX, return JSON
            res.json({ success: true, isProfileComplete: user.isProfileComplete });
        } else {
            // For non-AJAX, redirect based on profile completion
            if (user.isProfileComplete) {
                res.redirect('/index.html');
            } else {
                res.redirect('/create-profile.html');
            }
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        res.redirect('/login.html');
    });
});

// Current User
router.get('/current-user', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            email: user.email,
            name: user.name,
            profilePic: user.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg'
        });
    } catch (error) {
        console.error('Current user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;