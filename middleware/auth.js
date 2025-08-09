const User = require('../models/User');

const isAuthenticated = (req, res, next) => {
    // Check if the request is an AJAX/API call (expects JSON response)
    const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

    if (req.session.userId) {
        // User is authenticated, proceed
        return next();
    } else {
        // User is NOT authenticated
        if (wantsJson) {
            // For AJAX/API requests, send a 401 Unauthorized JSON response
            return res.status(401).json({
                success: false,
                error: 'Unauthorized. Please log in.',
                redirect: '/login.html' // Suggest where the frontend should redirect
            });
        } else {
            // For regular browser navigation, redirect to the login page
            return res.redirect('/login.html');
        }
    }
};

const isProfileComplete = async (req, res, next) => {
    try {
        const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

        if (!req.session.userId) {
            if (wantsJson) {
                return res.status(401).json({ success: false, error: 'Unauthorized. Please log in.', redirect: '/login.html' });
            } else {
                return res.redirect('/login.html');
            }
        }

        const user = await User.findById(req.session.userId);

        if (!user) {
            if (wantsJson) {
                return res.status(401).json({ success: false, error: 'User session invalid. Please log in.', redirect: '/login.html' });
            } else {
                return res.redirect('/login.html');
            }
        }

        if (user.isProfileComplete === true) {
            return next();
        } else {
            if (wantsJson) {
                return res.status(403).json({
                    success: false,
                    error: 'Profile not complete. Please complete your profile.',
                    redirect: '/create-profile.html'
                });
            } else {
                return res.redirect('/create-profile.html?redirected=true');
            }
        }
    } catch (error) {
        console.error('Profile check error:', error);
        res.status(500).json({ error: 'Server error during profile check' });
    }
};

const authorizeAdmin = (req, res, next) => {
    const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

    if (!req.session.userRole || req.session.userRole !== 'admin') {
        if (wantsJson) {
            return res.status(403).json({ success: false, message: 'Access denied. Insufficient privileges.' });
        } else {
            return res.redirect('/index.html');
        }
    }
    next();
};

const authorizeFaculty = (req, res, next) => {
    const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

    if (!req.session.userRole || (req.session.userRole !== 'admin' && req.session.userRole !== 'faculty')) {
        if (wantsJson) {
            return res.status(403).json({ success: false, message: 'Access denied. Insufficient privileges.' });
        } else {
            return res.redirect('/index.html');
        }
    }
    next();
};

module.exports = {
    isAuthenticated,
    isProfileComplete,
    authorizeAdmin,
    authorizeFaculty
};