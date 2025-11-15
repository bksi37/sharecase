// routes/portfolio.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Project = require('../models/Project');
const { isAuthenticated } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const https = require('https');
const mongoose = require('mongoose'); 

// Helper function to fetch image from URL and return a buffer (remains the same)
const fetchImageAsBuffer = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (response.statusCode < 200 || response.statusCode >= 300) {
                return reject(new Error(`HTTP Error: ${response.statusCode} for ${url}`));
            }
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', (err) => {
            reject(err);
        });
    });
};

// Helper function to generate PDF and stream to client
async function generatePortfolio(user, projects, settings, res) {
    const { format, primaryColor, accentColor, contentToggles, layoutOptions } = settings;
    
    // Layout Settings (Used for Polished Feel)
    const projectsPerPageIndex = parseInt(layoutOptions?.projectsPerPage) || 1;
    const imageWidth = layoutOptions?.imageLayout === 'Full-Width/450px' ? 450 : 300; 
    const baseFontSize = layoutOptions?.contentFontSize === 'Small/9pt' ? 9 : 10;
    const headerFontSize = baseFontSize + 2; 

    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=sharecase_portfolio_${format}.pdf`);
    doc.pipe(res);

    try {
        doc.registerFont('Roboto', 'public/fonts/Roboto-Regular.ttf');
        doc.registerFont('Roboto-Bold', 'public/fonts/Roboto-Bold.ttf');
    } catch (error) {
        doc.font('Helvetica');
    }

    // --- Header Section ---
    doc.fillColor(primaryColor).font('Roboto-Bold').fontSize(28).text(user.name || 'Anonymous', { align: 'center' });
    doc.moveDown(0.2);
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
    doc.fillColor(primaryColor).font('Roboto-Bold').fontSize(22).text('My Projects', { align: 'left' });
    doc.moveDown(0.5);

    if (projects.length === 0) {
        doc.font('Roboto').fontSize(baseFontSize).text('No selected projects available to display.', { align: 'center' });
    } else {
        for (const [index, p] of projects.entries()) {
            
            // 🛑 Layout Control: Project Pacing 🛑
            const isNewProject = index > 0;
            const isNewPageRequired = (projectsPerPageIndex === 1 && isNewProject) || (projectsPerPageIndex === 2 && isNewProject && (index % 2 === 0));

            if (isNewPageRequired) doc.addPage();
            
            doc.fillColor(primaryColor).font('Roboto-Bold').fontSize(headerFontSize + 8).text(p.title || 'Untitled Project', { align: 'left' });
            doc.moveDown(0.5);
            
            // Image/Media Handling
            const mediaUrl = (p.projectType === 'Art' && p.projectDetails?.artworkImage)
                ? p.projectDetails.artworkImage
                : p.image;
            
            if (mediaUrl && !mediaUrl.includes('default-project.jpg')) {
                try {
                    const imageBuffer = await fetchImageAsBuffer(mediaUrl); 
                    // 🛑 Layout Control: Dynamic Image Width 🛑
                    doc.image(imageBuffer, { width: imageWidth, align: 'center', valign: 'center' });
                    doc.moveDown(0.5);
                } catch (error) {
                    doc.fontSize(baseFontSize).fillColor('#e74c3c').text('Image not available or failed to download', { align: 'left' });
                    doc.moveDown(0.5);
                }
            }
            
            // General Details
            doc.fillColor(primaryColor).font('Roboto-Bold').fontSize(headerFontSize).text('Project Type:', { align: 'left' });
            doc.font('Roboto').fontSize(baseFontSize).text(p.projectType || 'Other', { align: 'left', indent: 10 });
            doc.moveDown(0.5);

            // Conditional Content: Problem Statement
            if (contentToggles.includeProblemStatement) {
                doc.fillColor(accentColor).font('Roboto-Bold').fontSize(headerFontSize).text('Problem Statement:', { align: 'left' });
                doc.font('Roboto').fontSize(baseFontSize).text(p.problemStatement || 'Not provided', { align: 'left', indent: 10 });
                doc.moveDown(0.5);
            }
            
            doc.font('Roboto-Bold').fontSize(headerFontSize).text('Description:', { align: 'left' });
            doc.font('Roboto').fontSize(baseFontSize).text(p.description || 'Not provided', { align: 'left', indent: 10 });
            doc.moveDown(0.5);
            
            // --- Specific Details Section (Engineering Technical Details) ---
            if (p.projectType === 'Engineering') {
                
                // Only show heading if at least one technical section is toggled ON
                if (contentToggles.includeTechnicalDetails || contentToggles.includeTools || contentToggles.includeFunctionalGoals) {
                    doc.fillColor(primaryColor).font('Roboto-Bold').fontSize(headerFontSize + 2).text('Technical Details:', { align: 'left' });
                    doc.moveDown(0.2);
                }

                // 🛑 NEW TOGGLE: Technical Description
                if (contentToggles.includeTechnicalDetails) {
                    doc.font('Roboto-Bold').fontSize(baseFontSize).text('Technical Description:', { align: 'left', indent: 10 });
                    doc.font('Roboto').fontSize(baseFontSize).text(p.projectDetails?.technicalDescription || 'N/A', { align: 'left', indent: 20 });
                    doc.moveDown(0.2);
                }
                
                // 🛑 NEW TOGGLE: Tools/Software
                if (contentToggles.includeTools) {
                    doc.font('Roboto-Bold').fontSize(baseFontSize).text('Tools/Software:', { align: 'left', indent: 10 });
                    doc.font('Roboto').fontSize(baseFontSize).text(p.projectDetails?.toolsSoftware?.join(', ') || 'N/A', { align: 'left', indent: 20 });
                    doc.moveDown(0.2);
                }
                
                // 🛑 NEW TOGGLE: Functional Goals
                if (contentToggles.includeFunctionalGoals) {
                    doc.font('Roboto-Bold').fontSize(baseFontSize).text('Functional Goals:', { align: 'left', indent: 10 });
                    doc.font('Roboto').fontSize(baseFontSize).text(p.projectDetails?.functionalGoals || 'N/A', { align: 'left', indent: 20 });
                    doc.moveDown(0.2);
                }
                
                doc.moveDown(0.3);
                
            } else if (p.projectType === 'Art') {
                // Art Details (remains the same, using dynamic font size)
                doc.font('Roboto-Bold').fontSize(headerFontSize + 2).text('Art Details:', { align: 'left' });
                doc.moveDown(0.2);
                doc.font('Roboto-Bold').fontSize(baseFontSize).text('Medium/Technique:', { align: 'left', indent: 10 });
                doc.font('Roboto').fontSize(baseFontSize).text(p.projectDetails?.mediumTechnique || 'N/A', { align: 'left', indent: 20 });
                doc.font('Roboto-Bold').fontSize(baseFontSize).text('Artist Statement:', { align: 'left', indent: 10 });
                doc.font('Roboto').fontSize(baseFontSize).text(p.projectDetails?.artistStatement || 'N/A', { align: 'left', indent: 20 });
                doc.font('Roboto-Bold').fontSize(baseFontSize).text('Exhibition History:', { align: 'left', indent: 10 });
                doc.font('Roboto').fontSize(baseFontSize).text(p.projectDetails?.exhibitionHistory || 'N/A', { align: 'left', indent: 20 });
                doc.moveDown(0.5);
            }
            
            // Conditional Content: Collaborators
            if (contentToggles.includeCollaborators) {
                const collaboratorNames = p.collaborators && p.collaborators.length > 0
                    ? p.collaborators.map(collab => collab.name).filter(Boolean).join(', ')
                    : 'None';
                doc.font('Roboto-Bold').fontSize(headerFontSize).text('Collaborators:', { align: 'left' });
                doc.font('Roboto').fontSize(baseFontSize).text(collaboratorNames, { align: 'left', indent: 10 });
                doc.moveDown(0.5);
            }

            // Conditional Content: Other Contributors
            if (contentToggles.includeOtherContributors) {
                const otherContributorNames = p.otherContributors || 'None';
                doc.font('Roboto-Bold').fontSize(headerFontSize).text('Other Contributors:', { align: 'left' });
                doc.font('Roboto').fontSize(baseFontSize).text(otherContributorNames, { align: 'left', indent: 10 });
                doc.moveDown(0.5);
            }
            
            // Conditional Content: Tags
            if (contentToggles.includeTags) {
                doc.font('Roboto-Bold').fontSize(headerFontSize).text('Tags:', { align: 'left' });
                doc.font('Roboto').fontSize(baseFontSize).text(p.tags && p.tags.length ? p.tags.join(', ') : 'None', { align: 'left', indent: 10 });
                doc.moveDown(1);
            }
        }
    }

    // --- Footer ---
    doc.fontSize(baseFontSize - 1).fillColor('#666666').text('Generated by ShareCase © 2025', 40, doc.page.height - 60, { align: 'center' });
    doc.end();
}

router.post('/generate', isAuthenticated, async (req, res) => {
    try {
        // 🛑 NEW: Capture layoutOptions from the request body
        const { format, primaryColor, accentColor, contentToggles, layoutOptions, selectedProjectIds } = req.body; 
        const userId = req.session.userId;
        
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized. Please log in.' });
        }
        if (!format || !['classic'].includes(format)) { 
            return res.status(400).json({ success: false, error: 'Invalid or unsupported portfolio format.' });
        }
        
        let validProjectIds = [];
        if (Array.isArray(selectedProjectIds)) {
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
        
        const projects = await Project.find({ 
                userId: userId, 
                isPublished: true,
                _id: { $in: validProjectIds } 
            })
            .populate('collaborators', 'name')
            .lean();

        // Pass ALL settings to the generator function
        await generatePortfolio(user, projects, { format, primaryColor, accentColor, contentToggles, layoutOptions }, res);
        
    } catch (error) {
        console.error('Portfolio generation API error:', error);
        res.status(500).json({ success: false, error: error.message || 'Internal server error.' });
    }
});

module.exports = router;