// routes/admin.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Project = require('../models/Project');
// 🛑 ASSUMPTION: 'authorizeFaculty' grants access to Career Center/Staff role.
const { isAuthenticated, authorizeAdmin, authorizeFaculty } = require('../middleware/auth'); 
const Notification = require('../models/Notification');
const ViewerData = require('../models/ViewerData'); // 🛑 New Model for the popups

// --- Custom Middleware for Shared Analytics Access ---
// Allows access if user is Admin OR Faculty (Career Center Staff)
const authorizeStaffAnalytics = (req, res, next) => {
    // We will use authorizeFaculty for the shared analytics routes, 
    // assuming it allows both Faculty and Admins to pass.
    authorizeFaculty(req, res, next);
};

// =====================================================================
// A. SHARECASE & CAREER CENTER ANALYTICS (Protected by authorizeFaculty)
//    - Data critical for ROI, student trends, and external reporting.
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
            { $sort: { count: -1 } }, 
            { $limit: 10 }
        ]);
        
        // Top projects by views (High-value metric for Career Center)
        const topProjectsByViews = await Project.find({ isPublished: true })
            .sort({ views: -1 })
            .limit(5)
            .select('title views _id'); // Ensure _id is selected
        
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
            { $match: { major: { $ne: null, $exists: true, $ne: '', $ne: 'N/A' } } }, 
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

router.get('/analytics/view-sources', isAuthenticated, authorizeStaffAnalytics, async (req, res) => {
    try {
        // 1. Get total views (The denominator for all traffic)
        const totalProjectViewsResult = await Project.aggregate([
            { $group: { _id: null, total: { $sum: '$views' } } }
        ]);
        const totalProjectViews = totalProjectViewsResult[0]?.total || 0;

        // 2. Get survey responses (External traffic that self-categorized)
        // These are distinct submissions, NOT raw views, but they provide a source breakdown.
        const surveyResponses = await ViewerData.aggregate([
            { $group: { _id: "$viewerType", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // 3. Get total logged-in users (Proxy for the "Internal Users" bucket)
        // This includes all roles (Student, Faculty, Admin)
        const allUsersByRole = await User.aggregate([
            { $group: { _id: "$role", count: { $sum: 1 } } }
        ]);
        
        // --- DATA CONSOLIDATION AND CLEANUP ---
        
        let chartDataMap = new Map();

        // Add survey data (Recruiter, Alumni, Other, Student)
        surveyResponses.forEach(item => {
            chartDataMap.set(item._id, item.count);
        });

        const recruiterViews = chartDataMap.get('Recruiter') || 0;
        const facultyViews = chartDataMap.get('Faculty') || 0;
        const alumniViews = chartDataMap.get('Alumni') || 0;
        
        
        // Calculate the "Internal Logged-In Users" bucket (This is the best proxy without a new view log)
        const totalAuthenticatedUsers = allUsersByRole.reduce((sum, item) => sum + item.count, 0);
        
        // For the Chart: Grouping the view sources cleanly
        let chartData = [
            { label: "Confirmed Recruiter Traffic", count: recruiterViews, color: '#10b981' },
            { label: "Confirmed Faculty/Alumni Traffic", count: facultyViews + alumniViews, color: '#00bfff' },
        ];
        
        // Calculate the total confirmed survey views
        const totalConfirmedSurvey = recruiterViews + facultyViews + alumniViews + (chartDataMap.get('Student') || 0) + (chartDataMap.get('Other') || 0);
        
        // Calculate the remaining traffic bucket (The bulk of the project views)
        const unknownTraffic = Math.max(0, totalProjectViews - totalConfirmedSurvey);
        
        chartData.push({
             label: "Logged-In Users (Student/Admin)", 
             count: totalAuthenticatedUsers, // Use total user count as a static reference for internal scale
             color: '#f59e0b' 
        });

        chartData.push({
             label: "Anonymous/Unknown Traffic", 
             count: unknownTraffic, 
             color: '#64748b' 
        });
        
        res.json({
            totalProjectViews,
            chartData: chartData.filter(d => d.count > 0) // Filter out zeros
        });

    } catch (error) {
        console.error('Error fetching view source analytics:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// NEW ROUTE: Detailed Project View Source Breakdown - SHARED
router.get('/analytics/project-views-breakdown/:projectId', isAuthenticated, authorizeStaffAnalytics, async (req, res) => {
    try {
        const { projectId } = req.params;

        // 1. Get total views for the project AND the list of logged-in viewers
        const project = await Project.findById(projectId).select('views title viewedBy'); // <-- Select 'viewedBy'
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        const totalProjectViews = project.views || 0;
        // NEW: Count of unique logged-in users who viewed the project
        const loggedInViewCount = (project.viewedBy || []).length; 

        // 2. Aggregate ViewerData submissions (External survey data)
        const breakdownData = await ViewerData.aggregate([
            // Match submissions for this project that have a viewerType
            { $match: { projectId: projectId, viewerType: { $ne: null } } },
            // Group by viewerType and count them
            { $group: { _id: "$viewerType", count: { $sum: 1 } } },
            // Sort by count descending
            { $sort: { count: -1 } }
        ]);

        // 3. Calculate "Anonymous/External" (Unlogged, Unsurveyed) traffic
        const knownSurveyViews = breakdownData.reduce((sum, item) => sum + item.count, 0);

        // 🛑 NEW CALCULATION: Subtract both Survey views AND Logged-In views (viewedBy array)
        // We assume 'viewedBy' tracks logged-in users, and 'ViewerData' tracks guests/external that filled the popup.
        const unknownViews = Math.max(0, totalProjectViews - knownSurveyViews - loggedInViewCount); 
        
        // 4. Structure the final response data
        const chartData = breakdownData.map(item => ({
            label: `Surveyed: ${item._id}`, // Recruiter, Alumni, Student, etc.
            count: item.count,
        }));
        
        // 🛑 NEW BUCKET: Views from registered users (including Admin/Faculty)
        if (loggedInViewCount > 0) {
            chartData.push({
                label: "Logged-In User Views", // This includes Admins, Students, Faculty, etc. from 'viewedBy'
                count: loggedInViewCount,
            });
        }
        
        // Add the calculated anonymous bucket (The true unknown remainder)
        chartData.push({
            label: "Anonymous/External Traffic", // The true remainder (bots, non-surveyed guests, uncounted traffic)
            count: unknownViews,
        });

        res.json({
            totalViews: totalProjectViews,
            projectTitle: project.title,
            breakdown: chartData.filter(d => d.count > 0)
        });

    } catch (error) {
        console.error(`Error fetching project view breakdown for ${req.params.projectId}:`, error);
        res.status(500).json({ error: 'Server error' });
    }
});

// =====================================================================
// B. SHARECASE INTERNAL STAFF ACTIONS/DATA (Protected by authorizeAdmin)
//    - Exclusive management actions and internal metrics.
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