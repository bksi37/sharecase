// config/tags.js

const OU_ENGINEERING_COURSES = [
    // Computer Science
    'CS 1313 - Programming for Non-CS Majors',
    'CS 1323 - Introduction to Computer Programming',
    'CS 2334 - Programming Structures',
    'CS 2413 - Data Structures',
    'CS 2613 - Discrete Structures',
    'CS 2813 - Introduction to Computer Systems',
    'CS 3113 - Introduction to Operating Systems',
    'CS 3823 - Introduction to Algorithms',
    'CS 4013 - Programming Languages',
    'CS 4263 - Principles of Software Engineering',
    // Aerospace & Mechanical Engineering
    'AME 2113 - Statics',
    'AME 2213 - Dynamics',
    'AME 2613 - Applied Fluid Mechanics',
    'AME 3113 - Thermodynamics',
    'AME 3353 - Machine Elements',
    'AME 3723 - Numerical Methods in AME',
    'AME 4113 - Heat Transfer',
    // Chemical Engineering
    'CHE 2003 - Chemical Engineering Fundamentals',
    'CHE 2053 - Chemical Process Principles',
    'CHE 3103 - Chemical Engineering Thermodynamics',
    'CHE 3203 - Fluid Flow',
    // Civil Engineering
    'CE 2113 - Statics for Civil Engineers',
    'CE 3113 - Structural Analysis',
    'CE 3213 - Environmental Engineering',
    'CE 3313 - Geotechnical Engineering',
    // Electrical & Computer Engineering
    'ECE 2523 - Digital Logic Design',
    'ECE 2713 - Electric Circuits I',
    'ECE 3003 - Signals and Systems',
    'ECE 3723 - Electric Circuits II',
    // Other relevant courses (can be expanded)
    'MATH 2924 - Multivariable Calculus',
    'PHYS 2514 - General Physics for Engineers',
    'CHEM 1315 - General Chemistry',
];

const OU_CLUBS = [
    'IEEE (Institute of Electrical and Electronics Engineers)',
    'ACM (Association for Computing Machinery)',
    'ASME (American Society of Mechanical Engineers)',
    'AIChE (American Institute of Chemical Engineers)',
    'ASCE (American Society of Civil Engineers)',
    'Engineers Without Borders',
    'Sooner Rover Team',
    'OU Game Developers Association',
    'Cyber Security Club',
    'OU Data Science Club',
    'National Society of Black Engineers (NSBE)',
    'Society of Hispanic Professional Engineers (SHPE)',
    'Society of Women Engineers (SWE)',
    'Robotics Club',
    '3D Printing Club',
    'Makerspace Community',
];

const PROJECT_CATEGORIES = [
    'Class Project',
    'Research Project',
    'Personal Project',
    'Internship Project',
    'Hackathon Project',
    'Open Source Contribution',
    'Robotics',
    'CAD/Design',
    'Software Development',
    'Web Development',
    'Mobile Development',
    'Data Science',
    'Machine Learning',
    'Artificial Intelligence',
    'Embedded Systems',
    'Hardware Development',
    'Game Development',
    'Environmental Engineering',
    'Structural Engineering',
    'Chemical Processes',
    'Aerospace Systems',
    'Energy Systems',
    'Senior Design',
];

const PROJECT_YEARS = ['2023', '2024', '2025', '2026', '2027', '2028'];

const PROJECT_TYPES = ['Project', 'Assignment', 'Lab', 'Report', 'Presentation', 'Design'];

const ENGINEERING_DEPARTMENTS = ['Computer Science', 'Aerospace & Mechanical Engineering', 'Chemical Engineering', 'Civil Engineering', 'Electrical & Computer Engineering'];

module.exports = {
    OU_ENGINEERING_COURSES,
    OU_CLUBS,
    PROJECT_CATEGORIES,
    years: PROJECT_YEARS,
    types: PROJECT_TYPES,
    departments: ENGINEERING_DEPARTMENTS,
};