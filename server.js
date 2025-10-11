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

// Middleware and Config are imported early, but Models are not used until routes are required.
const { isAuthenticated, isProfileComplete, authorizeAdmin } = require('./middleware/auth');
const tags = require('./config/tags');
// We require the models here to satisfy the routes, but we rely on the .then() block
// to ensure no queries run before the connection is established.
const Project = require('./models/Project');
const User = require('./models/User');

const app = express();

app.set('trust proxy', 1);

mongoose.set('strictQuery', true);

const sessionStore = MongoStore.create({
    mongoUrl: process.env.MONGO_URL,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60,
    autoRemove: 'native'
});

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

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.use((req, res, next) => {
    // FIX: Removed logging the session ID here as it's cleaner in the global error handler.
    console.log(`Request: ${req.method} ${req.url}`);
    next();
});

// *******************************************************************
// FIX IMPLEMENTED HERE: Defer routes and server start until MongoDB connects
// *******************************************************************

mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log('MongoDB connected successfully');

        // --- 1. ROUTE IMPORTS AND USAGE (MUST BE HERE) ---
        const authRoutes = require('./routes/auth');
        const profileRoutes = require('./routes/profile');
        const projectRoutes = require('./routes/projects');
        const adminRoutes = require('./routes/admin');
        const portfolioRoutes = require('./routes/portfolio');
        
        app.use('/', authRoutes);
        app.use('/profile', profileRoutes);
        app.use('/', projectRoutes);
        app.use('/admin', adminRoutes);
        app.use('/portfolio', portfolioRoutes);

        // --- 2. DATA-DEPENDENT ROUTES (Move here for safety) ---
        app.get('/profile/my-projects', isAuthenticated, isProfileComplete, async (req, res) => {
            try {
                const projects = await Project.find({ userId: req.session.userId }).lean();
                res.json(projects);
            } catch (error) {
                console.error('Error fetching my projects:', error);
                res.status(500).json({ error: 'Internal server error', message: error.message });
            }
        });

        // --- 3. HTML FILE ROUTES (Can stay, but grouped here) ---
        app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'landing.html')));
        app.get('/signup.html', (req, res) => res.sendFile(path.join(__dirname, 'views', 'signup.html')));
        app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));
        app.get('/create-profile.html', isAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'views', 'create-profile.html')));
        app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));
        app.get('/upload-project.html', isAuthenticated, isProfileComplete, (req, res) => res.sendFile(path.join(__dirname, 'views', 'upload-project.html')));
        app.get('/project.html', (req, res) => {
            res.sendFile(path.join(__dirname, 'views', 'project.html'));
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
        app.get('/store-placeholder.html', (req, res) => {
            // NOTE: Ensure 'views/store-placeholder.html' exists to avoid the ENOENT error.
            res.sendFile(path.join(__dirname, 'views', 'store-placeholder.html'));
        });
        app.get('/profile/:userId', (req, res) => {
            res.sendFile(path.join(__dirname, 'views', 'public-profile.html'));
        });
        app.get('/public-profile.html', (req, res) => {
            const userId = req.query.userId;
            if (userId) {
                res.redirect(301, `/profile/${userId}`);
            } else {
                res.redirect('/login.html');
            }
        });

        // --- 4. STATIC ASSETS AND ERROR HANDLERS (Must be last) ---
        app.use(express.static(path.join(__dirname, 'public')));
        // Removed: app.use(express.static(path.join(__dirname, 'views'))); // Redundant if files are served above

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

    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

// Note: Everything after this point is unreachable until the database connection is resolved.