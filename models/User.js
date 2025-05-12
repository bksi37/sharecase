const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    profilePic: { type: String },
    linkedin: { type: String },
    profileComplete: { type: Boolean, default: false }
});

module.exports = mongoose.model('User', userSchema);