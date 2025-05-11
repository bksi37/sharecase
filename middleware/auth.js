const User = require('../models/User');

exports.isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/login.html');
};

exports.isProfileComplete = async (req, res, next) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.redirect('/login.html');
        }
        if (user.isProfileComplete) {
            return next();
        }
        res.redirect('/create-profile.html');
    } catch (error) {
        console.error('Profile check error:', error);
        res.redirect('/login.html');
    }
};