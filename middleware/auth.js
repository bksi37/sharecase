const User = require('../models/User');

const isAuthenticated = (req, res, next) => {
    // console.log(`isAuthenticated middleware called for: ${req.originalUrl}, Method: ${req.method}`); // Debug log
    // console.log(`Session userId in isAuthenticated: ${req.session.userId}`); // Debug log

    // Determine if the request is an AJAX call (e.g., from fetch/XMLHttpRequest)
    const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

    if (req.session.userId) {
        // User is authenticated, proceed to the next middleware or route handler
        // console.log(`isAuthenticated: User ${req.session.userId} is authenticated.`); // Debug log
        return next();
    } else {
        // User is NOT authenticated
        console.log(`isAuthenticated: User not authenticated for ${req.originalUrl}. Session userId is missing or invalid.`);

        if (wantsJson) {
            // For AJAX requests expecting JSON, send a 401 Unauthorized JSON response
            console.log('isAuthenticated: Detected AJAX request, sending 401 JSON response.');
            return res.status(401).json({
                success: false,
                error: 'Unauthorized. Please log in.',
                redirect: '/login.html' // Suggest where the frontend should redirect
            });
        } else {
            // For regular browser navigation requests, redirect to the login page
            console.log('isAuthenticated: Detected regular browser request, redirecting to /login.html.');
            return res.redirect('/login.html');
        }
    }
};

const isProfileComplete = async (req, res, next) => {
    try {
        // console.log(`isProfileComplete middleware called for: ${req.originalUrl}, Method: ${req.method}`); // Debug log
        // console.log(`Session userId in isProfileComplete: ${req.session.userId}`); // Debug log

        // Determine if the request is an AJAX call (expecting JSON)
        const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

        // Ensure user is authenticated before checking profile completion
        if (!req.session.userId) {
            console.log('isProfileComplete: No session userId, redirecting to login.');
            if (wantsJson) {
                return res.status(401).json({ success: false, error: 'Unauthorized. Please log in.', redirect: '/login.html' });
            } else {
                return res.redirect('/login.html');
            }
        }

        const user = await User.findById(req.session.userId);

        if (!user) {
            // This case ideally shouldn't happen if isAuthenticated runs first,
            // but it's good defensive programming.
            console.log('isProfileComplete: User not found for session ID:', req.session.userId);
            if (wantsJson) {
                return res.status(401).json({ success: false, error: 'User session invalid. Please log in.', redirect: '/login.html' });
            } else {
                return res.redirect('/login.html');
            }
        }

        // console.log('User profile state:', { userId: user._id, isProfileComplete: user.isProfileComplete }); // Debug log

        if (user.isProfileComplete === true) {
            // console.log('isProfileComplete: Profile is complete, proceeding.'); // Debug log
            return next();
        } else {
            console.log('isProfileComplete: Profile is NOT complete, redirecting.');
            if (wantsJson) {
                // For AJAX requests, send a 403 Forbidden JSON response
                return res.status(403).json({
                    success: false,
                    error: 'Profile not complete. Please complete your profile.',
                    redirect: '/create-profile.html' // Suggest where the frontend should redirect
                });
            } else {
                // For regular browser navigation requests, redirect to the profile completion page
                return res.redirect('/create-profile.html?redirected=true'); // Added query param for client-side message
            }
        }
    } catch (error) {
        console.error('Profile check error:', error);
        res.status(500).json({ error: 'Server error during profile check' });
    }
};

// Middleware to check for Admin or ShareCase Worker role
const authorizeAdminOrShareCaseWorker = (req, res, next) => {
    const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

    if (!req.session.userRole || (req.session.userRole !== 'admin' && req.session.userRole !== 'sharecase_worker')) {
        console.log(`Authorization failed for ${req.originalUrl}: User role '${req.session.userRole}' not 'admin' or 'sharecase_worker'.`);
        if (wantsJson) {
            return res.status(403).json({ success: false, message: 'Access denied. Insufficient privileges.' });
        } else {
            return res.redirect('/index.html'); // Redirect to home or a forbidden page
        }
    }
    console.log(`Authorization successful for ${req.originalUrl}: User role '${req.session.userRole}'.`);
    next();
};

// Middleware to check for Admin or Faculty role
const authorizeAdminOrFaculty = (req, res, next) => {
    const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

    if (!req.session.userRole || (req.session.userRole !== 'admin' && req.session.userRole !== 'faculty')) {
        console.log(`Authorization failed for ${req.originalUrl}: User role '${req.session.userRole}' not 'admin' or 'faculty'.`);
        if (wantsJson) {
            return res.status(403).json({ success: false, message: 'Access denied. Insufficient privileges.' });
        } else {
            return res.redirect('/index.html'); // Redirect to home or a forbidden page
        }
    }
    console.log(`Authorization successful for ${req.originalUrl}: User role '${req.session.userRole}'.`);
    next();
};


module.exports = {
    isAuthenticated,
    isProfileComplete,
    authorizeAdminOrShareCaseWorker,
    authorizeAdminOrFaculty
};