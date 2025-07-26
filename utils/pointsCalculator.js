// utils/pointsCalculator.js

// Define point values (these could eventually be configurable in a database or config file)
const POINTS_PER_UPLOAD = 50;
const POINTS_PER_VIEW = 1; // Awarded per unique view (needs tracking to prevent abuse)
const POINTS_PER_LIKE = 5;
const POINTS_PER_COMMENT = 10;
const POINTS_FOR_FEATURED_PROJECT = 100; // Example for future manual awards

// Function to calculate points for a new project upload
function calculateUploadPoints() {
    return POINTS_PER_UPLOAD;
}

// Function to calculate points for a project view
function calculateViewPoints() {
    return POINTS_PER_VIEW;
}

// Function to calculate points for a project like
function calculateLikePoints() {
    return POINTS_PER_LIKE;
}

// Function to calculate points for a project comment
function calculateCommentPoints() {
    return POINTS_PER_COMMENT;
}

// Future function for faculty/admin awarded points (example)
function calculateBonusPoints(type) {
    switch (type) {
        case 'featured':
            return POINTS_FOR_FEATURED_PROJECT;
        // Add more cases for different bonus types
        default:
            return 0;
    }
}

module.exports = {
    calculateUploadPoints,
    calculateViewPoints,
    calculateLikePoints,
    calculateCommentPoints,
    calculateBonusPoints // For future use
};
