// routes/admin.js (Updated with New Analytics and Impact Metrics)
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Project = require('../models/Project');
const { isAuthenticated, authorizeAdmin, authorizeFaculty } = require('../middleware/auth');

// Route for project analytics (Used for charts/lists)
router.get('/analytics/projects', isAuthenticated, authorizeAdmin, async (req, res) => {
    try {
        const totalProjects = await Project.countDocuments();
        const totalPublishedProjects = await Project.countDocuments({ isPublished: true });
        
        // Count projects by type (Bar Chart/List)
        const projectsByType = await Project.aggregate([
            { $match: { isPublished: true } },
            { $group: { _id: "$projectType", count: { $sum: 1 } } }
        ]);
        
        // Top 10 tags (Word Cloud/List)
        const projectsByTag = await Project.aggregate([
            { $match: { isPublished: true } },
            { $unwind: "$tags" },
            { $group: { _id: "$tags", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 } 
        ]);
        
        // Top projects by views (List)
        const topProjectsByViews = await Project.find({ isPublished: true })
            .sort({ views: -1 })
            .limit(5)
            .select('title views userId userName');
        
        // Top projects by points (List)
        const topProjectsByPoints = await Project.find({ isPublished: true })
            .sort({ points: -1 })
            .limit(5)
            .select('title points userId userName');

        res.json({
            totalProjects,
            totalPublishedProjects,
            projectsByType,
            projectsByTag,
            topProjectsByViews,
            topProjectsByPoints
        });
    } catch (error) {
        console.error('Error fetching project analytics:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Route for user analytics (Used for charts/lists)
router.get('/users-analytics', isAuthenticated, authorizeAdmin, async (req, res) => {
    try {
        // Users by Role (Pie Chart)
        const usersByRole = await User.aggregate([
            { $group: { _id: "$role", count: { $sum: 1 } } }
        ]);
        
        // Users by Major (Future Bar Chart)
        const usersByMajor = await User.aggregate([
            { $match: { major: { $ne: null, $exists: true, $ne: '' } } }, 
            { $group: { _id: "$major", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        res.json({
            usersByRole,
            usersByMajor
        });
    } catch (error) {
        console.error('Error fetching user analytics:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Route for core dashboard data (Used for Summary Cards/ROI)
router.get('/dashboard-data', isAuthenticated, authorizeAdmin, async (req, res) => {
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

        // NOTE: The 'Meaningful Impact' Trendline metric (ROI) requires advanced data storage 
        // (e.g., storing view/like dates). For now, we return core metrics that imply engagement ROI.

        res.json({
            totalUsers,
            totalProjects,
            totalPublishedProjects,
            totalComments,
            totalLikes
        });
    } catch (error) {
        console.error('Error fetching admin dashboard data:', error);
        res.status(500).json({ error: 'Server error' });
    }
});


// Route for allocating points (Remains the same)
router.post('/allocate-points', isAuthenticated, authorizeAdmin, async (req, res) => {
    try {
        const { userId, points } = req.body;
        if (!userId || !points) {
            return res.status(400).json({ success: false, error: 'User ID and points are required.' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }

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

module.exports = router;