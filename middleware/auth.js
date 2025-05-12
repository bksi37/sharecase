const User = require('../models/User');

const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    res.status(401).json({ error: 'Please log in to access this resource' });
};

const isProfileComplete = async (req, res, next) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (user.profileComplete) {
            return next();
        }
        res.redirect('/create-profile.html');
    } catch (error) {
        console.error('Profile check error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = { isAuthenticated, isProfileComplete };