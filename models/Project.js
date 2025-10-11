// models/Project.js
const mongoose = require('mongoose');
const tagsConfig = require('../config/tags');

const projectSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userName: {
        type: String,
        required: true,
        trim: true
    },
    projectType: {
        type: String,
        enum: tagsConfig.types || ['Engineering', 'Art', 'Other'],
        required: true,
        default: 'Other'
    },
    description: {
        type: String,
        required: true,
        maxlength: 500
    },
    problemStatement: {
        type: String,
        maxlength: 1000,
        default: ''
    },
    year: {
        type: String,
        enum: tagsConfig.years.concat('') || ['2020', '2021', '2022', '2023', '2024', '2025', ''],
        default: ''
    },
    department: {
        type: String,
        enum: tagsConfig.departments.concat('') || ['Mechanical Engineering', 'Computer Science', 'Fine Arts', 'Physics', 'Other', ''],
        default: ''
    },
    category: {
        type: String,
        enum: tagsConfig.categories.concat('') || ['Robotics', 'Software', 'Painting', 'Sculpture', 'Research', ''],
        default: ''
    },
    tags: [{
        type: String,
        trim: true,
        // Allow custom tags by not strictly enforcing enum; fallback if tagsConfig.tools is missing
        enum: tagsConfig.tools ? tagsConfig.tools.concat('') : ['Python', 'SolidWorks', 'MATLAB', 'Oil Painting', 'Sustainability', 'AI', '']
    }],
    collaboratorIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    otherContributors: {
        type: String,
        maxlength: 500,
        default: ''
    },
    resources: [{
        type: String,
        trim: true,
        match: [/^https?:\/\/[^\s$.?#].[^\s]*$/, 'Please enter a valid URL']
    }],
    image: {
        type: String,
        required: true
    },
    projectDetails: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    },
    views: {
        type: Number,
        default: 0
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    comments: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        userName: { type: String, required: true },
        comment: { type: String, required: true, maxlength: 500 },
        createdAt: { type: Date, default: Date.now }
    }],
    isPublished: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Pre-save hook to update timestamp
projectSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Project', projectSchema);