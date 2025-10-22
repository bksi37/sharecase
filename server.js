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

// Middleware and Config
const { isAuthenticated, isProfileComplete, authorizeAdmin } = require('./middleware/auth');
const tags = require('./config/tags');
// Models (loaded for routes but used after connection)
const Project = require('./models/Project');
const User = require('./models/User');

const app = express();

app.set('trust proxy', 1);
mongoose.set('strictQuery', true);

// Session store
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

// Cloudinary config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Request logging
app.use((req, res, next) => {
    console.log(`Request: ${req.method} ${req.url}`);
    next();
});

// MongoDB connection and routes
mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log('MongoDB connected successfully');

        // Route imports
        const authRoutes = require('./routes/auth');
        const profileRoutes = require('./routes/profile');
        const projectRoutes = require('./routes/projects');
        const adminRoutes = require('./routes/admin');
        const portfolioRoutes = require('./routes/portfolio');

        // Mount routes
        app.use('/', authRoutes);
        app.use('/profile', profileRoutes);
        
        // --- FIX: Add a specific mount for /search to ensure the client-side call works ---
        // This is done by checking if the projects router has a dedicated handler for /search.
        // It should also handle any other routes in projectRoutes that need to be at root (e.g., if /projects route is defined as router.get('/', ...))
        // Since projectRoutes contains '/search', we extract it to the root path.
        // Option A: Mount projectsRoutes twice (less clean)
        // app.use('/', projectRoutes); // If many project routes are root
        // Option B: Better approach for your current setup:
        app.use('/projects', projectRoutes); // Keeps the main project API routes namespaced
        
        // Manually mount the /search endpoint to the root path:
        // Note: This relies on the global search being the only thing hitting /search.
        app.get('/search', projectRoutes.stack.find(layer => layer.route && layer.route.path === '/search')?.route.stack[0].handle || ((req, res) => res.status(404).json({ error: 'Search route handler missing.' })));
        
        // Note: For simplicity and based on common practice, I recommend confirming if the correct mount for projectRoutes is `/` instead of `/projects`.
        // If all routes in projects.js should be under /projects, then the client call in scripts.js must change to `/projects/search?...`.
        // Assuming you want the client-side JS to remain:
        // app.use('/', projectRoutes); // <-- Uncomment this line and REMOVE the line below to mount projectRoutes at root (common for a single-page app API)
        
        // I will keep the original mounting for /projects, but also add the /search route at the root for compatibility:
        
        app.use('/admin', adminRoutes);
        app.use('/portfolio', portfolioRoutes);

        // Data-dependent routes
        app.get('/profile/my-projects', isAuthenticated, isProfileComplete, async (req, res) => {
            try {
                const projects = await Project.find({ userId: req.session.userId }).lean();
                res.json(projects);
            } catch (error) {
                console.error('Error fetching my projects:', error);
                res.status(500).json({ error: 'Internal server error', message: error.message });
            }
        });

        // HTML file routes
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

        // Static assets
        app.use(express.static(path.join(__dirname, 'public')));

        // 404 handler
        app.use((req, res, next) => {
            if (req.path === '/favicon.ico') {
                return res.status(204).end();
            }
            const isAjaxRequest = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
            if (isAjaxRequest) {
                // Return JSON for all missing API endpoints to prevent client-side JSON parsing errors
                return res.status(404).json({ error: 'API endpoint not found', message: `No API route for ${req.method} ${req.url}` });
            }
            res.status(404).sendFile(path.join(__dirname, 'views', 'landing.html'));
        });

        // Error handler
        app.use((err, req, res, next) => {
            console.error('Global Server Error:', err, err.stack);
            const isAjaxRequest = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
            const errorMessage = err.message || 'Internal server error';
            if (isAjaxRequest) {
                res.status(500).json({ error: 'Server error', details: errorMessage });
            } else {
                res.status(500).send(`<h1>500 - Internal Server Error</h1><p>${errorMessage}</p>`);
            }
        });

        // Start server
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });