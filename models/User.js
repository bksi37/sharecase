const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    name: {
        type: String,
        default: ''
    },
    role: {
        type: String,
        enum: ['external', 'student', 'alumni', 'faculty', 'sharecase_worker', 'admin'],
        default: 'external'
    },
    universityEmail: {
        type: String,
        unique: true,
        sparse: true
    },
    universityEmailVerified: {
        type: Boolean,
        default: false
    },
    major: { type: String, default: '' },
    profilePic: { type: String, default: 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg' },
    linkedin: { type: String, default: '' },
    github: { type: String, default: '' },
    personalWebsite: { type: String, default: '' },
    isProfileComplete: { type: Boolean, default: false },

    // --- NEW FIELDS FOR SOCIAL FEATURES ---
    followers: [{ // IDs of users who follow this user
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    following: [{ // IDs of users this user follows
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    // --- END NEW FIELDS ---

    notifications: {
        type: String,
        enum: ['all', 'important', 'none'],
        default: 'all'
    },
    theme: {
        type: String,
        enum: ['light', 'dark', 'system'],
        default: 'light'
    },
    privacy: {
        type: String,
        enum: ['public', 'private'],
        default: 'public'
    },
    twoFactorAuth: {
        type: Boolean,
        default: false
    },

    activityLog: [{
        action: { type: String, required: true },
        timestamp: { type: Date, default: Date.now }
    }],
    projectsCollaboratedOn: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }]
}, { timestamps: true });

userSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
