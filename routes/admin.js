const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Project = require('../models/Project');
const { isAuthenticated } = require('../middleware/auth'); // Assuming this is your base auth
// We'll need a new middleware like isAdminOrShareCaseWorker for these routes
// const { isAdminOrShareCaseWorker } = require('../middleware/auth'); // Future

// Example Admin Dashboard Data Route
router.get('/admin/dashboard-data', isAuthenticated, async (req, res) => {
    try {
        // --- IMPORTANT: Add proper role-based authorization here ---
        // if (req.session.userRole !== 'admin' && req.session.userRole !== 'sharecase_worker') {
        //     return res.status(403).json({ message: 'Access denied.' });
        // }

        const totalUsers = await User.countDocuments();
        const totalProjects = await Project.countDocuments();
        const totalPublishedProjects = await Project.countDocuments({ isPublished: true });
        const totalComments = await Project.aggregate([
            { $unwind: '$comments' },
            { $count: 'total' }
        ]);
        const totalLikes = await Project.aggregate([
            { $group: { _id: null, total: { $sum: '$likes' } } }
        ]);

        res.json({
            totalUsers,
            totalProjects,
            totalPublishedProjects,
            totalComments: totalComments.length > 0 ? totalComments[0].total : 0,
            totalLikes: totalLikes.length > 0 ? totalLikes[0].total : 0
        });

    } catch (error) {
        console.error('Error fetching admin dashboard data:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Example route for user analytics (more detailed than /admin/analytics/users in auth.js)
router.get('/admin/users-analytics', isAuthenticated, async (req, res) => {
    try {
        // --- IMPORTANT: Add proper role-based authorization here ---
        // if (req.session.userRole !== 'admin' && req.session.userRole !== 'sharecase_worker') {
        //     return res.status(403).json({ message: 'Access denied.' });
        // }

        const usersByRole = await User.aggregate([
            { $group: { _id: "$role", count: { $sum: 1 } } }
        ]);
        const usersByMajor = await User.aggregate([
            { $group: { _id: "$major", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        const usersByDepartment = await User.aggregate([
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
router.post('/admin/award-points', isAuthenticated, async (req, res) => {
    try {
        // --- IMPORTANT: Add proper role-based authorization here (admin or faculty) ---
        // if (req.session.userRole !== 'admin' && req.session.userRole !== 'faculty') {
        //     return res.status(403).json({ message: 'Access denied.' });
        // }
        
        const { userId, projectId, points, reason } = req.body;
        // Logic to update user's total points and project's points
        // This would involve finding the user and project, updating their 'points' fields,
        // and potentially logging the transaction.
        
        res.json({ success: true, message: 'Points awarded.' });
    } catch (error) {
        console.error('Error awarding points:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


module.exports = router;
