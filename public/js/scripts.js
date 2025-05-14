document.addEventListener('DOMContentLoaded', () => {
    // Dropdown Menu Toggle
    const userMenuToggle = document.getElementById('userMenuToggle');
    const userDropdown = document.getElementById('userDropdown');

    if (userMenuToggle && userDropdown) {
        userMenuToggle.addEventListener('click', () => {
            userDropdown.style.display = userDropdown.style.display === 'block' ? 'none' : 'block';
        });

        document.addEventListener('click', (e) => {
            if (!userMenuToggle.contains(e.target) && !userDropdown.contains(e.target)) {
                userDropdown.style.display = 'none';
            }
        });
    }

    // Logout Functionality
    const logoutLink = document.getElementById('authLink');

    if (logoutLink) {
        logoutLink.addEventListener('click', async (event) => {
            event.preventDefault(); // Prevent the default link navigation

            try {
                const response = await fetch('/logout');
                const data = await response.json();

                if (data.success && data.redirect) {
                    window.location.href = data.redirect;
                } else {
                    console.error('Logout failed or redirect URL missing:', data);
                    Toastify({
                        text: 'Logout failed. Please try again.',
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