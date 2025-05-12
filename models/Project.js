const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    image: { type: String },
    tags: [{ type: String }],
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
    problemStatement: { type: String },
    collaborators: [{ type: String }],
    resources: [{ type: String }],
    likes: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    comments: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: { type: String },
        text: { type: String, required: true },
        timestamp: { type: Date, default: Date.now }
    }],
    isPublished: { type: Boolean, default: true },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] // Added for like/unlike
});

module.exports = mongoose.model('Project', ProjectSchema);