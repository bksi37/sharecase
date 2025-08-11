const User = require('../models/User');

const isAuthenticated = (req, res, next) => {
    // Check if the request is an AJAX/API call (expects a JSON response)
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
                redirect: `/login.html?redirectedFrom=${encodeURIComponent(req.originalUrl)}`
            });
        } else {
            // For regular browser navigation, redirect to the login page with a return URL
            return res.redirect(`/login.html?redirectedFrom=${encodeURIComponent(req.originalUrl)}`);
        }
    }
};

const isProfileComplete = async (req, res, next) => {
    const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

    try {
        if (!req.session.userId) {
            if (wantsJson) {
                return res.status(401).json({ success: false, error: 'Unauthorized. Please log in.', redirect: `/login.html?redirectedFrom=${encodeURIComponent(req.originalUrl)}` });
            } else {
                return res.redirect(`/login.html?redirectedFrom=${encodeURIComponent(req.originalUrl)}`);
            }
        }

        const user = await User.findById(req.session.userId);

        if (!user) {
            // User ID in session does not match a user in the database
            if (wantsJson) {
                return res.status(401).json({ success: false, error: 'User session invalid. Please log in.', redirect: `/login.html?redirectedFrom=${encodeURIComponent(req.originalUrl)}` });
            } else {
                return res.redirect(`/login.html?redirectedFrom=${encodeURIComponent(req.originalUrl)}`);
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
        if (wantsJson) {
            return res.status(500).json({ error: 'Server error during profile check' });
        } else {
            res.status(500).send('<h1>500 - Internal Server Error</h1><p>Something went wrong!</p>');
        }
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
