// middleware/auth.js
const User = require('../models/User');

const isAuthenticated = async (req, res, next) => {
    const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

    if (req.session.userId) {
        try {
            const user = await User.findById(req.session.userId);
            if (user) {
                req.user = user;
                return next();
            }
        } catch (error) {
            console.error('Error in isAuthenticated:', error);
        }
    }

    if (wantsJson) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized. Please log in.',
            redirect: `/login.html?redirectedFrom=${encodeURIComponent(req.originalUrl)}`
        });
    } else {
        return res.redirect(`/login.html?redirectedFrom=${encodeURIComponent(req.originalUrl)}`);
    }
};

const isProfileComplete = async (req, res, next) => {
    const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

    try {
        if (!req.session.userId) {
            if (wantsJson) {
                return res.status(401).json({
                    success: false,
                    error: 'Unauthorized. Please log in.',
                    redirect: `/login.html?redirectedFrom=${encodeURIComponent(req.originalUrl)}`
                });
            } else {
                return res.redirect(`/login.html?redirectedFrom=${encodeURIComponent(req.originalUrl)}`);
            }
        }

        const user = await User.findById(req.session.userId);
        if (!user) {
            if (wantsJson) {
                return res.status(401).json({
                    success: false,
                    error: 'User session invalid. Please log in.',
                    redirect: `/login.html?redirectedFrom=${encodeURIComponent(req.originalUrl)}`
                });
            } else {
                return res.redirect(`/login.html?redirectedFrom=${encodeURIComponent(req.originalUrl)}`);
            }
        }

        if (user.isProfileComplete) {
            return next();
        } else {
            if (wantsJson) {
                return res.status(403).json({
                    success: false,
                    error: 'Profile not complete. Please complete your profile.',
                    redirect: '/create-profile.html?redirected=true'
                });
            } else {
                return res.redirect('/create-profile.html?redirected=true');
            }
        }
    } catch (error) {
        console.error('Profile check error:', error);
        if (wantsJson) {
            return res.status(500).json({ error: 'Server error during profile check' });
        } else {
            res.status(500).send('<h1>500 - Internal Server Error</h1><p>Something went wrong!</p>');
        }
    }
};

const authorizeAdmin = (req, res, next) => {
    const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

    if (req.session.userRole === 'admin') {
        return next();
    }
    if (wantsJson) {
        return res.status(403).json({ success: false, message: 'Access denied. Admin privileges required.' });
    } else {
        return res.redirect('/admin-dashboard.html');
    }
};

const authorizeFaculty = (req, res, next) => {
    const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

    if (req.session.userRole === 'admin' || req.session.userRole === 'faculty') {
        return next();
    }
    if (wantsJson) {
        return res.status(403).json({ success: false, message: 'Access denied. Admin or faculty privileges required.' });
    } else {
        return res.redirect('/index.html');
    }
};

module.exports = { isAuthenticated, isProfileComplete, authorizeAdmin, authorizeFaculty };