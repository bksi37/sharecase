// Define point values
const POINTS_PER_UPLOAD = 25; // Reduced from 50
const POINTS_PER_LIKE = 2; // Reduced from 5
const POINTS_PER_COMMENT = 5; // Reduced from 10
const POINTS_PER_COMMENTER = 2; // New: points for commenting
const POINTS_PER_10_VIEWS = 0.5; // 0.5 points per 10 unique views for project owner
const POINTS_PER_20_PROJECTS_VIEWED = 2; // 2 points per 20 unique projects viewed
const POINTS_FOR_FEATURED_PROJECT = 50; // Reduced from 100
const MAX_VIEW_POINTS_PER_PROJECT = 50; // Max points from views per project
const MAX_VIEWER_POINTS = 100; // Max points a user can earn from viewing

// Function to calculate points for a new project upload
function calculateUploadPoints() {
    return POINTS_PER_UPLOAD;
}

// Function to calculate points for project views (owner)
function calculateViewPoints(uniqueViewCount) {
    if (uniqueViewCount <= 0) return 0;
    const viewBatches = Math.floor(uniqueViewCount / 10);
    const totalPoints = viewBatches * POINTS_PER_10_VIEWS;
    return Math.min(totalPoints, MAX_VIEW_POINTS_PER_PROJECT);
}

// Function to calculate points for a user viewing projects
function calculateViewerPoints(uniqueProjectsViewed) {
    if (uniqueProjectsViewed <= 0) return 0;
    const viewBatches = Math.floor(uniqueProjectsViewed / 20);
    const totalPoints = viewBatches * POINTS_PER_20_PROJECTS_VIEWED;
    return Math.min(totalPoints, MAX_VIEWER_POINTS);
}

// Function to calculate points for a project like
function calculateLikePoints() {
    return POINTS_PER_LIKE;
}

// Function to calculate points for a project comment (owner)
function calculateCommentPoints() {
    return POINTS_PER_COMMENT;
}

// Function to calculate points for commenting (commenter)
function calculateCommenterPoints() {
    return POINTS_PER_COMMENTER;
}

// Function for admin-awarded bonus points
function calculateBonusPoints(type) {
    switch (type) {
        case 'featured':
            return POINTS_FOR_FEATURED_PROJECT;
        default:
            return 0;
    }
}

module.exports = {
    calculateUploadPoints,
    calculateViewPoints,
    calculateLikePoints,
    calculateCommentPoints,
    calculateCommenterPoints,
    calculateViewerPoints,
    calculateBonusPoints
};