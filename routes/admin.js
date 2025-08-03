const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Project = require('../models/Project');
const { isAuthenticated, authorizeAdmin, authorizeFaculty } = require('../middleware/auth');

// Route for project analytics
router.get('/analytics/projects', isAuthenticated, authorizeAdmin, async (req, res) => {
    try {
        const totalProjects = await Project.countDocuments();
        const totalPublishedProjects = await Project.countDocuments({ isPublished: true });
        const projectsByType = await Project.aggregate([
            { $group: { _id: "$projectType", count: { $sum: 1 } } }
        ]);
        const projectsByTag = await Project.aggregate([
            { $unwind: "$tags" },
            { $group: { _id: "$tags", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 } // Top 10 tags
        ]);
        const topProjectsByViews = await Project.find({ isPublished: true })
            .sort({ views: -1 })
            .limit(5)
            .select('title views userId userName');
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

// Route for user analytics
router.get('/users-analytics', isAuthenticated, authorizeAdmin, async (req, res) => {
    try {
        const usersByRole = await User.aggregate([
            { $group: { _id: "$role", count: { $sum: 1 } } }
        ]);
        const usersByMajor = await User.aggregate([
            { $match: { major: { $ne: null, $exists: true, $ne: '' } } }, // Filter out empty majors
            { $group: { _id: "$major", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        const usersByDepartment = await User.aggregate([
            { $match: { department: { $ne: null, $exists: true, $ne: '' } } }, // Filter out empty departments
            { $group: { _id: "$department", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        res.json({
            usersByRole,
            usersByMajor,
            usersByDepartment
        });
    } catch (error) {
        console.error('Error fetching user analytics:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Route for core dashboard data (total users, comments, likes, etc.)
router.get('/dashboard-data', isAuthenticated, authorizeAdmin, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalProjects = await Project.countDocuments();
        const totalPublishedProjects = await Project.countDocuments({ isPublished: true });

        const totalCommentsResult = await Project.aggregate([
            { $unwind: '$comments' },
            { $count: 'total' }
        ]);
        const totalComments = totalCommentsResult.length > 0 ? totalCommentsResult[0].total : 0;

        const totalLikesResult = await Project.aggregate([
            { $group: { _id: null, total: { $sum: '$likes' } } }
        ]);
        const totalLikes = totalLikesResult.length > 0 ? totalLikesResult[0].total : 0;

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


// Route for allocating points
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

        res.json({ success: true, message: `Successfully allocated ${points} points to ${user.name}.` });
    } catch (error) {
        console.error('Error allocating points:', error);
        res.status(500).json({ success: false, error: 'Server error during point allocation.' });
    }
});

module.exports = router;