const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: String,
    schoolEmail: String,
    profilePic: String,
    isProfileComplete: { type: Boolean, default: false },
    notifications: { type: String, default: 'all', enum: ['all', 'important', 'none'] },
    theme: { type: String, default: 'light', enum: ['light', 'dark', 'system'] },
    privacy: { type: String, default: 'public', enum: ['public', 'private'] },
    twoFactorAuth: { type: Boolean, default: false },
    activityLog: [{ action: String, timestamp: Date }],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);