const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cloudinary = require('cloudinary').v2;
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { isAuthenticated, isProfileComplete } = require('./middleware/auth');
const tags = require('./config/tags'); // This `tags` object is used in the global dynamic-filter-options route

// Initialize Express app
const app = express();

// Trust Render's proxy (important for deployed environments)
app.set('trust proxy', 1);

mongoose.set('strictQuery', true);
mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

// Session Configuration
const sessionStore = MongoStore.create({
    mongoUrl: process.env.MONGO_URL,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60, // 1 day
    autoRemove: 'native'
});

sessionStore.on('error', err => console.error('MongoStore error:', err));
sessionStore.on('connected', () => console.log('MongoStore connected successfully'));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax', // Consider 'None' if cross-site, but 'lax' usually works
        path: '/'
    }
}));

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000', // Ensure this matches your frontend URL
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files from the 'public' directory FIRST
app.use(express.static(path.join(__dirname, 'public')));


// Debug Session (keep this, very useful!)
app.use((req, res, next) => {
    console.log('Session middleware:', {
        sessionId: req.sessionID,
        userId: req.session.userId,
        cookies: req.cookies,
        path: req.path
    });
    next();
});

// Logging (keep this, also very useful!)
app.use((req, res, next) => {
    const originalJson = res.json;
    res.json = function (body) {
        // Only log JSON bodies, avoid logging sensitive data
        console.log(`Response: ${req.method} ${req.url} ${res.statusCode} ${JSON.stringify(body).substring(0, 150)}...`); // Limit length for logs
        return originalJson.call(this, body);
    };
    console.log(`Request: ${req.method} ${req.url} ${req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body).substring(0, 150) + '...' : ''} Session: ${(req.session && req.session.userId) || 'none'}`);
    next();
});

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// --- ROUTES ---
// Import your routers
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const projectRoutes = require('./routes/projects'); // Corrected import to 'projects.js'
const adminRoutes = require('./routes/admin');

// Mount your routers to their *correct* base paths
// authRoutes handles /current-user, /signup, /login, /logout, /user-details/:id, /user/:id/follow, /users/search
app.use('/', authRoutes);

// profileRoutes specifically handles routes prefixed with /profile
// e.g., router.get('/my-projects') in routes/profile.js becomes accessible at /profile/my-projects
app.use('/profile', profileRoutes);

// projectRoutes contains top-level API routes like /projects, /search, /project/:id,
// and /dynamic-filter-options (as per your projects.js file)
// Mounting it at '/' means these routes are accessible directly.
app.use('/', projectRoutes);

// adminRoutes should be prefixed if you want /admin/dashboard, /admin/users etc.
app.use('/admin', adminRoutes);


// Serve HTML Pages (ensure paths match your 'views' directory structure)
// These explicit app.get routes must come *before* any catch-all HTML routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'landing.html')));
app.get('/signup.html', (req, res) => res.sendFile(path.join(__dirname, 'views', 'signup.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));
app.get('/create-profile.html', isAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'views', 'create-profile.html')));
app.get('/index.html', isAuthenticated, isProfileComplete, (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));
app.get('/upload-project.html', isAuthenticated, isProfileComplete, (req, res) => res.sendFile(path.join(__dirname, 'views', 'upload-project.html')));
app.get('/project.html', (req, res) => res.sendFile(path.join(__dirname, 'views', 'project.html')));
app.get('/profile.html', isAuthenticated, isProfileComplete, (req, res) => res.sendFile(path.join(__dirname, 'views', 'profile.html')));
app.get('/settings.html', isAuthenticated, isProfileComplete, (req, res) => res.sendFile(path.join(__dirname, 'views', 'settings.html')));
app.get('/about.html', (req, res) => res.sendFile(path.join(__dirname, 'views', 'about.html')));
app.get('/edit-project.html', isAuthenticated, isProfileComplete, (req, res) => res.sendFile(path.join(__dirname, 'views', 'edit-project.html')));
app.get('/public-profile.html', (req, res) => res.sendFile(path.join(__dirname, 'views', 'public-profile.html')));
app.get('/admin/dashboard.html', isAuthenticated, async (req, res) => {
    // --- IMPORTANT: You still need proper role-based authorization here.
    // This example is just an `isAuthenticated` check.
    // You should add: if (req.session.userRole !== 'admin' && req.session.userRole !== 'sharecase_worker') { return res.redirect('/index.html'); }
    res.sendFile(path.join(__dirname, 'views', 'admin-dashboard.html'));
});

// Catch-all for API 404s and SPA routing
// This middleware should be placed AFTER all specific API and static file routes
app.use((req, res, next) => {
    // If it's a request for /favicon.ico and it wasn't caught by express.static,
    // just send a 204 No Content or the default.
    // express.static should handle favicon.ico if it's in /public.
    if (req.path === '/favicon.ico') {
        return res.status(204).end(); // No content for favicon if not found statically
    }

    // If an API route wasn't matched, and it's an AJAX request, send JSON 404
    const isAjaxRequest = req.xhr || req.headers.accept.includes('application/json');
    if (isAjaxRequest) {
        return res.status(404).json({ error: 'API endpoint not found', message: `No API route for ${req.method} ${req.url}` });
    }
    // For non-API requests (e.g., direct navigation to an unmatched HTML path),
    // serve index.html (or your main SPA entry point) from the 'views' directory.
    res.status(404).sendFile(path.join(__dirname, 'views', 'index.html')); // <-- CORRECTED PATH HERE
});

// General Error Handling Middleware (should always be last)
app.use((err, req, res, next) => {
    console.error('Global Server Error:', err.stack);
    const isAjaxRequest = req.xhr || req.headers.accept.includes('application/json');
    if (isAjaxRequest) {
        res.status(500).json({ error: 'Internal server error', message: err.message });
    } else {
        res.status(500).send('<h1>500 - Internal Server Error</h1><p>Something went wrong!</p>');
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));