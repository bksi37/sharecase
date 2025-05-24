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
const tags = require('./config/tags');

// Initialize Express app
const app = express();

// Trust Render's proxy
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
        sameSite: 'lax',
        path: '/'
    }
}));

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Debug Session
app.use((req, res, next) => {
    console.log('Session middleware:', { 
        sessionId: req.sessionID, 
        userId: req.session.userId, 
        cookies: req.cookies, 
        path: req.path 
    });
    next();
});

// Logging
app.use((req, res, next) => {
    const originalJson = res.json;
    res.json = function (body) {
        console.log(`Response: ${req.method} ${req.url} ${res.statusCode} ${JSON.stringify(body)}`);
        return originalJson.call(this, body);
    };
    console.log(`Request: ${req.method} ${req.url} ${JSON.stringify(req.body)} Session: ${(req.session && req.session.userId) || 'none'}`);
    next();
});

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Routes
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const projectRoutes = require('./routes/projects');

app.use('/', authRoutes);
app.use('/', profileRoutes);
app.use('/', projectRoutes);

// Dynamic Filter Options
app.get('/dynamic-filter-options', (req, res) => {
    res.json({
        // Change these keys to match what the frontend expects
        courses: tags.OU_ENGINEERING_COURSES || [],
        categories: tags.PROJECT_CATEGORIES || [],
        
        // These are already correct
        years: tags.years || [],
        types: tags.types || [],
        departments: tags.departments || [],
    });
});

// Serve HTML Pages
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

// Error Handling
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));