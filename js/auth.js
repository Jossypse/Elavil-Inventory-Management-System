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
        
        if (!user) {
            window.location.href = 'index.html';
            return false;
        }
        
        // Check if level is a valid number
        const userLevel = parseInt(user.level);
        
        if (userLevel !== 3 && userLevel !== 4) {
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
        const userLevel = parseInt(user.level);
        
        menuItems.forEach(item => {
            const link = item.querySelector('a');
            if (!link) return;

            const href = link.getAttribute('href');
            
            // Show/hide items based on user level
            if (userLevel === 3) {
                // Level 3 (Supervisor) - Show only: supervisor, requests, return-requests
                if (href === 'supervisor.html' || href === 'requests.html' || href === 'return-requests.html') {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            } else if (userLevel === 4) {
                // Level 4 (Admin) - Show all pages including reports
                item.style.display = 'block';
            } else {
                // Other levels - Hide all
                item.style.display = 'none';
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
            initSidebarBurger();
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

    // Sidebar burger initialization (applies to all pages with a header)
    function initSidebarBurger() {
        const header = document.querySelector('header');
        if (!header) return;
        // Avoid duplicate button
        if (header.querySelector('.burger-btn')) return;
        const btn = document.createElement('button');
        btn.className = 'burger-btn';
        btn.setAttribute('aria-label', 'Toggle sidebar');
        btn.innerHTML = '<i class="fas fa-bars"></i>';
        header.appendChild(btn);

        // Apply persisted state
        const collapsed = localStorage.getItem('elavil_sidebar_collapsed') === '1';
        if (collapsed) document.body.classList.add('sidebar-collapsed');

        btn.addEventListener('click', function(){
            const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
            localStorage.setItem('elavil_sidebar_collapsed', isCollapsed ? '1' : '0');
        });
    }
})();
