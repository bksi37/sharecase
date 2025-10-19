// public/js/scripts.js
let currentLoggedInUserId = null;
let currentLoggedInUserRole = null;
let currentLoggedInUserFollowing = [];
let cachedUserData = null;

let searchTimeout;
const DEBOUNCE_DELAY = 300; // ms

// Expose global functions and variables
window.renderProjectCard = renderProjectCard;
window.renderUserSuggestion = renderUserSuggestion;
window.isUserFollowing = isUserFollowing;
window.toggleFollow = toggleFollow;
window.loadUserProfileInHeader = loadUserProfileInHeader;
window.searchUsers = searchUsers;
window.renderCollaboratorSearchResults = renderCollaboratorSearchResults;
window.populateDropdown = populateDropdown;
window.loadDynamicFilterOptions = loadDynamicFilterOptions;
window.performGlobalSearch = performGlobalSearch;
window.toggleLike = toggleLike; // New global export
window.deleteComment = deleteComment; // New global export
window.DEBOUNCE_DELAY = DEBOUNCE_DELAY;
window.searchTimeout = searchTimeout;

document.addEventListener('DOMContentLoaded', () => {
    loadUserProfileInHeader();

    const userMenuToggle = document.getElementById('userMenuToggle');
    const userDropdown = document.getElementById('userDropdown');
    const notificationButton = document.getElementById('notificationButton');
    const notificationList = document.getElementById('notificationList');
    const notificationCount = document.getElementById('notificationCount');

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

    if (notificationButton && notificationList && notificationCount) {
        notificationButton.addEventListener('click', async () => {
            if (!currentLoggedInUserId) {
                Toastify({
                    text: 'Please log in to view notifications.',
                    duration: 3000,
                    style: { background: '#e74c3c' },
                }).showToast();
                return;
            }
            await fetchNotifications();
        });
    }

    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.addEventListener('click', async (event) => {
            event.preventDefault();
            try {
                const response = await fetch('/logout', { credentials: 'include' });
                const data = await response.json();
                if (data.success && data.redirect) {
                    currentLoggedInUserId = null;
                    currentLoggedInUserRole = null;
                    currentLoggedInUserFollowing = [];
                    cachedUserData = null;
                    window.location.href = data.redirect;
                } else {
                    console.error('Logout failed:', data);
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

async function fetchNotifications() {
    const notificationList = document.getElementById('notificationList');
    const notificationCount = document.getElementById('notificationCount');
    if (!notificationList || !notificationCount) return;

    try {
        const response = await fetch('/notifications', { credentials: 'include' });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const notifications = await response.json();
        notificationList.innerHTML = notifications.length > 0
            ? notifications.map(n => `<div class="dropdown-item-text">${n.message}</div>`).join('')
            : '<div class="dropdown-item-text">No new notifications</div>';
        notificationCount.textContent = notifications.length;
        notificationCount.style.display = notifications.length > 0 ? 'inline' : 'none';
    } catch (error) {
        console.error('Error fetching notifications:', error);
        notificationList.innerHTML = '<div class="dropdown-item-text">Error loading notifications</div>';
        Toastify({
            text: 'Error loading notifications.',
            duration: 3000,
            style: { background: '#e74c3c' },
        }).showToast();
    }
}

async function loadUserProfileInHeader() {
    if (cachedUserData) {
        console.log('Using cached user data:', cachedUserData);
        updateHeaderUI(cachedUserData.user);
        return cachedUserData;
    }

    const authControls = document.getElementById('authControls');
    const loggedInUserContainer = document.getElementById('userMenuToggle');
    const userNameDisplay = document.getElementById('headerProfileName');
    const userProfilePic = document.getElementById('headerProfilePic');
    const userRoleDisplay = document.getElementById('userRoleDisplay');
    const userPointsDisplay = document.getElementById('userPointsDisplay');
    const adminDashboardLink = document.getElementById('adminDashboardLink');

    try {
        const response = await fetch('/current-user', {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });
        const data = await response.json();

        if (response.ok && data.isLoggedIn && data.user && data.user._id) {
            cachedUserData = data;
            currentLoggedInUserId = data.user._id.toString();
            currentLoggedInUserRole = data.user.role || 'external';
            currentLoggedInUserFollowing = Array.isArray(data.user.following) ? data.user.following.map(id => id.toString()) : [];
            updateHeaderUI(data.user);

            if (!data.user.isProfileComplete && window.location.pathname !== '/create-profile.html') {
                window.location.href = '/create-profile.html';
            }
        } else {
            cachedUserData = { isLoggedIn: false };
            currentLoggedInUserId = null;
            currentLoggedInUserRole = null;
            currentLoggedInUserFollowing = [];
            updateHeaderUI(null);
        }
    } catch (error) {
        console.error('Error fetching current user:', error);
        cachedUserData = { isLoggedIn: false };
        currentLoggedInUserId = null;
        currentLoggedInUserRole = null;
        currentLoggedInUserFollowing = [];
        updateHeaderUI(null);
        Toastify({
            text: 'Error loading user session.',
            duration: 3000,
            style: { background: '#e74c3c' },
        }).showToast();
    }
    return cachedUserData;
}

function updateHeaderUI(user) {
    const authControls = document.getElementById('authControls');
    const loggedInUserContainer = document.getElementById('userMenuToggle');
    const userNameDisplay = document.getElementById('headerProfileName');
    const userProfilePic = document.getElementById('headerProfilePic');
    const userRoleDisplay = document.getElementById('userRoleDisplay');
    const userPointsDisplay = document.getElementById('userPointsDisplay');
    const adminDashboardLink = document.getElementById('adminDashboardLink');
    const notificationButton = document.getElementById('notificationButton');

    if (user) {
        if (authControls) authControls.style.display = 'none';
        if (loggedInUserContainer) loggedInUserContainer.style.display = 'flex';
        if (userNameDisplay) userNameDisplay.textContent = user.name || 'Guest';
        if (userProfilePic) userProfilePic.src = user.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg';
        if (userRoleDisplay) userRoleDisplay.textContent = user.role || 'external';
        if (userPointsDisplay) userPointsDisplay.textContent = `${user.totalPoints || 0} pts`;
        if (adminDashboardLink) adminDashboardLink.style.display = user.role === 'admin' ? 'block' : 'none';
        if (notificationButton) notificationButton.style.display = 'inline-block';
    } else {
        if (authControls) authControls.style.display = 'flex';
        if (loggedInUserContainer) loggedInUserContainer.style.display = 'none';
        if (adminDashboardLink) adminDashboardLink.style.display = 'none';
        if (notificationButton) notificationButton.style.display = 'none'; // Hide for guests
    }
}

function isUserFollowing(targetUserId) {
    return cachedUserData?.isLoggedIn && Array.isArray(cachedUserData.user?.following)
        ? cachedUserData.user.following.map(id => id.toString()).includes(targetUserId.toString())
        : false;
}

async function toggleFollow(targetUserId, followButton, callback) {
    if (!currentLoggedInUserId) {
        Toastify({
            text: 'Please log in to follow users.',
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
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            credentials: 'include'
        });
        const data = await response.json();

        if (response.ok && data.success) {
            if (data.isFollowing) {
                cachedUserData.user.following.push(targetUserId);
                if (followButton) {
                    followButton.textContent = 'Following';
                    followButton.setAttribute('aria-label', 'Unfollow this user');
                    followButton.classList.remove('btn-outline-primary');
                    followButton.classList.add('btn-primary');
                }
            } else {
                cachedUserData.user.following = cachedUserData.user.following.filter(id => id !== targetUserId);
                if (followButton) {
                    followButton.textContent = 'Follow';
                    followButton.setAttribute('aria-label', 'Follow this user');
                    followButton.classList.remove('btn-primary');
                    followButton.classList.add('btn-outline-primary');
                }
            }
            if (document.getElementById('profileFollowingCount')) {
                document.getElementById('profileFollowingCount').textContent = cachedUserData.user.following.length;
            }
            if (document.getElementById('publicProfileFollowersCount')) {
                document.getElementById('publicProfileFollowersCount').textContent = data.followersCount;
            }
            if (callback) callback(data.isFollowing);
            Toastify({
                text: data.isFollowing ? 'Followed user!' : 'Unfollowed user!',
                duration: 3000,
                style: { background: '#28a745' },
            }).showToast();
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

function renderProjectCard(project) {
    // 🛑 FIX: Prioritize 'id' (from search/projects API response) but fall back to '_id'
    const projectId = project.id || project._id;
    
    // Defensive check against missing/invalid ID
    if (!projectId || projectId === 'undefined' || typeof projectId !== 'string' || projectId.length < 5) {
        console.warn('Invalid project ID detected during render:', project);
        return `
            <div class="col">
                <div class="card h-100">
                    <img src="${project.image ? project.image.replace('/upload/', '/upload/w_500,h_500,c_fill/') : 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg'}" class="card-img-top project-image" alt="${project.title || 'Project'}" style="object-fit: cover; height: 200px;" onerror="this.src='https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg'">
                    <div class="card-body">
                        <h5 class="card-title">${project.title || 'Untitled'}</h5>
                        <p class="card-text">${project.description ? project.description.substring(0, 100) + '...' : 'No description'}</p>
                        <p class="text-danger mt-2">Error: Project link invalid or missing ID.</p>
                    </div>
                </div>
            </div>
        `;
    }

    const clickAction = currentLoggedInUserId
        ? `window.location.href='/project.html?id=${projectId}'`
        : `window.location.href='/login.html?redirectedFrom=/project.html?id=${projectId}'`;

    const thumbnailURL = project.image
        ? project.image.replace('/upload/', '/upload/w_500,h_500,c_fill/')
        : 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg';

    return `
        <div class="col">
            <div class="card h-100" style="cursor: pointer;" onclick="${clickAction}">
                <img src="${thumbnailURL}" class="card-img-top project-image" alt="${project.title || 'Project'}" style="object-fit: cover; height: 200px;" onerror="this.src='https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg'">
                <div class="card-body">
                    <h5 class="card-title">${project.title || 'Untitled'}</h5>
                    <p class="card-text">${project.description ? project.description.substring(0, 100) + '...' : 'No description'}</p>
                    <div class="project-meta">
                        <span class="project-author">By <a href="/profile/${project.userId}">${project.userName || 'Unknown'}</a></span>
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
        <div class="autocomplete-item" onclick="window.location.href='/profile/${user._id}'"> 
            <img src="${user.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg'}" class="rounded-circle me-2" style="width: 30px; height: 30px; object-fit: cover;" alt="${user.name}">
            <span>${user.name || 'Unknown'}</span>
            <span class="user-detail">${user.major || user.department ? `(${user.major || ''}${user.major && user.department ? ', ' : ''}${user.department || ''})` : ''}</span>
        </div>
    `;
}

function populateDropdown(dropdown, options, defaultOption) {
    if (!dropdown) return;
    dropdown.innerHTML = `<option value="">${defaultOption}</option>`;
    options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option;
        dropdown.appendChild(opt);
    });
}

async function loadDynamicFilterOptions() {
    const courseFilter = document.getElementById('courseFilter');
    const yearFilter = document.getElementById('yearFilter');
    const typeFilter = document.getElementById('typeFilter');
    const departmentFilter = document.getElementById('departmentFilter');
    const categoryFilter = document.getElementById('categoryFilter');

    if (!courseFilter && !yearFilter && !typeFilter && !departmentFilter && !categoryFilter) {
        console.log('No filter dropdowns found. Skipping loadDynamicFilterOptions.');
        return;
    }

    try {
        const response = await fetch('/projects/dynamic-filter-options', { credentials: 'include' });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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

async function performGlobalSearch() {
    // Ensure DOM is ready
    if (document.readyState !== 'complete') {
        console.log('DOM not ready. Delaying performGlobalSearch.');
        return new Promise(resolve => window.addEventListener('load', resolve)).then(performGlobalSearch);
    }

    const projectGrid = document.getElementById('projectGrid');
    const projectGridHeader = document.getElementById('projectGridHeader');
    const noProjectsFoundSearchMessage = document.getElementById('noProjectsFoundSearchMessage');
    const initialLoadingMessage = document.getElementById('initialLoadingMessage');
    const autocompleteSuggestions = document.getElementById('autocompleteSuggestions');

    if (!projectGrid || !projectGridHeader || !noProjectsFoundSearchMessage || !initialLoadingMessage) {
        console.warn('Missing project grid elements:', {
            projectGrid: !!projectGrid,
            projectGridHeader: !!projectGridHeader,
            noProjectsFoundSearchMessage: !!noProjectsFoundSearchMessage,
            initialLoadingMessage: !!initialLoadingMessage
        });
        return;
    }

    const searchInput = document.getElementById('searchInput');
    const courseFilter = document.getElementById('courseFilter');
    const yearFilter = document.getElementById('yearFilter');
    const typeFilter = document.getElementById('typeFilter');
    const departmentFilter = document.getElementById('departmentFilter');
    const categoryFilter = document.getElementById('categoryFilter');

    const query = searchInput?.value.trim() || '';
    const course = courseFilter?.value || '';
    const year = yearFilter?.value || '';
    const type = typeFilter?.value || '';
    const department = departmentFilter?.value || '';
    const category = categoryFilter?.value || '';

    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (course) params.append('course', course);
    if (year) params.append('year', year);
    if (type) params.append('type', type);
    if (department) params.append('department', department);
    if (category) params.append('category', category);

    const queryString = params.toString();
    console.log('Performing search with query:', queryString);

    projectGrid.innerHTML = '';
    noProjectsFoundSearchMessage.style.display = 'none';
    initialLoadingMessage.textContent = 'Searching...';
    initialLoadingMessage.style.display = 'block';

    try {
        const response = await fetch(`/search?${queryString}`, { credentials: 'include' });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (data.success) {
            const projects = data.results?.projects || [];
            const users = data.results?.users || [];

            console.log('Search results:', { projects: projects.length, users: users.length });

            window.history.pushState({ path: `/index.html?${queryString}` }, '', `/index.html?${queryString}`);

            if (autocompleteSuggestions) {
                autocompleteSuggestions.innerHTML = users.map(u => renderUserSuggestion(u)).join('');
                autocompleteSuggestions.style.display = users.length > 0 && query ? 'block' : 'none';
            }

            if (projects.length > 0) {
                projectGridHeader.textContent = `Search Results (${projects.length} Projects, ${users.length} Users)`;
                projectGrid.innerHTML = projects.map(p => renderProjectCard(p)).join('');
                initialLoadingMessage.style.display = 'none';
            } else {
                projectGridHeader.textContent = 'Search Results';
                initialLoadingMessage.style.display = 'none';
                noProjectsFoundSearchMessage.textContent = 'No projects found matching your criteria.';
                noProjectsFoundSearchMessage.style.display = 'block';
            }
        } else {
            throw new Error(data.error || 'Search failed.');
        }
    } catch (error) {
        console.error('Error performing global search:', error);
        projectGridHeader.textContent = 'Search Failed';
        initialLoadingMessage.textContent = 'Error during search. Please try again.';
        initialLoadingMessage.style.display = 'block';
        Toastify({
            text: 'Search failed: ' + error.message,
            duration: 3000,
            style: { background: '#e74c3c' },
        }).showToast();
    }
}

async function loadAllProjects() {
    if (document.readyState !== 'complete') {
        console.log('DOM not ready. Delaying loadAllProjects.');
        return new Promise(resolve => window.addEventListener('load', resolve)).then(loadAllProjects);
    }

    const projectGrid = document.getElementById('projectGrid');
    const projectGridHeader = document.getElementById('projectGridHeader');
    const noProjectsFoundSearchMessage = document.getElementById('noProjectsFoundSearchMessage');
    const initialLoadingMessage = document.getElementById('initialLoadingMessage');

    if (!projectGrid || !projectGridHeader || !noProjectsFoundSearchMessage || !initialLoadingMessage) {
        console.warn('Missing project grid elements for loadAllProjects:', {
            projectGrid: !!projectGrid,
            projectGridHeader: !!projectGridHeader,
            noProjectsFoundSearchMessage: !!noProjectsFoundSearchMessage,
            initialLoadingMessage: !!initialLoadingMessage
        });
        return;
    }

    projectGrid.innerHTML = '';
    noProjectsFoundSearchMessage.style.display = 'none';
    initialLoadingMessage.textContent = 'Loading latest projects...';
    initialLoadingMessage.style.display = 'block';
    projectGridHeader.textContent = 'Latest Projects';

    try {
        const response = await fetch('/projects', { credentials: 'include' });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const projects = await response.json();
        console.log('Loaded projects:', projects.length);
        if (projects.length > 0) {
            projectGrid.innerHTML = projects.map(p => renderProjectCard(p)).join('');
            initialLoadingMessage.style.display = 'none';
        } else {
            initialLoadingMessage.textContent = 'No projects found.';
            initialLoadingMessage.style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading projects:', error);
        initialLoadingMessage.textContent = 'Error loading projects. Please try again.';
        Toastify({
            text: 'Error loading projects.',
            duration: 3000,
            style: { background: '#e74c3c' },
        }).showToast();
    }
}

async function searchUsers(query, resultsContainer, addChipCallback, selectedIds) {
    if (!query || !resultsContainer) {
        console.log('No query or resultsContainer for searchUsers:', { query, resultsContainer });
        if (resultsContainer) resultsContainer.style.display = 'none';
        return;
    }
    try {
        const response = await fetch(`/search?q=${encodeURIComponent(query)}`, { credentials: 'include' });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const users = data.results?.users || [];
        console.log('User search results:', users.length);
        renderCollaboratorSearchResults(users, resultsContainer, addChipCallback, selectedIds || []);
    } catch (error) {
        console.error('Error searching users:', error);
        if (resultsContainer) resultsContainer.style.display = 'none';
        Toastify({
            text: 'Error searching users.',
            duration: 3000,
            style: { background: '#e74c3c' },
        }).showToast();
    }
}

function renderCollaboratorSearchResults(users, resultsContainer, addChipCallback, selectedIds) {
    resultsContainer.innerHTML = '';
    if (!users.length) {
        resultsContainer.style.display = 'none';
        return;
    }

    users.forEach(user => {
        if (!/^[0-9a-fA-F]{24}$/.test(user._id)) {
            console.warn(`Invalid user ID: ${user._id}`);
            return;
        }
        if (!selectedIds.includes(user._id)) {
            const resultItem = document.createElement('a');
            resultItem.href = '#';
            resultItem.classList.add('list-group-item', 'list-group-item-action', 'd-flex', 'align-items-center');
            resultItem.dataset.userId = user._id;
            resultItem.dataset.userName = user.name || 'Unknown';
            resultItem.dataset.profilePic = user.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg';
            resultItem.innerHTML = `
                <img src="${user.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg'}" class="rounded-circle me-2" style="width: 30px; height: 30px; object-fit: cover;" alt="${user.name || 'User'}">
                <div>
                    <strong>${user.name || 'Unknown'}</strong> <small class="text-muted">(${user.email || 'No email'})</small>
                    ${user.major ? `<br><small class="text-muted">${user.major}</small>` : ''}
                </div>
            `;
            resultItem.addEventListener('click', (e) => {
                e.preventDefault();
                if (addChipCallback) {
                    addChipCallback(user._id, user.name || 'Unknown', user.profilePic);
                }
            });
            resultsContainer.appendChild(resultItem);
        }
    });

    resultsContainer.style.display = resultsContainer.children.length > 0 ? 'block' : 'none';
}

/**
 * Toggles the like status for a project and updates the UI (via callback).
 * @param {string} targetProjectId
 * @param {function} callback Function to reload project details on success (e.g., loadProject)
 */
async function toggleLike(targetProjectId, callback) {
    if (!currentLoggedInUserId) {
        Toastify({
            text: 'Please log in to like a project.',
            duration: 3000,
            style: { background: '#e74c3c' },
        }).showToast();
        // Redirect to login if not logged in
        window.location.href = `/login.html?redirectedFrom=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
    }

    try {
        const response = await fetch(`/projects/project/${targetProjectId}/like`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            credentials: 'include'
        });
        const data = await response.json();

        if (response.ok && data.success) {
            Toastify({
                text: data.hasLiked ? 'Project liked! 🎉' : 'Project unliked.',
                duration: 3000,
                style: { background: data.hasLiked ? '#ff5858' : '#6c757d' },
            }).showToast();
            
            if (callback) callback(); 
        } else {
            Toastify({
                text: data.error || 'Failed to toggle like status.',
                duration: 3000,
                style: { background: '#e74c3c' },
            }).showToast();
        }
    } catch (error) {
        console.error('Error toggling like:', error);
        Toastify({
            text: 'Error toggling like status.',
            duration: 3000,
            style: { background: '#e74c3c' },
        }).showToast();
    }
}

/**
 * Deletes a comment.
 * @param {string} projectId
 * @param {string} commentId
 */
async function deleteComment(projectId, commentId) {
    if (!currentLoggedInUserId) return;
    if (!confirm("Are you sure you want to delete this comment?")) return;
    
    try {
        const response = await fetch(`/projects/project/${projectId}/comment/${commentId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (response.ok) {
            Toastify({ text: 'Comment deleted successfully!', duration: 3000, style: { background: '#28a745' } }).showToast();
            return true;
        } else {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to delete comment');
        }
    } catch (error) {
        console.error('Error deleting comment:', error);
        Toastify({ text: error.message || 'Error deleting comment', duration: 3000, style: { background: '#e74c3c' } }).showToast();
        return false;
    }
}