// Global variables to store user session data
let currentLoggedInUserId = null;
let currentLoggedInUserRole = null;
let currentLoggedInUserFollowing = []; // To track who the current user is following

document.addEventListener('DOMContentLoaded', () => {
    // Call this function on DOMContentLoaded to load user data into the header
    // and set global variables. This runs on every page load.
    loadUserProfileInHeader();

    // --- Dropdown Menu Toggle ---
    const userMenuToggle = document.getElementById('userMenuToggle');
    const userDropdown = document.getElementById('userDropdown');

    if (userMenuToggle && userDropdown) {
        userMenuToggle.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent click from immediately closing dropdown
            userDropdown.style.display = userDropdown.style.display === 'block' ? 'none' : 'block';
        });

        // Close dropdown if clicked outside
        document.addEventListener('click', (e) => {
            if (!userMenuToggle.contains(e.target) && !userDropdown.contains(e.target)) {
                userDropdown.style.display = 'none';
            }
        });
    }

    // --- Logout Functionality ---
    const logoutLink = document.getElementById('logoutLink');

    if (logoutLink) {
        logoutLink.addEventListener('click', async (event) => {
            event.preventDefault(); // Prevent the default link navigation

            try {
                const response = await fetch('/logout');
                const data = await response.json();

                if (data.success && data.redirect) {
                    // Clear global variables on successful logout
                    currentLoggedInUserId = null;
                    currentLoggedInUserRole = null;
                    currentLoggedInUserFollowing = [];
                    window.location.href = data.redirect;
                } else {
                    console.error('Logout failed or redirect URL missing:', data);
                    Toastify({
                        text: data.error || 'Logout failed. Please try again.',
                        duration: 3000,
                        style: { background: '#e74c3c' },
                    }).showToast();
                }
            } catch (error) {
                console.error('Error during logout:', error);
                Toastify({
                    text: 'An error occurred during logout.',
                    duration: 3000,
                    style: { background: '#e74c3c' },
                }).showToast();
            }
        });
    }
});


/**
 * Fetches current user data and updates the header UI.
 * This function should be called on every page load to ensure header is consistent.
 */
async function loadUserProfileInHeader() {
    try {
        const response = await fetch('/current-user', { credentials: 'include' });
        const data = await response.json();

        const authControls = document.getElementById('authControls'); // Container for login/signup/user menu
        const loggedInUserContainer = document.getElementById('userMenuToggle'); // Specific container for user menu
        const userNameDisplay = document.getElementById('headerProfileName'); // For logged-in user's name
        const userProfilePic = document.getElementById('headerProfilePic'); // For logged-in user's profile pic
        const userRoleDisplay = document.getElementById('userRoleDisplay'); // For user's role
        const userPointsDisplay = document.getElementById('userPointsDisplay'); // For user's total points
        const adminDashboardLink = document.getElementById('adminDashboardLink'); // Admin link in dropdown

        if (data.isLoggedIn && data.user) {
            const user = data.user;

            // Set global variables
            currentLoggedInUserId = user._id;
            currentLoggedInUserRole = user.role;
            // Ensure following is an array, default to empty array if undefined/null
            currentLoggedInUserFollowing = user.following || []; 

            if (authControls) authControls.style.display = 'none'; // Hide login/signup
            if (loggedInUserContainer) loggedInUserContainer.style.display = 'flex'; // Show user menu

            if (userNameDisplay) userNameDisplay.textContent = user.name;
            if (userProfilePic) userProfilePic.src = user.profilePic;
            if (userRoleDisplay) userRoleDisplay.textContent = user.role; // Display user role
            if (userPointsDisplay) userPointsDisplay.textContent = `${user.totalPoints || 0} pts`; // Display points

            // Show admin dashboard link only for 'admin' or 'sharecase_worker' roles
            if (adminDashboardLink) {
                if (user.role === 'admin' || user.role === 'sharecase_worker') {
                    adminDashboardLink.style.display = 'block';
                } else {
                    adminDashboardLink.style.display = 'none';
                }
            }

            // Note: isProfileComplete check and redirect logic is better handled by middleware.
            // Keeping console.warn for client-side awareness.
            if (!user.isProfileComplete && window.location.pathname !== '/create-profile.html') {
                console.warn('User profile not complete. Backend middleware should handle redirect.');
            }

        } else {
            // User is not logged in
            currentLoggedInUserId = null;
            currentLoggedInUserRole = null;
            currentLoggedInUserFollowing = [];

            if (authControls) authControls.style.display = 'flex'; // Show login/signup
            if (loggedInUserContainer) loggedInUserContainer.style.display = 'none'; // Hide user menu
            if (adminDashboardLink) adminDashboardLink.style.display = 'none'; // Hide admin link
        }
    } catch (error) {
        console.error('Error fetching current user profile for header:', error);
        // Fallback to logged out state on error
        currentLoggedInUserId = null;
        currentLoggedInUserRole = null;
        currentLoggedInUserFollowing = [];
        const authControls = document.getElementById('authControls');
        const loggedInUserContainer = document.getElementById('userMenuToggle');
        if (authControls) authControls.style.display = 'flex';
        if (loggedInUserContainer) loggedInUserContainer.style.display = 'none';
        const adminDashboardLink = document.getElementById('adminDashboardLink');
        if (adminDashboardLink) adminDashboardLink.style.display = 'none';
    }
}

/**
 * Renders a project card HTML element for general display (index.html, public-profile.html).
 * Does NOT include project points, as they are a personal metric.
 * @param {Object} project - The project data object.
 * @returns {string} - The HTML string for the project card.
 */
function renderProjectCard(project) {
    const cardHtml = `
        <div class="col">
            <div class="card h-100" style="cursor: pointer;" onclick="window.location.href='/project.html?id=${project.id || project._id}'">
                <img src="${project.image || 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg'}" class="card-img-top" alt="${project.title}" onerror="this.src='https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg'">
                <div class="card-body">
                    <h5 class="card-title">${project.title}</h5>
                    <p class="card-text">${project.description ? project.description.substring(0, 100) + '...' : 'No description'}</p>
                    <div class="project-meta">
                        <span class="project-author">By <a href="/public-profile.html?userId=${project.userId}">${project.userName}</a></span>
                        <span class="project-views"><i class="fas fa-eye"></i> ${project.views || 0}</span>
                        <span class="project-likes"><i class="fas fa-heart"></i> ${project.likes || 0}</span>
                        </div>
                    <div class="project-tags">
                        ${(project.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
    return cardHtml;
}

/**
 * Renders a user suggestion card for autocomplete.
 * This function will be called by page-specific scripts.
 * @param {Object} user - The user data object.
 * @returns {string} - The HTML string for the user suggestion item.
 */
function renderUserSuggestion(user) {
    const userSuggestionHtml = `
        <div class="autocomplete-item" onclick="window.location.href='/public-profile.html?userId=${user._id}'">
            <img src="${user.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg'}" class="rounded-circle me-2" style="width: 30px; height: 30px; object-fit: cover;" alt="${user.name}">
            <span>${user.name}</span>
            <span class="user-detail">${user.major || user.department ? `(${user.major || ''}${user.major && user.department ? ', ' : ''}${user.department || ''})` : ''}</span>
        </div>
    `;
    return userSuggestionHtml;
}


/**
 * Toggles follow status for a user.
 * Assumes currentLoggedInUserId is globally available.
 * @param {string} targetUserId - The ID of the user to follow/unfollow.
 * @param {HTMLElement} followButton - The button element that triggered the action.
 * @param {Function} [callback] - Optional callback function to run after successful toggle. Receives isFollowing (boolean).
 */
async function toggleFollow(targetUserId, followButton, callback) {
    if (!currentLoggedInUserId) {
        Toastify({
            text: 'You must be logged in to follow users.',
            duration: 3000,
            style: { background: '#e74c3c' },
        }).showToast();
        return;
    }
    if (currentLoggedInUserId === targetUserId) {
        Toastify({
            text: 'You cannot follow yourself.',
            duration: 3000,
            style: { background: '#e74c3c' },
        }).showToast();
        return;
    }

    try {
        const response = await fetch(`/user/${targetUserId}/follow`, { // Path is /user/:id/follow as defined in routes/auth.js
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'include'
        });
        const data = await response.json();

        if (response.ok && data.success) {
            Toastify({
                text: data.message,
                duration: 3000,
                style: { background: '#28a745' },
            }).showToast();

            // Update UI based on new status
            if (followButton) {
                if (data.isFollowing) {
                    followButton.textContent = 'Unfollow';
                    followButton.classList.add('btn-primary');
                    followButton.classList.remove('btn-outline-primary');
                    // Add to global following list
                    if (!currentLoggedInUserFollowing.includes(targetUserId)) {
                        currentLoggedInUserFollowing.push(targetUserId);
                    }
                } else {
                    followButton.textContent = 'Follow';
                    followButton.classList.add('btn-outline-primary');
                    followButton.classList.remove('btn-primary');
                    // Remove from global following list
                    currentLoggedInUserFollowing = currentLoggedInUserFollowing.filter(id => id !== targetUserId);
                }
            }
            // Execute callback if provided (e.g., to re-fetch profile data for follower/following counts)
            if (callback && typeof callback === 'function') {
                callback(data.isFollowing); // Pass the new follow status to the callback
            }

        } else {
            Toastify({
                text: data.message || 'Failed to toggle follow status.',
                duration: 3000,
                style: { background: '#e74c3c' },
            }).showToast();
        }
    } catch (error) {
        console.error('Error toggling follow status:', error);
        Toastify({
            text: 'An error occurred while trying to follow/unfollow.',
            duration: 3000,
            style: { background: '#e74c3c' },
        }).showToast();
    }
}

/**
 * Checks if the current logged-in user is following a specific target user.
 * Assumes currentLoggedInUserFollowing is populated.
 * @param {string} targetUserId - The ID of the user to check.
 * @returns {boolean} - True if following, false otherwise.
 */
function isUserFollowing(targetUserId) {
    return currentLoggedInUserFollowing.includes(targetUserId);
}

// Global variables for debounce (used by index.html for search)
let searchTimeout;
const DEBOUNCE_DELAY = 300; // ms

/**
 * Populates a dropdown (select) element with options.
 * This is a utility function made global.
 * @param {HTMLElement} selectElement - The HTML select element.
 * @param {Array<string>} options - An array of string values for the options.
 * @param {string} defaultText - Text for the default "Select..." option.
 */
function populateDropdown(selectElement, options, defaultText = 'Select an option') {
    if (!selectElement) {
        console.warn('populateDropdown: selectElement is null or undefined.');
        return;
    }
    // Clear existing options and add a default "All" option dynamically based on label
    const labelText = selectElement.previousElementSibling ? selectElement.previousElementSibling.textContent.replace(':', '').trim() : '';
    selectElement.innerHTML = `<option value="">${defaultText || `All ${labelText || 'Options'}`}</option>`;
    options.forEach(optionValue => {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionValue;
        selectElement.appendChild(option);
    });
}

/**
 * Loads dynamic filter options from the backend.
 * This function is used on pages with filter modals (e.g., index.html).
 * This endpoint now relies on /dynamic-filter-options provided by projects.js
 */
async function loadDynamicFilterOptions() {
    // Ensure these elements are defined in the HTML page where this is called
    const courseFilter = document.getElementById('courseFilter');
    const yearFilter = document.getElementById('yearFilter');
    const typeFilter = document.getElementById('typeFilter'); // This is 'submission type' for tags
    const departmentFilter = document.getElementById('departmentFilter');
    const categoryFilter = document.getElementById('categoryFilter');

    if (!courseFilter || !yearFilter || !typeFilter || !departmentFilter || !categoryFilter) {
        console.warn('Filter dropdown elements not all found. Skipping dynamic filter loading for missing ones.');
        // Allow partial loading if some elements are missing on a page.
    }

    try {
        const response = await fetch('/dynamic-filter-options'); // Endpoint from projects.js
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const tagsData = await response.json();

        if (courseFilter) populateDropdown(courseFilter, tagsData.courses || [], 'All Courses');
        if (yearFilter) populateDropdown(yearFilter, tagsData.years || [], 'All Years');
        // 'type' from tagsData should correspond to the specific project submission types
        if (typeFilter) populateDropdown(typeFilter, tagsData.types || [], 'All Submission Types');
        if (departmentFilter) populateDropdown(departmentFilter, tagsData.departments || [], 'All Departments');
        if (categoryFilter) populateDropdown(categoryFilter, tagsData.categories || [], 'All Categories');

    } catch (error) {
        console.error('Error loading dynamic filter options:', error);
        Toastify({
            text: 'Error loading filter options.',
            duration: 3000,
            style: { background: '#e74c3c' },
        }).showToast();
    }
}


/**
 * Loads all projects for the main grid.
 * This function is specific to the index.html page and assumes elements exist.
 */
async function loadAllProjects() {
    const projectGrid = document.getElementById('projectGrid');
    const projectGridHeader = document.getElementById('projectGridHeader');
    const noProjectsFoundSearchMessage = document.getElementById('noProjectsFoundSearchMessage');
    const initialLoadingMessage = document.getElementById('initialLoadingMessage');
    const autocompleteSuggestions = document.getElementById('autocompleteSuggestions');

    if (!projectGrid || !projectGridHeader || !noProjectsFoundSearchMessage || !initialLoadingMessage || !autocompleteSuggestions) {
        console.warn('One or more project grid elements not found. Skipping loadAllProjects.');
        return;
    }

    projectGrid.innerHTML = ''; // Clear existing projects
    noProjectsFoundSearchMessage.style.display = 'none'; // Hide search-specific message
    initialLoadingMessage.textContent = 'Loading latest projects...';
    initialLoadingMessage.style.display = 'block'; // Show general loading message
    projectGridHeader.style.display = 'block'; // Show "Latest Projects" header

    autocompleteSuggestions.innerHTML = '';
    autocompleteSuggestions.style.display = 'none'; // Hide autocomplete

    try {
        const response = await fetch('/projects'); // Assuming this route exists and works
        if (response.ok) {
            const projects = await response.json();
            if (projects.length > 0) {
                // Uses renderProjectCard from this scripts.js, which now excludes points
                projectGrid.innerHTML = projects.map(p => renderProjectCard(p)).join('');
                initialLoadingMessage.style.display = 'none'; // Hide loading message
            } else {
                projectGrid.innerHTML = '';
                initialLoadingMessage.textContent = 'No projects found in the database.';
                initialLoadingMessage.style.display = 'block'; // Show message if no projects at all
            }
        } else {
            throw new Error('Failed to load all projects');
        }
    } catch (error) {
        console.error('Error loading all projects:', error);
        Toastify({
            text: 'Error loading projects.',
            duration: 3000,
            style: { background: '#e74c3c' },
        }).showToast();
        projectGrid.innerHTML = '';
        initialLoadingMessage.textContent = 'Error loading projects. Please try again.';
        initialLoadingMessage.style.display = 'block'; // Show error message
    }
}

/**
 * Performs a global search for projects and users.
 * This function is specific to the index.html page and assumes elements exist.
 */
async function performGlobalSearch() {
    const searchInput = document.getElementById('searchInput');
    const projectGrid = document.getElementById('projectGrid');
    const projectGridHeader = document.getElementById('projectGridHeader');
    const noProjectsFoundSearchMessage = document.getElementById('noProjectsFoundSearchMessage');
    const initialLoadingMessage = document.getElementById('initialLoadingMessage');
    const autocompleteSuggestions = document.getElementById('autocompleteSuggestions');

    // Filter elements - ensure they exist on the page
    const courseFilter = document.getElementById('courseFilter');
    const yearFilter = document.getElementById('yearFilter');
    const typeFilter = document.getElementById('typeFilter');
    const departmentFilter = document.getElementById('departmentFilter');
    const categoryFilter = document.getElementById('categoryFilter');

    if (!searchInput || !projectGrid || !projectGridHeader || !noProjectsFoundSearchMessage || !initialLoadingMessage || !autocompleteSuggestions) {
        console.warn('One or more search/project grid elements not found. Skipping global search.');
        // Allow partial execution if filters are missing (e.g., on pages without a filter modal)
    }


    const query = searchInput ? searchInput.value.trim() : '';
    const course = courseFilter ? courseFilter.value : '';
    const year = yearFilter ? yearFilter.value : '';
    const type = typeFilter ? typeFilter.value : '';
    const department = departmentFilter ? departmentFilter.value : '';
    const category = categoryFilter ? categoryFilter.value : '';

    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (course) params.append('course', course);
    if (year) params.append('year', year);
    if (type) params.append('type', type);
    if (department) params.append('department', department);
    if (category) params.append('category', category);

    const isSearchActive = query || course || year || type || department || category;

    if (!isSearchActive) {
        loadAllProjects(); // Load all projects if no active search/filters
        autocompleteSuggestions.innerHTML = '';
        autocompleteSuggestions.style.display = 'none';
        return;
    }

    if (initialLoadingMessage) initialLoadingMessage.style.display = 'none';
    if (projectGridHeader) projectGridHeader.style.display = 'none';
    if (noProjectsFoundSearchMessage) noProjectsFoundSearchMessage.style.display = 'none';

    try {
        const response = await fetch(`/search?${params.toString()}`); // Endpoint from projects.js
        if (response.ok) {
            const data = await response.json(); // Expects { success: true, results: { projects: [], users: [] } }
            const projects = data.results.projects;
            const users = data.results.users;

            // Handle Autocomplete Suggestions for Users (using renderUserSuggestion from this scripts.js)
            if (query && users.length > 0 && autocompleteSuggestions) {
                autocompleteSuggestions.innerHTML = users.map(u => renderUserSuggestion(u)).join('');
                autocompleteSuggestions.style.display = 'block';
            } else if (autocompleteSuggestions) {
                autocompleteSuggestions.innerHTML = '';
                autocompleteSuggestions.style.display = 'none';
            }

            // Display Project Results (using renderProjectCard from this scripts.js, which excludes points)
            if (projectGrid) {
                if (projects.length > 0) {
                    projectGrid.innerHTML = projects.map(p => renderProjectCard(p)).join('');
                    if (noProjectsFoundSearchMessage) noProjectsFoundSearchMessage.style.display = 'none'; // Hide if projects are found
                } else {
                    projectGrid.innerHTML = '';
                    if (noProjectsFoundSearchMessage) {
                        noProjectsFoundSearchMessage.textContent = 'No projects found matching your search or filters.';
                        noProjectsFoundSearchMessage.style.display = 'block'; // Show "No projects found" message
                    }
                }
            }

        } else {
            throw new Error('Failed to perform search');
        }
    } catch (error) {
        console.error('Error performing global search:', error);
        Toastify({
            text: 'Error performing search.',
            duration: 3000,
            style: { background: '#e74c3c' },
        }).showToast();
        if (projectGrid) projectGrid.innerHTML = '';
        if (noProjectsFoundSearchMessage) {
            noProjectsFoundSearchMessage.textContent = 'Error loading search results. Please try again.';
            noProjectsFoundSearchMessage.style.display = 'block'; // Show error message
        }
        if (autocompleteSuggestions) {
            autocompleteSuggestions.innerHTML = '';
            autocompleteSuggestions.style.display = 'none';
        }
    }
}


// public/js/scripts.js (or your upload.html script if searchUsers is defined there)

async function searchUsers(query, resultsContainer, addChipCallback, selectedIds) { // Updated function signature from previous suggestions
    if (!query) {
        resultsContainer.style.display = 'none';
        return;
    }
    try {
        // --- CRITICAL CHANGE HERE ---
        // Change '/users/search' to '/search' or whatever path your global search route is mounted under
        const response = await fetch(`/search?q=${encodeURIComponent(query)}`); // Assuming '/search' is your global route for users and projects
        
        if (!response.ok) {
            const errorData = await response.json();
            Toastify({ text: errorData.message || 'Error searching users.', duration: 3000, style: { background: '#e74c3c' } }).showToast();
            resultsContainer.style.display = 'none';
            return;
        }
        const data = await response.json();
        const users = data.results && Array.isArray(data.results.users) ? data.results.users : [];

        // Now, pass the users array to your rendering function
        renderCollaboratorSearchResults(users, resultsContainer, addChipCallback, selectedIds); 
    } catch (error) {
        console.error('Error searching users:', error);
        Toastify({ text: 'Network error during user search.', duration: 3000, style: { background: '#e74c3c' } }).showToast();
        resultsContainer.style.display = 'none';
    }
}

// Ensure renderCollaboratorSearchResults is defined and uses the passed arguments
function renderCollaboratorSearchResults(users, resultsContainer, addChipCallback, selectedIds) {
    resultsContainer.innerHTML = ''; // Clear previous results

    if (users.length === 0) {
        resultsContainer.style.display = 'none';
        return;
    }

    users.forEach(user => {
        // Prevent showing users already selected in the chip list
        if (!selectedIds.includes(user._id)) { 
            const resultItem = document.createElement('a');
            resultItem.href = '#'; 
            resultItem.classList.add('list-group-item', 'list-group-item-action', 'd-flex', 'align-items-center');
            resultItem.dataset.userId = user._id;
            resultItem.dataset.userName = user.name;
            resultItem.dataset.profilePic = user.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg';

            resultItem.innerHTML = `
                <img src="${user.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg'}" class="rounded-circle me-2" style="width: 30px; height: 30px; object-fit: cover;" alt="${user.name}">
                <div>
                    <strong>${user.name}</strong> <small class="text-muted">(${user.email || 'No email'})</small>
                    ${user.major ? `<br><small class="text-muted">${user.major}</small>` : ''}
                </div>
            `;
            resultsContainer.appendChild(resultItem);
        }
    });

    if (resultsContainer.children.length > 0) {
        resultsContainer.style.display = 'block';
    } else {
        resultsContainer.style.display = 'none';
    }
}

// Make sure searchUsers is exposed globally in scripts.js if called from upload.html
window.searchUsers = searchUsers;