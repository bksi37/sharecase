// Global variables to store user session data
let currentLoggedInUserId = null;
let currentLoggedInUserRole = null;
let currentLoggedInUserFollowing = [];
let cachedUserData = null;

let searchTimeout;
const DEBOUNCE_DELAY = 300; // ms

// Expose global functions
window.renderProjectCard = renderProjectCard;
window.renderUserSuggestion = renderUserSuggestion;
window.isUserFollowing = isUserFollowing;
window.toggleFollow = toggleFollow;
window.loadUserProfileInHeader = loadUserProfileInHeader;
window.performGlobalSearch = performGlobalSearch;
window.searchUsers = searchUsers;
window.renderCollaboratorSearchResults = renderCollaboratorSearchResults;
window.loadDynamicFilterOptions = loadDynamicFilterOptions;

document.addEventListener('DOMContentLoaded', () => {
    // Load user data into the header
    loadUserProfileInHeader();

    // Dropdown Menu Toggle
    const userMenuToggle = document.getElementById('userMenuToggle');
    const userDropdown = document.getElementById('userDropdown');

    if (userMenuToggle && userDropdown) {
        userMenuToggle.addEventListener('click', (event) => {
            event.stopPropagation();
            userDropdown.style.display = userDropdown.style.display === 'block' ? 'none' : 'block';
        });

        document.addEventListener('click', (e) => {
            if (!userMenuToggle.contains(e.target) && !userDropdown.contains(e.target)) {
                userDropdown.style.display = 'none';
            }
        });
    }

    // Logout Functionality
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.addEventListener('click', async (event) => {
            event.preventDefault();
            try {
                const response = await fetch('/logout');
                const data = await response.json();
                if (data.success && data.redirect) {
                    currentLoggedInUserId = null;
                    currentLoggedInUserRole = null;
                    currentLoggedInUserFollowing = [];
                    cachedUserData = null;
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

async function loadUserProfileInHeader() {
    if (cachedUserData) {
        console.log('Using cached user data:', JSON.stringify(cachedUserData, null, 2));
        return cachedUserData;
    }

    try {
        const response = await fetch('/current-user', {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });
        console.log('Current-user response status:', response.status);
        const data = await response.json();
        console.log('Current-user response data:', JSON.stringify(data, null, 2));

        const authControls = document.getElementById('authControls');
        const loggedInUserContainer = document.getElementById('userMenuToggle');
        const userNameDisplay = document.getElementById('headerProfileName');
        const userProfilePic = document.getElementById('headerProfilePic');
        const userRoleDisplay = document.getElementById('userRoleDisplay');
        const userPointsDisplay = document.getElementById('userPointsDisplay');
        const adminDashboardLink = document.getElementById('adminDashboardLink');

        if (response.ok && data.isLoggedIn && data.user && data.user._id) {
            const user = data.user;
            currentLoggedInUserId = user._id.toString();
            currentLoggedInUserRole = user.role || 'user';
            currentLoggedInUserFollowing = Array.isArray(user.following) ? user.following.map(id => id.toString()) : [];
            cachedUserData = data;

            console.log('Set currentLoggedInUserId:', currentLoggedInUserId);

            if (authControls) authControls.style.display = 'none';
            if (loggedInUserContainer) loggedInUserContainer.style.display = 'flex';
            if (userNameDisplay) userNameDisplay.textContent = user.name || 'Guest';
            if (userProfilePic) userProfilePic.src = user.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg';
            if (userRoleDisplay) userRoleDisplay.textContent = user.role || 'user';
            if (userPointsDisplay) userPointsDisplay.textContent = `${user.totalPoints || 0} pts`;
            if (adminDashboardLink) {
                adminDashboardLink.style.display = user.role === 'admin' ? 'block' : 'none';
            }

            if (!user.isProfileComplete && window.location.pathname !== '/create-profile.html') {
                console.warn('User profile not complete. Redirecting to create-profile.html');
                window.location.href = '/create-profile.html';
            }
        } else {
            console.warn('User not logged in or invalid response:', JSON.stringify(data, null, 2));
            currentLoggedInUserId = null;
            currentLoggedInUserRole = null;
            currentLoggedInUserFollowing = [];
            cachedUserData = { isLoggedIn: false };
            if (authControls) authControls.style.display = 'flex';
            if (loggedInUserContainer) loggedInUserContainer.style.display = 'none';
            if (adminDashboardLink) adminDashboardLink.style.display = 'none';
        }
    } catch (error) {
        console.error('Error fetching current user profile for header:', error);
        currentLoggedInUserId = null;
        currentLoggedInUserRole = null;
        currentLoggedInUserFollowing = [];
        cachedUserData = { isLoggedIn: false };
        if (authControls) authControls.style.display = 'flex';
        if (loggedInUserContainer) loggedInUserContainer.style.display = 'none';
        if (adminDashboardLink) adminDashboardLink.style.display = 'none';
        Toastify({
            text: 'Error loading user session. Please log in again.',
            duration: 3000,
            style: { background: '#e74c3c' },
        }).showToast();
    }
    console.log('Final currentLoggedInUserId after loadUserProfileInHeader:', currentLoggedInUserId);
    return cachedUserData;
}

function isUserFollowing(targetUserId) {
    return cachedUserData?.isLoggedIn && Array.isArray(cachedUserData.user?.following)
        ? cachedUserData.user.following.map(id => id.toString()).includes(targetUserId.toString())
        : false;
}

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
        const response = await fetch(`/user/${targetUserId}/follow`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include'
        });
        const data = await response.json();

        if (response.ok && data.success) {
            Toastify({
                text: data.message || (data.isFollowing ? 'Followed user!' : 'Unfollowed user!'),
                duration: 3000,
                style: { background: '#28a745' },
            }).showToast();

            if (data.isFollowing) {
                if (cachedUserData?.user?.following) {
                    cachedUserData.user.following.push(targetUserId);
                }
                if (followButton) {
                    followButton.textContent = 'Following';
                    followButton.setAttribute('aria-label', 'Unfollow this user');
                    followButton.classList.remove('btn-outline-primary');
                    followButton.classList.add('btn-primary');
                }
                if (document.getElementById('profileFollowingCount')) {
                    const currentCount = parseInt(document.getElementById('profileFollowingCount').textContent) || 0;
                    document.getElementById('profileFollowingCount').textContent = currentCount + 1;
                }
            } else {
                if (cachedUserData?.user?.following) {
                    cachedUserData.user.following = cachedUserData.user.following.filter(id => id !== targetUserId);
                }
                if (followButton) {
                    followButton.textContent = 'Follow';
                    followButton.setAttribute('aria-label', 'Follow this user');
                    followButton.classList.remove('btn-primary');
                    followButton.classList.add('btn-outline-primary');
                }
                if (document.getElementById('profileFollowingCount')) {
                    const currentCount = parseInt(document.getElementById('profileFollowingCount').textContent) || 0;
                    document.getElementById('profileFollowingCount').textContent = currentCount - 1;
                }
            }
            if (document.getElementById('publicProfileFollowersCount')) {
                document.getElementById('publicProfileFollowersCount').textContent = data.followersCount;
            }
            if (callback) callback(data.isFollowing);
        } else {
            Toastify({
                text: data.error || 'Failed to toggle follow status.',
                duration: 3000,
                style: { background: '#e74c3c' },
            }).showToast();
        }
    } catch (error) {
        console.error('Error toggling follow:', error);
        Toastify({
            text: 'Error toggling follow status.',
            duration: 3000,
            style: { background: '#e74c3c' },
        }).showToast();
    }
}

function updateHeaderUI(user) {
    const authControls = document.getElementById('authControls');
    const loggedInUserContainer = document.getElementById('userMenuToggle');
    const userNameDisplay = document.getElementById('headerProfileName');
    const userProfilePic = document.getElementById('headerProfilePic');
    const userRoleDisplay = document.getElementById('userRoleDisplay');
    const userPointsDisplay = document.getElementById('userPointsDisplay');
    const adminDashboardLink = document.getElementById('adminDashboardLink');

    if (user) {
        if (authControls) authControls.style.display = 'none';
        if (loggedInUserContainer) loggedInUserContainer.style.display = 'flex';
        if (userNameDisplay) userNameDisplay.textContent = user.name || 'Guest';
        if (userProfilePic) userProfilePic.src = user.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg';
        if (userRoleDisplay) userRoleDisplay.textContent = user.role || 'user';
        if (userPointsDisplay) userPointsDisplay.textContent = `${user.totalPoints || 0} pts`;
        if (adminDashboardLink) {
            adminDashboardLink.style.display = user.role === 'admin' ? 'block' : 'none';
        }
    } else {
        if (authControls) authControls.style.display = 'flex';
        if (loggedInUserContainer) loggedInUserContainer.style.display = 'none';
        if (adminDashboardLink) adminDashboardLink.style.display = 'none';
    }
}

function renderProjectCard(project) {
    const clickAction = currentLoggedInUserId
        ? `window.location.href='/project.html?id=${project.id || project._id}'`
        : `window.location.href='/login.html?redirectedFrom=/project.html?id=${project.id || project._id}'`;

    // 🛑 FIX: Apply Cloudinary transformation for a 500x500 cropped thumbnail.
    // This assumes the saved project.image URL is the original, untransformed one.
    const thumbnailURL = project.image
        ? project.image.replace('/upload/', '/upload/w_500,h_500,c_fill/')
        : 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg';

    return `
        <div class="col">
            <div class="card h-100" style="cursor: pointer;" onclick="${clickAction}">
                <img src="${thumbnailURL}" class="card-img-top project-image" alt="${project.title}" onerror="this.src='https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg'">
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
}

function renderUserSuggestion(user) {
    return `
        <div class="autocomplete-item" onclick="window.location.href='/public-profile.html?userId=${user._id}'">
            <img src="${user.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg'}" class="rounded-circle me-2" style="width: 30px; height: 30px; object-fit: cover;" alt="${user.name}">
            <span>${user.name}</span>
            <span class="user-detail">${user.major || user.department ? `(${user.major || ''}${user.major && user.department ? ', ' : ''}${user.department || ''})` : ''}</span>
        </div>
    `;
}

function populateDropdown(selectElement, options, defaultText = 'Select an option') {
    if (!selectElement) {
        console.warn('populateDropdown: selectElement is null or undefined.');
        return;
    }
    const labelText = selectElement.previousElementSibling ? selectElement.previousElementSibling.textContent.replace(':', '').trim() : '';
    selectElement.innerHTML = `<option value="">${defaultText || `All ${labelText || 'Options'}`}</option>`;
    options.forEach(optionValue => {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionValue;
        selectElement.appendChild(option);
    });
}

async function loadDynamicFilterOptions() {
    const courseFilter = document.getElementById('courseFilter');
    const yearFilter = document.getElementById('yearFilter');
    const typeFilter = document.getElementById('typeFilter');
    const departmentFilter = document.getElementById('departmentFilter');
    const categoryFilter = document.getElementById('categoryFilter');

    if (!courseFilter && !yearFilter && !typeFilter && !departmentFilter && !categoryFilter) {
        console.warn('Filter dropdown elements not all found. Skipping dynamic filter loading.');
    }

    try {
        const response = await fetch('/dynamic-filter-options');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const tagsData = await response.json();

        if (courseFilter) populateDropdown(courseFilter, tagsData.courses || [], 'All Courses');
        if (yearFilter) populateDropdown(yearFilter, tagsData.years || [], 'All Years');
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

    projectGrid.innerHTML = '';
    noProjectsFoundSearchMessage.style.display = 'none';
    initialLoadingMessage.textContent = 'Loading latest projects...';
    initialLoadingMessage.style.display = 'block';
    projectGridHeader.style.display = 'block';
    autocompleteSuggestions.innerHTML = '';
    autocompleteSuggestions.style.display = 'none';

    try {
        const response = await fetch('/projects');
        if (response.ok) {
            const projects = await response.json();
            if (projects.length > 0) {
                projectGrid.innerHTML = projects.map(p => renderProjectCard(p)).join('');
                initialLoadingMessage.style.display = 'none';
            } else {
                projectGrid.innerHTML = '';
                initialLoadingMessage.textContent = 'No projects found in the database.';
                initialLoadingMessage.style.display = 'block';
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
        initialLoadingMessage.style.display = 'block';
    }
}

async function performGlobalSearch() {
    const searchInput = document.getElementById('searchInput');
    const projectGrid = document.getElementById('projectGrid');
    const projectGridHeader = document.getElementById('projectGridHeader');
    const noProjectsFoundSearchMessage = document.getElementById('noProjectsFoundSearchMessage');
    const initialLoadingMessage = document.getElementById('initialLoadingMessage');
    const autocompleteSuggestions = document.getElementById('autocompleteSuggestions');

    const courseFilter = document.getElementById('courseFilter');
    const yearFilter = document.getElementById('yearFilter');
    const typeFilter = document.getElementById('typeFilter');
    const departmentFilter = document.getElementById('departmentFilter');
    const categoryFilter = document.getElementById('categoryFilter');

    if (!searchInput || !projectGrid || !projectGridHeader || !noProjectsFoundSearchMessage || !initialLoadingMessage || !autocompleteSuggestions) {
        console.warn('One or more search/project grid elements not found. Skipping global search.');
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
        loadAllProjects();
        autocompleteSuggestions.innerHTML = '';
        autocompleteSuggestions.style.display = 'none';
        return;
    }

    if (initialLoadingMessage) initialLoadingMessage.style.display = 'none';
    if (projectGridHeader) projectGridHeader.style.display = 'none';
    if (noProjectsFoundSearchMessage) noProjectsFoundSearchMessage.style.display = 'none';

    try {
        const response = await fetch(`/search?${params.toString()}`);
        if (response.ok) {
            const data = await response.json();
            const projects = data.results.projects;
            const users = data.results.users;

            if (query && users.length > 0 && autocompleteSuggestions) {
                autocompleteSuggestions.innerHTML = users.map(u => renderUserSuggestion(u)).join('');
                autocompleteSuggestions.style.display = 'block';
            } else if (autocompleteSuggestions) {
                autocompleteSuggestions.innerHTML = '';
                autocompleteSuggestions.style.display = 'none';
            }

            if (projectGrid) {
                if (projects.length > 0) {
                    projectGrid.innerHTML = projects.map(p => renderProjectCard(p)).join('');
                    if (noProjectsFoundSearchMessage) noProjectsFoundSearchMessage.style.display = 'none';
                } else {
                    projectGrid.innerHTML = '';
                    if (noProjectsFoundSearchMessage) {
                        noProjectsFoundSearchMessage.textContent = 'No projects found matching your search or filters.';
                        noProjectsFoundSearchMessage.style.display = 'block';
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
            noProjectsFoundSearchMessage.style.display = 'block';
        }
        if (autocompleteSuggestions) {
            autocompleteSuggestions.innerHTML = '';
            autocompleteSuggestions.style.display = 'none';
        }
    }
}

async function searchUsers(query, resultsContainer, addChipCallback, selectedIds) {
    if (!query) {
        resultsContainer.style.display = 'none';
        return;
    }
    try {
        const response = await fetch(`/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
            const errorData = await response.json();
            Toastify({ text: errorData.message || 'Error searching users.', duration: 3000, style: { background: '#e74c3c' } }).showToast();
            resultsContainer.style.display = 'none';
            return;
        }
        const data = await response.json();
        const users = data.results && Array.isArray(data.results.users) ? data.results.users : [];
        renderCollaboratorSearchResults(users, resultsContainer, addChipCallback, selectedIds);
    } catch (error) {
        console.error('Error searching users:', error);
        Toastify({ text: 'Network error during user search.', duration: 3000, style: { background: '#e74c3c' } }).showToast();
        resultsContainer.style.display = 'none';
    }
}

function renderCollaboratorSearchResults(users, resultsContainer, addChipCallback, selectedIds) {
    resultsContainer.innerHTML = '';
    if (users.length === 0) {
        resultsContainer.style.display = 'none';
        return;
    }

    users.forEach(user => {
        // Validate user._id
        if (!user._id || !/^[0-9a-fA-F]{24}$/.test(user._id)) {
            console.warn(`Skipping invalid user ID for ${user.name || 'unknown'}: ${user._id}`);
            return;
        }

        if (!selectedIds.includes(user._id)) {
            const resultItem = document.createElement('a');
            resultItem.href = '#';
            resultItem.classList.add('list-group-item', 'list-group-item-action', 'd-flex', 'align-items-center');
            resultItem.dataset.userId = user._id;
            resultItem.dataset.userName = user.name || user.email || 'Unknown';
            resultItem.dataset.profilePic = user.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg';

            resultItem.innerHTML = `
                <img src="${user.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg'}" class="rounded-circle me-2" style="width: 30px; height: 30px; object-fit: cover;" alt="${user.name || 'User'}">
                <div>
                    <strong>${user.name || user.email || 'Unknown'}</strong> <small class="text-muted">(${user.email || 'No email'})</small>
                    ${user.major ? `<br><small class="text-muted">${user.major}</small>` : ''}
                </div>
            `;
            resultItem.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Clicked user:', { id: user._id, name: user.name, profilePic: user.profilePic }); // Debug
                if (addChipCallback) {
                    addChipCallback(user._id, user.name || user.email || 'Unknown', user.profilePic);
                }
            });
            resultsContainer.appendChild(resultItem);
        }
    });

    if (resultsContainer.children.length > 0) {
        resultsContainer.style.display = 'block';
    } else {
        resultsContainer.style.display = 'none';
    }
}