// server.js

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cloudinary = require('cloudinary').v2;
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Assuming these are in place
const { isAuthenticated, isProfileComplete, authorizeAdmin } = require('./middleware/auth');
const tags = require('./config/tags');
const Project = require('./models/Project'); 
const User = require('./models/User'); 

const app = express();

// Set 'trust proxy' if your app is behind a reverse proxy (like Nginx, Heroku, etc.)
app.set('trust proxy', 1);

// Database Connection
mongoose.set('strictQuery', true);
mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

// Session Store
const sessionStore = MongoStore.create({
    mongoUrl: process.env.MONGO_URL,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60,
    autoRemove: 'native'
});

// Middleware
app.use(cors({
    origin: ['https://sharecase.live', 'http://localhost:3000'],
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        path: '/'
    }
}));

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// === Logging middleware for debugging ===
app.use((req, res, next) => {
    console.log(`Request: ${req.method} ${req.url} Session: ${(req.session && req.session.userId) || 'none'}`);
    next();
});

// Load Routers
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const projectRoutes = require('./routes/projects');
const adminRoutes = require('./routes/admin');
const portfolioRoutes = require('./routes/portfolio');

// Mount specific routes and routers first
app.use('/', authRoutes);
app.use('/profile', profileRoutes);
app.use('/', projectRoutes);
app.use('/admin', adminRoutes);
app.use('/portfolio', portfolioRoutes);

// Add the missing /profile/my-projects route for loading projects in profile.html
app.get('/profile/my-projects', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const projects = await Project.find({ userId: req.session.userId }).lean();
        res.json(projects);
    } catch (error) {
        console.error('Error fetching my projects:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

// Add the missing /user-details/:userId route for public profiles (already unprotected, moved to authRoutes for cleaner separation)
// NOTE: This route should now be defined in routes/auth.js

// Serve HTML files
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'landing.html')));
app.get('/signup.html', (req, res) => res.sendFile(path.join(__dirname, 'views', 'signup.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));
app.get('/create-profile.html', isAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'views', 'create-profile.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html'))); // Removed Auth Check
app.get('/upload-project.html', isAuthenticated, isProfileComplete, (req, res) => res.sendFile(path.join(__dirname, 'views', 'upload-project.html')));
app.get('/project.html', (req, res) => {
    // Check if user is logged in for the client-side to handle interactions, but allow the page to load
    res.sendFile(path.join(__dirname, 'views', 'project.html')); 
    // The client-side JS handles redirects if user needs to log in for specific actions (like liking/commenting)
});
app.get('/profile.html', isAuthenticated, isProfileComplete, (req, res) => res.sendFile(path.join(__dirname, 'views', 'profile.html')));
app.get('/settings.html', isAuthenticated, isProfileComplete, (req, res) => res.sendFile(path.join(__dirname, 'views', 'settings.html')));
app.get('/about.html', (req, res) => res.sendFile(path.join(__dirname, 'views', 'about.html')));
app.get('/edit-project.html', isAuthenticated, isProfileComplete, (req, res) => res.sendFile(path.join(__dirname, 'views', 'edit-project.html')));
app.get('/admin/dashboard.html', isAuthenticated, authorizeAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'admin-dashboard.html'));
});
app.get('/select-portfolio-type.html', isAuthenticated, isProfileComplete, (req, res) => {
    console.log('Serving select-portfolio-type.html for user:', req.session.userId);
    res.sendFile(path.join(__dirname, 'views', 'select-portfolio-type.html'));
});

// Specific routes for profile pages
// 🛑 FIX: Allow unauthenticated access to the public profile page
app.get('/profile/:userId', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'public-profile.html'));
});
app.get('/public-profile.html', (req, res) => {
    const userId = req.query.userId;
    if (userId) {
        // Use a 301/308 redirect to the clean URL path
        res.redirect(301, `/profile/${userId}`);
    } else {
        // Default behavior when no user ID is provided (redirect to home/login/error)
        res.redirect('/login.html');
    }
});

// === FIX: Move static file serving here, after all specific routes ===
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'views')));
// =====================================================================

// 404 handler for non-API requests
app.use((req, res, next) => {
    if (req.path === '/favicon.ico') {
        return res.status(204).end();
    }

    const isAjaxRequest = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
    if (isAjaxRequest) {
        return res.status(404).json({ error: 'API endpoint not found', message: `No API route for ${req.method} ${req.url}` });
    }
    res.status(404).sendFile(path.join(__dirname, 'views', 'landing.html'));
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global Server Error:', err.stack);
    const isAjaxRequest = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
    if (isAjaxRequest) {
        res.status(500).json({ error: 'Internal server error', message: err.message });
    } else {
        res.status(500).send('<h1>500 - Internal Server Error</h1><p>Something went wrong!</p>');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));