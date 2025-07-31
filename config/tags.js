// config/tags.js

const OU_COURSES = [ // Renamed from OU_ENGINEERING_COURSES to reflect wider scope
    // Computer Science
    'CS 1313 - Programming for Non-CS Majors (Python)',
    'CS 1323 - Introduction to Computer Programming (Java)',
    'CS 2334 - Programming Structures and Abstractions (Java)',
    'CS 2413 - Data Structures (Java)',
    'CS 2613 - Discrete Structures',
    'CS 2813 - Introduction to Computer Systems',
    'CS 3113 - Operating Systems',
    'CS 3823 - Algorithms and Data Structures',
    'CS 4013 - Programming Language Paradigms',
    'CS 4263 - Software Engineering I',
    'CS 4323 - Principles of Database Systems',
    'CS 4413 - Senior Capstone Project (CS)',
    'CS 4513 - Artificial Intelligence',
    'CS 4613 - Introduction to Machine Learning',
    'CS 4713 - Computer Networks',
    'CS 4823 - Computer Graphics',
    'CS 4853 - Introduction to Cybersecurity',

    // Aerospace & Mechanical Engineering (AME)
    'ENGR 1413 - Engineering Thinking and Design',
    'ENGR 2002 - Professional Development for Engineers',
    'AME 2113 - Statics',
    'AME 2213 - Dynamics',
    'AME 2613 - Fundamentals of Fluid Mechanics',
    'AME 3113 - Thermodynamics I',
    'AME 3353 - Machine Component Design',
    'AME 3723 - Numerical Methods in AME',
    'AME 4113 - Heat Transfer',
    'AME 4213 - Design and Manufacturing Science',
    'AME 4243 - Mechanical Engineering Design I',
    'AME 4253 - Mechanical Engineering Design II',
    'AME 4453 - Aerospace Structures',
    'AME 4553 - Aerodynamics',
    'AME 4723 - Vibrations',
    'AME 4913 - Senior Capstone Design (AME)',

    // Chemical Engineering (CHE)
    'CHE 2003 - Chemical Engineering Principles',
    'CHE 2053 - Chemical Process Calculations',
    'CHE 3103 - Chemical Engineering Thermodynamics',
    'CHE 3203 - Fluid Flow',
    'CHE 3303 - Heat Transfer Operations',
    'CHE 3403 - Mass Transfer Operations',
    'CHE 4103 - Chemical Reactor Design',
    'CHE 4203 - Process Control',
    'CHE 4253 - Chemical Engineering Design I (CHE)',
    'CHE 4263 - Chemical Engineering Design II (CHE)',

    // Civil Engineering (CE)
    'CE 2113 - Statics for Civil Engineers',
    'CE 3113 - Structural Analysis',
    'CE 3213 - Environmental Engineering Fundamentals',
    'CE 3313 - Geotechnical Engineering',
    'CE 3403 - Transportation Engineering',
    'CE 4113 - Reinforced Concrete Design',
    'CE 4213 - Water and Wastewater Treatment',
    'CE 4313 - Foundation Engineering',
    'CE 4503 - Civil Engineering Design (CE)',

    // Electrical & Computer Engineering (ECE)
    'ECE 2523 - Digital Logic Design',
    'ECE 2713 - Electric Circuits I',
    'ECE 2723 - Electric Circuits II',
    'ECE 3003 - Signals and Systems',
    'ECE 3303 - Analog Electronics',
    'ECE 3403 - Electromagnetics',
    'ECE 3723 - Electrical Engineering Lab',
    'ECE 4203 - Introduction to VLSI Design',
    'ECE 4303 - Power Systems Analysis',
    'ECE 4403 - Communication Systems',
    'ECE 4503 - Microprocessors and Embedded Systems',
    'ECE 4603 - Senior Design Project (ECE)',

    // Arts & Sciences (Examples - Expand as needed)
    'ART 1003 - Art History Survey',
    'ENGL 1113 - English Composition I',
    'HIST 1483 - US History to 1877',
    'MATH 1823 - Calculus I',
    'BIOL 1114 - Intro Biology',
    'CHEM 1315 - General Chemistry',
    'PHYS 2514 - General Physics I',
    'PSY 1113 - Elements of Psychology',
    'SOC 1113 - Introduction to Sociology',
    'JOUR 1013 - Intro to Journalism',
    'COMM 1113 - Public Speaking',
    'PHIL 1113 - Introduction to Philosophy',
    'ECON 1113 - Principles of Economics (Micro)',

    // Business (Examples - Expand as needed)
    'B AD 1001 - Introduction to Business',
    'ACCT 2113 - Financial Accounting',
    'MGT 3013 - Principles of Management',
    'MKT 3013 - Principles of Marketing',
    'FIN 3403 - Business Finance',

    // Education (Examples - Expand as needed)
    'EDUC 1013 - Foundations of Education',
    'EDPY 3513 - Adolescent Development',

    // Fine Arts (Examples - Expand as needed)
    'MUS 1003 - Music Appreciation',
    'DRAM 1003 - Intro to Theatre',

    // Architecture (Examples - Expand as needed)
    'ARCH 1013 - Architectural Design I',
    'LA 1003 - Intro to Landscape Architecture'
];

const PROJECT_CATEGORIES = [ // More generic and descriptive
    'Class Project',
    'Research Project',
    'Personal Project',
    'Internship Project',
    'Hackathon Project',
    'Open Source Contribution',
    'Community Service Project',
    'Arts & Design',
    'Engineering & Technology',
    'Science & Research',
    'Humanities & Social Sciences',
    'Business & Entrepreneurship',
    'Education & Outreach',
    'Multimedia & Creative Works',
    'Senior Design / Capstone',
    'Other'
];

const PROJECT_YEARS = [
    '2022', '2023', '2024', '2025', '2026', '2027', '2028', // Expanded recent years
    '2021', '2020', '2019', // Older years if historical projects are allowed
];

const PROJECT_TYPES = [ // These are "types" of submissions, e.g., what form did the project take
    'Code / Software',
    'Report / Essay',
    'Presentation / Slides',
    'Research Paper',
    'Art / Design Portfolio',
    'Multimedia (Video, Audio)',
    'Hardware / Physical Prototype',
    'Thesis / Dissertation',
    'Business Plan',
    'Other'
];

const ALL_DEPARTMENTS = [ // Comprehensive list of OU colleges/departments
    'Aerospace & Mechanical Engineering',
    'Anthropology',
    'Architecture',
    'Art, School of',
    'Biology',
    'Chemical Engineering',
    'Chemistry and Biochemistry',
    'Civil Engineering & Environmental Science',
    'Communication',
    'Computer Science',
    'Construction Science',
    'Dance',
    'Data Science & Analytics',
    'Economics',
    'Educational Leadership & Policy',
    'Electrical & Computer Engineering',
    'English',
    'Environmental Design',
    'Finance',
    'Geography & Environmental Sustainability',
    'Geology & Geophysics',
    'Health & Exercise Science',
    'History',
    'International & Area Studies',
    'Journalism & Mass Communication',
    'Landscape Architecture',
    'Law',
    'Management',
    'Management Information Systems',
    'Marketing',
    'Mathematics',
    'Modern Languages, Literatures, and Linguistics',
    'Music, School of',
    'Native American Studies',
    'Philosophy',
    'Physics & Astronomy',
    'Political Science',
    'Psychology',
    'Public & Community Health',
    'Regional & City Planning',
    'Religious Studies',
    'Sociology',
    'Theatre',
    'Writing',
    'Other' // Catch-all for departments not explicitly listed
];

module.exports = {
    courses: OU_COURSES, // Renamed export key to match wider scope
    categories: PROJECT_CATEGORIES,
    years: PROJECT_YEARS,
    types: PROJECT_TYPES, // Renamed key to 'types' for consistency with front-end filter
    departments: ALL_DEPARTMENTS, // Renamed and expanded
};