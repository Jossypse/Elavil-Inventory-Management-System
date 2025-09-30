(function() {
    // Common authentication functions for all pages
    
    function getCurrentUser() {
        const userSession = sessionStorage.getItem('elavil_user');
        if (userSession) {
            try {
                return JSON.parse(userSession);
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    function checkAuthentication() {
        const user = getCurrentUser();
        if (!user || (user.level !== 3 && user.level !== 4)) {
            // Redirect to login page
            window.location.href = 'index.html';
            return false;
        }
        return true;
    }

    function updateSidebarForUserLevel() {
        const user = getCurrentUser();
        if (!user) return;

        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        // Find all sidebar menu items
        const menuItems = sidebar.querySelectorAll('.sidebar-menu li');
        
        menuItems.forEach(item => {
            const link = item.querySelector('a');
            if (!link) return;

            const href = link.getAttribute('href');
            const isActive = item.classList.contains('active');
            
            // Hide/show items based on user level
            if (href === 'users.html' || href === 'buses.html') {
                // Only level 4 (admin) can see users and buses
                if (user.level === 4) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            } else if (href === 'requests.html' || href === 'supervisor.html' || href === 'return-requests.html') {
                // Only level 3 (supervisor) can see requests, supervisor, and return requests pages
                if (user.level === 3) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            }
        });
    }

    function addUserInfoToHeader() {
        const user = getCurrentUser();
        if (!user) return;

        // Find the header or create user info display
        const header = document.querySelector('header');
        if (header) {
            // Check if user info already exists
            let userInfo = header.querySelector('.user-info');
            if (!userInfo) {
                userInfo = document.createElement('div');
                userInfo.className = 'user-info';
                userInfo.style.cssText = `
                    position: absolute;
                    right: 20px;
                    top: 50%;
                    transform: translateY(-50%);
                    display: flex;
                    align-items: center;
                    gap: 10px;
                `;
                header.style.position = 'relative';
                header.appendChild(userInfo);
            }

            userInfo.innerHTML = `
                <span style="color: #666; font-size: 0.9rem;">
                    Welcome, <strong>${user.fullName}</strong> (${user.level === 3 ? 'Supervisor' : 'Admin'})
                </span>
                <button id="logout-btn" style="
                    background: #dc3545;
                    color: white;
                    border: none;
                    padding: 5px 10px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 0.8rem;
                ">
                    <i class="fas fa-sign-out-alt"></i> Logout
                </button>
            `;

            // Add logout functionality
            const logoutBtn = userInfo.querySelector('#logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', logout);
            }
        }
    }

    function logout() {
        if (confirm('Are you sure you want to logout?')) {
            sessionStorage.removeItem('elavil_user');
            window.location.href = 'index.html';
        }
    }

    // Initialize authentication when DOM is loaded
    function initAuth() {
        if (checkAuthentication()) {
            updateSidebarForUserLevel();
            addUserInfoToHeader();
        }
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAuth);
    } else {
        initAuth();
    }

    // Make functions available globally if needed
    window.ElavilAuth = {
        getCurrentUser,
        checkAuthentication,
        logout
    };
})();
