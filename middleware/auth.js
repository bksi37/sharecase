const User = require('../models/User');

const isAuthenticated = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Please log in' });
    }
    next();
};

const isProfileComplete = async (req, res, next) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (!user.isProfileComplete) {
            return res.status(403).json({ error: 'Please complete your profile' });
        }
        next();
    } catch (error) {
        console.error('isProfileComplete error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = { isAuthenticated, isProfileComplete };