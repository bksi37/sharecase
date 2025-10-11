// config/tags.js
module.exports = {
    types: ['Engineering', 'Art', 'Other'],
    departments: ['Mechanical Engineering', 'Computer Science', 'Fine Arts', 'Physics', 'Other'],
    categories: ['Robotics', 'Software', 'Painting', 'Sculpture', 'Research'],
    years: ['2020', '2021', '2022', '2023', '2024', '2025'],
    courses: ['ENGR 101', 'ART 201', 'CS 301', 'PHYS 401'],
    tools: ['Python', 'SolidWorks', 'MATLAB', 'Oil Painting', 'Sustainability', 'AI'], // Renamed from toolsThemes for clarity
    projectSchemas: {
        Engineering: [
            { name: 'CADFile', type: 'file', label: 'CAD File', accept: '.stl,.obj,.step', required: true, note: 'Max 10MB. Supported formats: STL, OBJ, STEP.' },
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