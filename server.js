const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cloudinary = require('cloudinary').v2;
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { isAuthenticated, isProfileComplete, authorizeAdmin } = require('./middleware/auth');
const tags = require('./config/tags');

const app = express();

app.set('trust proxy', 1);

mongoose.set('strictQuery', true);
mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

const sessionStore = MongoStore.create({
    mongoUrl: process.env.MONGO_URL,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60,
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
        maxAge: 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        path: '/'
    }
}));

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
    console.log('Session middleware:', {
        sessionId: req.sessionID,
        userId: req.session.userId,
        cookies: req.cookies,
        path: req.path
    });
    next();
});

app.use((req, res, next) => {
    const originalJson = res.json;
    res.json = function (body) {
        console.log(`Response: ${req.method} ${req.url} ${res.statusCode} ${JSON.stringify(body).substring(0, 150)}...`);
        return originalJson.call(this, body);
    };
    console.log(`Request: ${req.method} ${req.url} ${req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body).substring(0, 150) + '...' : ''} Session: ${(req.session && req.session.userId) || 'none'}`);
    next();
});

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
app.get('/select-portfolio-type.html', isAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'views', 'select-portfolio-type.html')));
app.get('/admin/dashboard.html', isAuthenticated, authorizeAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'admin-dashboard.html'));
});

app.use((req, res, next) => {
    if (req.path === '/favicon.ico') {
        return res.status(204).end();
    }

    const isAjaxRequest = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
    if (isAjaxRequest) {
        return res.status(404).json({ error: 'API endpoint not found', message: `No API route for ${req.method} ${req.url}` });
    }
    res.status(404).sendFile(path.join(__dirname, 'views', 'index.html'));
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