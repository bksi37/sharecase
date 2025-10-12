// models/Project.js
const mongoose = require('mongoose');
const projectSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    title: { type: String, required: true },
    projectType: { type: String, default: 'Other' },
    description: { type: String, required: true },
    problemStatement: { type: String },
    image: { type: String },
    CADFile: { type: String },
    technicalDescription: { type: String },
    toolsSoftware: { type: String },
    functionalGoals: { type: String },
    mediumTechnique: { type: String },
    artistStatement: { type: String },
    exhibitionHistory: { type: String },
    tags: [{ type: String }],
    collaboratorIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    otherContributors: { type: String },
    resources: [{ type: String }],
    isPublished: { type: Boolean, default: true },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Project', projectSchema);