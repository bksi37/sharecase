// config/tags.js
module.exports = {
    // Project Types remain standard
    types: ['Engineering', 'Art', 'Other'], 
    
    // Departments significantly expanded to cover key university disciplines
    departments: [
        'Mechanical Engineering', 
        'Electrical Engineering', 
        'Computer Science', 
        'Civil Engineering',
        'Chemical Engineering',
        'Fine Arts', 
        'Industrial Design', 
        'Architecture',
        'Digital Media', // New
        'Game Development', // New
        'Biotechnology', // New
        'Urban Planning', // New
        'Other'
    ],
    
    // Categories focused on specific project areas/outputs, greatly expanded
    categories: [
        'Robotics', 
        'Web Development',
        'Mobile App Development', // New
        'VR/AR', // New
        'Digital Art', 
        'Physical Sculpture', 
        'Data Science', 
        'Prototyping', 
        'Conceptual Art', 
        'Research',
        'Sustainability', // Moved from Tools
        'AI/ML', // Moved from Tools
        'IoT/Embedded Systems', // New
        'Architectural Model', // New
        'Graphic Design', // New
        'Film/Video Production', // New
        'Scientific Visualization' // New
    ],
    
    // Years remain standard
    years: ['2020', '2021', '2022', '2023', '2024', '2025', '2026'], // Added 2026 for future proofing
    
    // Courses remain standard
    courses: ['ENGR 1411', 'ART 2253', 'CS 3053', 'PHYS 4013', 'DES 3633', 'ARCH 2243', 'BTE 4500', 'URP 3100'], // Added a couple of sample courses
    
    // Tools consolidated for software, materials, and methods (all unique)
    tools: [
        // CAD/3D/Design Software
        'SolidWorks', 'AutoCAD', 'Fusion 360', 'Blender', 'Rhino/Grasshopper', 'Adobe Creative Suite', 'Figma', // Expanded
        // Engines/Frameworks
        'Unity/Unreal Engine', 'React/Vue/Angular', 'Node.js/Express', 'TensorFlow/PyTorch', // Expanded
        // Programming/Data
        'Python', 'MATLAB', 'JavaScript', 'C++', 'Java', 'R', // Expanded
        // Art Mediums/Materials
        'Oil Painting', 'Watercolor', 'Ceramics', 'Digital Media', 'Woodworking', 'Metal Fabrication', 'Recycled Materials', // Expanded
        // Methods/Hardware
        '3D Printing (FDM/SLA)', 'Laser Cutting', 'CNC Machining', 'Microcontrollers (Arduino/Raspberry Pi)', 'Agile/Scrum' // Expanded
    ],
    
    // Project Schemas remain standard, with the addition of a 'Digital Media' example
    projectSchemas: {
        Engineering: [
            // CRITICAL: Updated accept attribute and note for GLB/GLTF consistency
            { name: 'CADFile', type: 'file', label: 'CAD File', accept: '.glb,.gltf', required: false, note: 'Only .GLB and .GLTF files are supported for web viewing (Max 10MB).' },
            { name: 'technicalDescription', type: 'textarea', label: 'Technical Description', placeholder: 'Describe the technical aspects of your project, including calculations or methodology.', required: true },
            { name: 'toolsSoftware', type: 'text', label: 'Tools/Software Used', placeholder: 'e.g., SolidWorks, MATLAB, Arduino', required: false },
            { name: 'functionalGoals', type: 'textarea', label: 'Functional Goals/Performance Metrics', placeholder: 'What were the functional objectives, and how were they measured?', required: false }
        ],
        Art: [
            { name: 'artworkImage', type: 'file', label: 'Artwork Image', accept: 'image/jpeg,image/png,image/gif', required: true, note: 'Max 2MB. Supported formats: JPEG, PNG, GIF.' },
            { name: 'mediumTechnique', type: 'text', label: 'Medium/Technique', placeholder: 'e.g., Oil on Canvas, Digital Illustration, Bronze Casting', required: true },
            { name: 'artistStatement', type: 'textarea', label: 'Artist Statement', placeholder: 'Describe the concept, inspiration, or cultural context of the work.', required: true },
            { name: 'exhibitionHistory', type: 'text', label: 'Exhibition History/Acquisitions', placeholder: 'e.g., Gallery X 2023, Private Collection, Online Showcase 2024', required: false }
        ],
        // New schema for projects that are primarily code/digital assets, but not pure 'Engineering'
        DigitalMedia: [ 
            { name: 'projectFiles', type: 'file', label: 'Demo or Source Files', accept: '.zip,.mp4,.glb', required: false, note: 'Attach a compressed file or GLB/MP4 demo (Max 10MB).' },
            { name: 'projectSummary', type: 'textarea', label: 'Project Summary', placeholder: 'Describe the function, purpose, and target audience.', required: true },
            { name: 'technologies', type: 'text', label: 'Frameworks/Languages Used', placeholder: 'e.g., React, Python, Adobe Premiere Pro', required: true },
            { name: 'userInteraction', type: 'text', label: 'User Interaction/Experience', placeholder: 'Describe the intended user flow and experience.', required: false }
        ],
        Default: []
    }
};