// routes/portfolio.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Project = require('../models/Project');
const { isAuthenticated } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const https = require('https');
const mongoose = require('mongoose'); // Import mongoose for ID validation

// Helper function to fetch image from URL and return a buffer
const fetchImageAsBuffer = (url) => {
    console.log('Fetching image:', url);
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (response.statusCode < 200 || response.statusCode >= 300) {
                console.error(`Failed to fetch image ${url}: Status ${response.statusCode}`);
                return reject(new Error(`HTTP Error: ${response.statusCode} for ${url}`));
            }
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', (err) => {
            console.error(`Error fetching image ${url}:`, err);
            reject(err);
        });
    });
};

// Helper function to generate PDF and stream to client
async function generatePortfolio(user, projects, settings, res) {
    const { format, primaryColor, accentColor, contentToggles } = settings;
    console.log('Starting PDF generation for user:', user.name, 'format:', format);
    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=sharecase_portfolio_${format}.pdf`);

    // Pipe PDF directly to response
    doc.pipe(res);

    try {
        console.log('Registering fonts');
        // NOTE: Ensure these font files exist in the specified path
        doc.registerFont('Roboto', 'public/fonts/Roboto-Regular.ttf');
        doc.registerFont('Roboto-Bold', 'public/fonts/Roboto-Bold.ttf');
    } catch (error) {
        console.error('Font registration error:', error);
        doc.font('Helvetica');
    }

    // --- Header Section ---
    console.log('Adding header');
    
    // Use selected primary color for main name
    doc.fillColor(primaryColor).font('Roboto-Bold').fontSize(28).text(user.name || 'Anonymous', { align: 'center' });
    doc.moveDown(0.2);
    
    // Use selected accent color for email/links
    doc.fillColor(accentColor).font('Roboto').fontSize(12).text(user.email || '', { align: 'center' });
    
    if (user.linkedin) {
        let linkedinUrl = user.linkedin;
        if (!linkedinUrl.startsWith('http://') && !linkedinUrl.startsWith('https://')) {
            linkedinUrl = `https://${linkedinUrl}`;
        }
        doc.moveDown(0.2);
        doc.fillColor(accentColor).font('Roboto').fontSize(12).text(`LinkedIn: ${linkedinUrl}`, { align: 'center', link: linkedinUrl });
    }
    
    doc.moveDown(1);
    doc.lineWidth(2).strokeColor(primaryColor).moveTo(40, doc.y).lineTo(552, doc.y).stroke();
    doc.moveDown(1);

    // --- Projects Section ---
    console.log('Adding projects section');
    doc.fillColor(primaryColor).font('Roboto-Bold').fontSize(22).text('My Projects', { align: 'left' });
    doc.moveDown(0.5);

    if (projects.length === 0) {
        doc.font('Roboto').fontSize(12).text('No selected projects available to display.', { align: 'center' });
    } else {
        for (const [index, p] of projects.entries()) {
            console.log(`Adding project ${index + 1}: ${p.title}`);
            if (index > 0) doc.addPage();
            
            doc.fillColor(primaryColor).font('Roboto-Bold').fontSize(18).text(p.title || 'Untitled Project', { align: 'left' });
            doc.moveDown(0.5);
            
            // Image/Media Handling
            const mediaUrl = (p.projectType === 'Art' && p.projectDetails?.artworkImage)
                ? p.projectDetails.artworkImage
                : p.image;
            
            if (mediaUrl && !mediaUrl.includes('default-project.jpg')) {
                try {
                    const imageBuffer = await fetchImageAsBuffer(mediaUrl); 
                    doc.image(imageBuffer, { width: 350, align: 'center', valign: 'center' });
                    doc.moveDown(0.5);
                } catch (error) {
                    doc.fontSize(10).fillColor('#e74c3c').text('Image not available or failed to download', { align: 'left' });
                    doc.moveDown(0.5);
                }
            }
            
            // General Details
            doc.fillColor(primaryColor).font('Roboto-Bold').fontSize(12).text('Project Type:', { align: 'left' });
            doc.font('Roboto').fontSize(10).text(p.projectType || 'Other', { align: 'left', indent: 10 });
            doc.moveDown(0.5);

            // Conditional Content: Problem Statement
            if (contentToggles.includeProblemStatement) {
                doc.fillColor(accentColor).font('Roboto-Bold').fontSize(12).text('Problem Statement:', { align: 'left' });
                doc.font('Roboto').fontSize(10).text(p.problemStatement || 'Not provided', { align: 'left', indent: 10 });
                doc.moveDown(0.5);
            }
            
            doc.font('Roboto-Bold').fontSize(12).text('Description:', { align: 'left' });
            doc.font('Roboto').fontSize(10).text(p.description || 'Not provided', { align: 'left', indent: 10 });
            doc.moveDown(0.5);
            
            // --- Specific Details Section (based on projectType) ---
            if (p.projectType === 'Engineering') {
                doc.font('Roboto-Bold').fontSize(14).text('Technical Details:', { align: 'left' });
                doc.moveDown(0.2);
                doc.font('Roboto-Bold').fontSize(10).text('Technical Description:', { align: 'left', indent: 10 });
                doc.font('Roboto').fontSize(10).text(p.projectDetails?.technicalDescription || 'N/A', { align: 'left', indent: 20 });
                doc.font('Roboto-Bold').fontSize(10).text('Tools/Software:', { align: 'left', indent: 10 });
                doc.font('Roboto').fontSize(10).text(p.projectDetails?.toolsSoftware?.join(', ') || 'N/A', { align: 'left', indent: 20 });
                doc.font('Roboto-Bold').fontSize(10).text('Functional Goals:', { align: 'left', indent: 10 });
                doc.font('Roboto').fontSize(10).text(p.projectDetails?.functionalGoals || 'N/A', { align: 'left', indent: 20 });
                doc.moveDown(0.5);
            } else if (p.projectType === 'Art') {
                 doc.font('Roboto-Bold').fontSize(14).text('Art Details:', { align: 'left' });
                 doc.moveDown(0.2);
                 doc.font('Roboto-Bold').fontSize(10).text('Medium/Technique:', { align: 'left', indent: 10 });
                 doc.font('Roboto').fontSize(10).text(p.projectDetails?.mediumTechnique || 'N/A', { align: 'left', indent: 20 });
                 doc.font('Roboto-Bold').fontSize(10).text('Artist Statement:', { align: 'left', indent: 10 });
                 doc.font('Roboto').fontSize(10).text(p.projectDetails?.artistStatement || 'N/A', { align: 'left', indent: 20 });
                 doc.font('Roboto-Bold').fontSize(10).text('Exhibition History:', { align: 'left', indent: 10 });
                 doc.font('Roboto').fontSize(10).text(p.projectDetails?.exhibitionHistory || 'N/A', { align: 'left', indent: 20 });
                 doc.moveDown(0.5);
            }
            
            // Conditional Content: Collaborators
            if (contentToggles.includeCollaborators) {
                const collaboratorNames = p.collaborators && p.collaborators.length > 0
                    ? p.collaborators.map(collab => collab.name).filter(Boolean).join(', ')
                    : 'None';
                doc.font('Roboto-Bold').fontSize(12).text('Collaborators:', { align: 'left' });
                doc.font('Roboto').fontSize(10).text(collaboratorNames, { align: 'left', indent: 10 });
                doc.moveDown(0.5);
            }

            // Conditional Content: Other Contributors
            if (contentToggles.includeOtherContributors) {
                const otherContributorNames = p.otherContributors || 'None';
                doc.font('Roboto-Bold').fontSize(12).text('Other Contributors:', { align: 'left' });
                doc.font('Roboto').fontSize(10).text(otherContributorNames, { align: 'left', indent: 10 });
                doc.moveDown(0.5);
            }
            
            // Conditional Content: Tags
            if (contentToggles.includeTags) {
                doc.font('Roboto-Bold').fontSize(12).text('Tags:', { align: 'left' });
                doc.font('Roboto').fontSize(10).text(p.tags && p.tags.length ? p.tags.join(', ') : 'None', { align: 'left', indent: 10 });
                doc.moveDown(1);
            }
        }
    }

    // --- Footer ---
    doc.fontSize(10).fillColor('#666666').text('Generated by ShareCase © 2025', 40, doc.page.height - 60, { align: 'center' });
    doc.end();
}

router.post('/generate', isAuthenticated, async (req, res) => {
    try {
        // Capture new parameter: selectedProjectIds
        const { format, primaryColor, accentColor, contentToggles, selectedProjectIds } = req.body; 
        const userId = req.session.userId;
        
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized. Please log in.' });
        }
        if (!format || !['classic'].includes(format)) { 
            return res.status(400).json({ success: false, error: 'Invalid or unsupported portfolio format.' });
        }
        
        // 🛑 FIX: Validate and filter the selectedProjectIds array
        let validProjectIds = [];
        if (Array.isArray(selectedProjectIds)) {
            // Filter out non-string/empty/invalid ObjectId formats to prevent CastError
            validProjectIds = selectedProjectIds.filter(id => 
                id && typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)
            );
        }
        
        if (validProjectIds.length === 0) {
             return res.status(400).json({ success: false, error: 'No valid published projects were selected for generation.' });
        }
        
        const user = await User.findById(userId).select('name email linkedin profilePic');
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        
        // 🛑 QUERY: Filter projects based on the validated IDs array
        const projects = await Project.find({ 
                userId: userId, 
                isPublished: true,
                _id: { $in: validProjectIds } // Use the filtered array
            })
            .populate('collaborators', 'name')
            .lean();

        // Pass all customization settings to the generator function
        await generatePortfolio(user, projects, { format, primaryColor, accentColor, contentToggles }, res);
        
    } catch (error) {
        console.error('Portfolio generation API error:', error);
        // The CastError should be handled by the filter above, but if another error occurs:
        res.status(500).json({ success: false, error: error.message || 'Internal server error.' });
    }
});

module.exports = router;