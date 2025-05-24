// config/tags.js

const OU_ENGINEERING_COURSES = [
    // Computer Science
    'CS 1313 - Programming for Non-CS Majors (Python)', // Updated description
    'CS 1323 - Introduction to Computer Programming (Java)', // Updated description
    'CS 2334 - Programming Structures and Abstractions (Java)', // More precise title
    'CS 2413 - Data Structures (Java)',
    'CS 2613 - Discrete Structures',
    'CS 2813 - Introduction to Computer Systems',
    'CS 3113 - Operating Systems', // Shortened title
    'CS 3823 - Algorithms and Data Structures', // More precise title
    'CS 4013 - Programming Language Paradigms', // More precise title
    'CS 4263 - Software Engineering I', // More precise title
    'CS 4323 - Principles of Database Systems', // Common CS course
    'CS 4413 - Senior Capstone Project', // Common Capstone
    'CS 4513 - Artificial Intelligence', // Common elective
    'CS 4613 - Introduction to Machine Learning', // Common elective
    'CS 4713 - Computer Networks', // Common elective
    'CS 4823 - Computer Graphics', // Common elective
    'CS 4853 - Introduction to Cybersecurity', // Common elective

    // Aerospace & Mechanical Engineering (AME)
    'AME 2113 - Statics',
    'AME 2213 - Dynamics',
    'AME 2613 - Fundamentals of Fluid Mechanics', // More precise title
    'AME 3113 - Thermodynamics I', // More precise title
    'AME 3353 - Machine Component Design', // More precise title
    'AME 3723 - Numerical Methods in AME',
    'AME 4113 - Heat Transfer',
    'AME 4213 - Design and Manufacturing Science', // Corrected typo and title
    'AME 4243 - Mechanical Engineering Design I', // Common Design course
    'AME 4253 - Mechanical Engineering Design II', // Common Design course
    'AME 4453 - Aerospace Structures', // Common AE course
    'AME 4553 - Aerodynamics', // Common AE course
    'AME 4723 - Vibrations', // Common course

    // Chemical Engineering (CHE)
    'CHE 2003 - Chemical Engineering Principles', // More precise title
    'CHE 2053 - Chemical Process Calculations', // More precise title
    'CHE 3103 - Chemical Engineering Thermodynamics',
    'CHE 3203 - Fluid Flow',
    'CHE 3303 - Heat Transfer Operations', // Common CHE course
    'CHE 3403 - Mass Transfer Operations', // Common CHE course
    'CHE 4103 - Chemical Reactor Design', // Common CHE course
    'CHE 4203 - Process Control', // Common CHE course
    'CHE 4253 - Chemical Engineering Design I', // Common Design course
    'CHE 4263 - Chemical Engineering Design II', // Common Design course

    // Civil Engineering (CE)
    'CE 2113 - Statics for Civil Engineers',
    'CE 3113 - Structural Analysis',
    'CE 3213 - Environmental Engineering Fundamentals', // More precise title
    'CE 3313 - Geotechnical Engineering',
    'CE 3403 - Transportation Engineering', // Common CE course
    'CE 4113 - Reinforced Concrete Design', // Common CE course
    'CE 4213 - Water and Wastewater Treatment', // Common CE course
    'CE 4313 - Foundation Engineering', // Common CE course
    'CE 4413 - Senior Design Project (Civil Engineering)', // Common Capstone

    // Electrical & Computer Engineering (ECE)
    'ECE 2523 - Digital Logic Design',
    'ECE 2713 - Electric Circuits I',
    'ECE 2723 - Electric Circuits II', // Added common follow-up
    'ECE 3003 - Signals and Systems',
    'ECE 3303 - Analog Electronics', // Common ECE course
    'ECE 3403 - Electromagnetics', // Common ECE course
    'ECE 3723 - Electrical Engineering Lab', // Common Lab
    'ECE 4203 - Introduction to VLSI Design', // Common CE/EE course
    'ECE 4303 - Power Systems Analysis', // Common EE course
    'ECE 4403 - Communication Systems', // Common EE course
    'ECE 4503 - Microprocessors and Embedded Systems', // Common CE course
    'ECE 4703 - Senior Design Project (ECE)', // Common Capstone

    // Other relevant foundational courses
    'MATH 2924 - Multivariable Calculus',
    'MATH 3413 - Differential Equations', // Very common for engineering
    'PHYS 2514 - General Physics for Engineering Students', // More precise title
    'CHEM 1315 - General Chemistry',
    'ENGR 1410 - Engineering Orientation', // Foundational course
    'ENGR 1500 - Introduction to Engineering Computing', // Foundational course
    'ENGR 2002 - Engineering Statistics', // Common for many engineering disciplines
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