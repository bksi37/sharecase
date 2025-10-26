// config/tags.js
module.exports = {
    // Project Types remain standard
    types: ['Engineering', 'Art', 'Other'], 
    
    // Departments slightly refined
    departments: ['Mechanical Engineering', 'Electrical Engineering', 'Computer Science', 'Fine Arts', 'Industrial Design', 'Architecture', 'Other'],
    
    // Categories focused on specific project areas/outputs
    categories: ['Robotics', 'Web Development', 'Digital Art', 'Physical Sculpture', 'Data Science', 'Prototyping', 'Conceptual Art', 'Research'],
    
    // Years remain standard
    years: ['2020', '2021', '2022', '2023', '2024', '2025'],
    
    // Courses remain standard
    courses: ['ENGR 1411', 'ART 2253', 'CS 3053', 'PHYS 4013', 'DES 3633', 'ARCH 2243'],
    
    // Tools consolidated for software, materials, and methods (all unique)
    tools: [
        'SolidWorks', 'AutoCAD', 'Fusion 360', 'Blender', 'Unity/Unreal', // CAD/3D
        'Python', 'MATLAB', 'JavaScript', 'C++', // Programming
        'Oil Painting', 'Watercolor', 'Ceramics', 'Digital Media', // Art Mediums
        'Sustainability', 'AI/ML', '3D Printing' // Methods
    ],
    
    // Project Schemas updated to reflect GLB/GLTF requirement
    projectSchemas: {
        Engineering: [
            // CRITICAL: Updated accept attribute and note for GLB/GLTF consistency
            { name: 'CADFile', type: 'file', label: 'CAD File', accept: '.glb,.gltf', required: false, note: 'Only .GLB and .GLTF files are supported for web viewing (Max 10MB).' },
            { name: 'technicalDescription', type: 'textarea', label: 'Technical Description', placeholder: 'Describe the technical aspects of your project...', required: true },
            { name: 'toolsSoftware', type: 'text', label: 'Tools/Software Used', placeholder: 'e.g., SolidWorks, MATLAB', required: true },
            { name: 'functionalGoals', type: 'textarea', label: 'Functional Goals', placeholder: 'What were the functional objectives?', required: false }
        ],
        Art: [
            { name: 'artworkImage', type: 'file', label: 'Artwork Image', accept: 'image/jpeg,image/png,image/gif', required: true, note: 'Max 2MB. Supported formats: JPEG, PNG, GIF.' },
            { name: 'mediumTechnique', type: 'text', label: 'Medium/Technique', placeholder: 'e.g., Oil on Canvas, Digital Illustration', required: true },
            { name: 'artistStatement', type: 'textarea', label: 'Artist Statement', placeholder: 'Describe the concept or inspiration...', required: true },
            { name: 'exhibitionHistory', type: 'text', label: 'Exhibition History', placeholder: 'e.g., Gallery X 2023, Online Showcase 2024', required: false }
        ],
        Default: []
    }
};