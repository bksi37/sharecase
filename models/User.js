const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, trim: true }, // Removed unique: true and sparse: true
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, default: '' },
    profilePic: { type: String, default: 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg' },
    bio: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    github: { type: String, default: '' },
    personalWebsite: { type: String, default: '' },
    isProfileComplete: { type: Boolean, default: false },
    // NEW: To store projects this user has collaborated on
    projectsCollaboratedOn: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);