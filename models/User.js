// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    profilePic: {
        type: String,
        default: 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg'
    },
    role: {
        type: String,
        enum: ['student', 'admin', 'external', 'alumni'],
        default: 'external'
    },
    totalPoints: {
        type: Number,
        default: 0
    },
    followers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    following: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    isProfileComplete: {
        type: Boolean,
        default: false
    },
    major: {
        type: String,
        default: ''
    },
    department: {
        type: String,
        default: ''
    },
    schoolEmail: {
        type: String,
        trim: true,
        lowercase: true,
        default: ''
    },
    graduationYear: {
        type: String,
        default: ''
    },
    socialLinks: {
        linkedin: { type: String, default: '' },
        github: { type: String, default: '' },
        website: { type: String, default: '' }
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: {
        type: String
    },
    isVerifiedStudent: {
        type: Boolean,
        default: false
    },
    isVerifiedAlumni: {
        type: Boolean,
        default: false
    },
    twoFactorAuth: {
        type: Boolean,
        default: false
    },
    notifications: {
        type: String,
        enum: ['all', 'mentions', 'none'],
        default: 'all'
    },
    theme: {
        type: String,
        enum: ['light', 'dark'],
        default: 'light'
    },
    privacy: {
        type: String,
        enum: ['public', 'private'],
        default: 'public'
    }
});

userSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

userSchema.methods.comparePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);