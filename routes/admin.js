// routes/admin.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Project = require('../models/Project');
// 🛑 ASSUMPTION: 'authorizeFaculty' grants access to Career Center/Staff role.
// We will use a function 'authorizeStaffAnalytics' that allows access to both Admin and Faculty roles.
const { isAuthenticated, authorizeAdmin, authorizeFaculty } = require('../middleware/auth'); 
const Notification = require('../models/Notification');
const ViewerData = require('../models/ViewerData'); // 🛑 New Model for the popups

// --- Custom Middleware for Shared Analytics Access ---
// Allows access if user is Admin OR Faculty (Career Center Staff)
const authorizeStaffAnalytics = (req, res, next) => {
    // If the user is authenticated and has either 'admin' or 'faculty' role, proceed.
    // Assuming req.session.userRole or similar holds the role check.
    // NOTE: This logic should ideally be consolidated in a separate utility function in auth.js.
    // For now, we rely on the existing middlewares in series, or assume 'authorizeFaculty' allows Admins too.
    // Since we cannot see auth.js, we will protect the routes with the LEAST restrictive required.
    
    // We will use authorizeFaculty for the shared analytics routes, 
    // assuming it allows both Faculty and Admins to pass.
    authorizeFaculty(req, res, next);
};

// =====================================================================
// A. SHARECASE & CAREER CENTER ANALYTICS (Protected by authorizeFaculty)
//    - Data critical for ROI, student trends, and external reporting.
// =====================================================================

// Route for project analytics (Charts/Lists) - SHARED
router.get('/analytics/projects', isAuthenticated, authorizeStaffAnalytics, async (req, res) => {
    try {
        const totalProjects = await Project.countDocuments();
        const totalPublishedProjects = await Project.countDocuments({ isPublished: true });
        
        // Count projects by type (Bar Chart/List)
        const projectsByType = await Project.aggregate([
            { $match: { isPublished: true } },
            { $group: { _id: "$projectType", count: { $sum: 1 } } }
        ]);
        
        const projectsByTag = await Project.aggregate([
            { $match: { isPublished: true } },
            { $unwind: "$tags" },
            { $group: { _id: "$tags", count: { $sum: 1 } } },
            // 🛑 FIX: Use standard sorting by count (-1 for descending)
            { $sort: { count: -1 } }, 
            { $limit: 10 } 
        ]);
        
        // Top projects by views (High-value metric for Career Center)
        const topProjectsByViews = await Project.find({ isPublished: true })
            .sort({ views: -1 })
            .limit(5)
            .select('title views userId userName');
        
        // --- NOTE: Top projects by points is removed from shared analytics (See section B) ---

        res.json({
            totalProjects,
            totalPublishedProjects,
            projectsByType,
            projectsByTag,
            topProjectsByViews,
            // topProjectsByPoints is now restricted
        });
    } catch (error) {
        console.error('Error fetching project analytics:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Route for user analytics (Charts/Lists) - SHARED
router.get('/users-analytics', isAuthenticated, authorizeStaffAnalytics, async (req, res) => {
    try {
        // Users by Role (Pie Chart)
        const usersByRole = await User.aggregate([
            { $group: { _id: "$role", count: { $sum: 1 } } }
        ]);
        
        // Users by Major (Bar Chart - High Career Center Value)
        const usersByMajor = await User.aggregate([
            { $match: { major: { $ne: null, $exists: true, $ne: '' } } }, 
            { $group: { _id: "$major", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // NEW: Get Viewer Data Analytics (Data from the index.html popups)
        const viewerDataByRole = await ViewerData.aggregate([
             { $group: { _id: "$viewerType", count: { $sum: 1 } } }
        ]);

        // NEW: Get Student Internship Status (High Career Center Value)
        const studentInternshipStatus = await ViewerData.aggregate([
             { $match: { viewerType: "Student", hasInternship: { $ne: null } } },
             { $group: { _id: "$hasInternship", count: { $sum: 1 } } }
        ]);


        res.json({
            usersByRole,
            usersByMajor,
            viewerDataByRole,
            studentInternshipStatus
        });
    } catch (error) {
        console.error('Error fetching user analytics:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Route for core dashboard data (Summary Cards/ROI) - SHARED
router.get('/dashboard-data', isAuthenticated, authorizeStaffAnalytics, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalProjects = await Project.countDocuments();
        const totalPublishedProjects = await Project.countDocuments({ isPublished: true });

        // Calculate Total Comments
        const totalCommentsResult = await Project.aggregate([
            { $unwind: '$comments' },
            { $count: 'total' }
        ]);
        const totalComments = totalCommentsResult.length > 0 ? totalCommentsResult[0].total : 0;

        // Calculate Total Likes
        const totalLikesResult = await Project.aggregate([
            { $group: { _id: null, total: { $sum: '$likes' } } }
        ]);
        const totalLikes = totalLikesResult.length > 0 ? totalLikesResult[0].total : 0;

        // NEW: Total External/Recruiter Engagement (Crucial for Career Services ROI)
        const totalExternalViewersResult = await ViewerData.countDocuments({ viewerType: { $in: ['Recruiter', 'Alumni', 'Faculty'] } });

        res.json({
            totalUsers,
            totalProjects,
            totalPublishedProjects,
            totalComments,
            totalLikes,
            totalExternalViewers: totalExternalViewersResult
        });
    } catch (error) {
        console.error('Error fetching admin dashboard data:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 🛑 NEW ROUTE: Platform View Source Breakdown 🛑
// Returns a doughnut chart distribution of site views by user/viewer group.
router.get('/analytics/view-sources', isAuthenticated, authorizeStaffAnalytics, async (req, res) => {
    try {
        // 1. Calculate External (Survey) Views
        // These are confirmed non-student/recruiter/faculty entries from the popup
        const surveyResponses = await ViewerData.aggregate([
            { $group: { 
                _id: "$viewerType", 
                count: { $sum: 1 } 
            }},
            { $sort: { count: -1 } }
        ]);

        // 2. Calculate Logged-In User Views (Logged-in students, faculty, etc., who DIDN'T take the pop-up poll)
        // We need to know how many views come from authenticated users vs. anonymous external traffic.
        // Since the ViewerData model captures all survey takers (including students), we need the count of logged-in users who were NOT counted in the survey.
        
        // This is complex, so for an initial, high-value ROI metric, we will focus on
        // breaking down the total unique AUTHENTICATED users vs. ANONYMOUS survey takers.
        
        // Count total unique submitters who are not anonymous
        const uniqueSurveySubmitters = await ViewerData.aggregate([
            { $match: { submitterId: { $ne: null } } },
            { $group: { _id: "$submitterId" } },
            { $count: "count" }
        ]);
        const loggedInSurveyTakers = uniqueSurveySubmitters[0]?.count || 0;


        // Get all views from the Projects collection to calculate the "Unknown" bucket.
        // This is a proxy for all site engagement.
        const totalProjectViewsResult = await Project.aggregate([
            { $group: { _id: null, total: { $sum: '$views' } } }
        ]);
        const totalProjectViews = totalProjectViewsResult[0]?.total || 0;
        
        // Total count of all survey responses (anonymous + logged-in)
        const totalSurveyResponses = surveyResponses.reduce((sum, item) => sum + item.count, 0);

        // Calculate the large "Unknown" or "General Traffic" bucket
        // This bucket accounts for: bots, non-survey-takers, and users who skipped the pop-up.
        const totalKnownViews = totalSurveyResponses; // Use total survey responses as known minimum.
        const unknownTraffic = Math.max(0, totalProjectViews - totalKnownViews); 

        // Consolidate data for the chart
        let chartData = surveyResponses.map(item => ({
            label: item._id,
            count: item.count
        }));
        
        chartData.push({
            label: "Anonymous/Unknown Traffic",
            count: unknownTraffic
        });

        res.json({
            totalProjectViews,
            chartData,
            loggedInSurveyTakers
        });

    } catch (error) {
        console.error('Error fetching view source analytics:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// =====================================================================
// B. SHARECASE INTERNAL STAFF ACTIONS/DATA (Protected by authorizeAdmin)
//    - Exclusive management actions and internal metrics.
// =====================================================================

// Route for project analytics (Internal Metrics Only) - ADMIN ONLY
router.get('/analytics/internal-metrics', isAuthenticated, authorizeAdmin, async (req, res) => {
    try {
        // Top projects by points (Internal Gamification/Evaluation Metric)
        const topProjectsByPoints = await Project.find({ isPublished: true })
            .sort({ points: -1 })
            .limit(5)
            .select('title points userId userName');
        
        // We can add other internal metrics here if needed.

        res.json({
            topProjectsByPoints
        });
    } catch (error) {
        console.error('Error fetching internal analytics:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Route for allocating points - ADMIN ONLY
router.post('/allocate-points', isAuthenticated, authorizeAdmin, async (req, res) => {
    try {
        // ... (Point allocation logic remains the same) ...
        const { userId, points } = req.body;
        // ... (validation and update logic) ...
        const user = await User.findById(userId);
        if (!user) {
             return res.status(404).json({ success: false, error: 'User not found.' });
        }
        // ... (rest of the logic) ...
         user.totalPoints += points;
         await user.save();
         await User.findByIdAndUpdate(userId, {
             $push: { activityLog: { action: `Admin allocated ${points} points.`, timestamp: new Date() } }
         });
         res.json({ success: true, message: `Successfully allocated ${points} points to ${user.name}.` });
    } catch (error) {
        console.error('Error allocating points:', error);
        res.status(500).json({ success: false, error: 'Server error during point allocation.' });
    }
});

// Route for manually sending notifications - ADMIN ONLY
router.post('/send-notification', isAuthenticated, authorizeAdmin, async (req, res) => {
    try {
        // ... (Notification sending logic remains the same) ...
        const { userId, message } = req.body;
        // ... (validation and send logic) ...
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'Target user not found.' });
        }
        const newNotification = new Notification({
             userId: userId,
             message: message,
             type: 'mention',
             read: false,
         });
         await newNotification.save();
         res.json({ success: true, message: `Notification sent successfully to ${user.name}.` });
    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({ success: false, error: 'Server error during notification send.' });
    }
});


// =====================================================================
// C. PUBLIC UNPROTECTED ROUTE (From index.html popups)
// =====================================================================

// Route for logging public/anonymous visitor data - PUBLIC
router.post('/log-public-data', async (req, res) => {
    try {
        const { userId, viewerType, hasInternship } = req.body;
        
        await ViewerData.create({ 
            submitterId: userId || null, 
            viewerType: viewerType, 
            hasInternship: hasInternship,
            timestamp: new Date(),
        });

        res.json({ success: true, message: 'Viewer data logged successfully.' });

    } catch (error) {
        console.error('Error logging public data:', error);
        res.status(200).json({ success: false, error: 'Data acceptance failed, but site continues.' });
    }
});


module.exports = router;