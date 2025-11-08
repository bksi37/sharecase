const mongoose = require('mongoose');

// Define the schema for storing public/anonymous visitor data
const viewerDataSchema = new mongoose.Schema({
    // Store the ID if the user was logged in (Student/External/Faculty)
    submitterId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        default: null, 
        index: true 
    },
    // The type of viewer who submitted the data (Recruiter, Student, Alumni, Other, etc.)
    viewerType: { 
        type: String, 
        enum: ['Student', 'Recruiter', 'Faculty', 'Alumni', 'External', 'Other'], 
        required: true 
    },
    // Student-specific metric
    hasInternship: { 
        type: String, 
        enum: ['Yes', 'No', 'Prefer not to say', null], 
        default: null 
    },
    // The date and time of collection
    timestamp: { 
        type: Date, 
        default: Date.now 
    },
    // Optionally log the source page (though we are only using index.html right now)
    sourcePage: { 
        type: String, 
        default: 'index.html' 
    }
});

module.exports = mongoose.model('ViewerData', viewerDataSchema);