const User = require('../models/User');

const isAuthenticated = (req, res, next) => {
    console.log('isAuthenticated:', { sessionId: req.session.userId });
    if (req.session.userId) {
        return next();
    }
    res.status(401).json({ error: 'Please log in to access this resource' });
};

const isProfileComplete = async (req, res, next) => {
    try {
        console.log('isProfileComplete:', { userId: req.session.userId });
        const user = await User.findById(req.session.userId);
        if (!user) {
            console.log('User not found:', req.session.userId);
            return res.status(404).json({ error: 'User not found' });
        }
        console.log('User profile state:', { userId: user._id, profileComplete: user.profileComplete });
        if (user.profileComplete === true) {
            return next();
        }
        res.status(403).json({ error: 'Profile incomplete', redirect: '/create-profile.html?redirected=true' });
    } catch (error) {
        console.error('Profile check error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = { isAuthenticated, isProfileComplete };