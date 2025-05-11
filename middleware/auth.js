const User = require('../models/User');

const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    res.status(401).json({ error: 'Please log in to access this page' });
};

const isProfileComplete = async (req, res, next) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        if (user.isProfileComplete) {
            return next();
        }
        res.status(403).json({ error: 'Please complete your profile' });
    } catch (error) {
        console.error('Profile check error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = { isAuthenticated, isProfileComplete };