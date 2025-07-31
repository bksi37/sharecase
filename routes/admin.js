const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Project = require('../models/Project');
const { isAuthenticated } = require('../middleware/auth'); // Assuming this is your base auth

// Middleware to check for Admin or ShareCase Worker role
// IMPORTANT: This middleware should ideally be defined in middleware/auth.js and imported.
// Duplicating here for clarity of this file's functionality in this generation.
const authorizeAdminOrShareCaseWorker = (req, res, next) => {
    if (!req.session.userRole || (req.session.userRole !== 'admin' && req.session.userRole !== 'sharecase_worker')) {
        return res.status(403).json({ message: 'Access denied. Insufficient privileges.' });
    }
    next();
};

// Middleware to check for Admin or Faculty role
// IMPORTANT: This middleware should ideally be defined in middleware/auth.js and imported.
const authorizeAdminOrFaculty = (req, res, next) => {
    if (!req.session.userRole || (req.session.userRole !== 'admin' && req.session.userRole !== 'faculty')) {
        return res.status(403).json({ message: 'Access denied. Insufficient privileges.' });
    }
    next();
};

// Admin Dashboard Data Route
router.get('/admin/dashboard-data', isAuthenticated, authorizeAdminOrShareCaseWorker, async (req, res) => {
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

// Route for user analytics
router.get('/admin/users-analytics', isAuthenticated, authorizeAdminOrShareCaseWorker, async (req, res) => {
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

// Future: Route to manually award points (protected for admin/faculty)
router.post('/admin/award-points', isAuthenticated, authorizeAdminOrFaculty, async (req, res) => {
    try {
        const { userId, projectId, points, reason } = req.body;
        // Logic to update user's total points and project's points
        // This would involve finding the user and project, updating their 'points' fields,
        // and potentially logging the transaction.

        // Placeholder for actual implementation:
        // const user = await User.findById(userId);
        // if (user) {
        //     user.totalPoints += points;
        //     await user.save();
        // }
        // if (projectId) {
        //     const project = await Project.findById(projectId);
        //     if (project) {
        //         project.points += points;
        //         await project.save();
        //     }
        // }

        res.json({ success: true, message: 'Points awarded (placeholder).' });
    } catch (error) {
        console.error('Error awarding points:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Route for project analytics
router.get('/admin/analytics/projects', isAuthenticated, authorizeAdminOrShareCaseWorker, async (req, res) => {
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

module.exports = router;