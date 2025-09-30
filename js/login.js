(function() {
    // Initialize Firebase if not already initialized
    if (!firebase.apps || !firebase.apps.length) {
        const firebaseConfig = {
            apiKey: "AIzaSyB76JC1Rvi44Ke0F9vS5tiiZ4p8IeAh9mw",
            authDomain: "elavil-43c53.firebaseapp.com",
            databaseURL: "https://elavil-43c53-default-rtdb.firebaseio.com",
            projectId: "elavil-43c53",
            storageBucket: "elavil-43c53.firebasestorage.app",
            messagingSenderId: "899611486560",
            appId: "1:899611486560:web:3bd8de3b3720c9f4009605",
            measurementId: "G-ESX4H859XL"
        };
        firebase.initializeApp(firebaseConfig);
    }

    const database = firebase.database();
    const usersRef = database.ref('Users');

    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('toggle-password');
    const loginBtn = document.getElementById('login-btn');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error-message');

    function showError(message) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }

    function showLoading() {
        loginBtn.disabled = true;
        loadingDiv.style.display = 'block';
        loginForm.style.display = 'none';
    }

    function hideLoading() {
        loginBtn.disabled = false;
        loadingDiv.style.display = 'none';
        loginForm.style.display = 'block';
    }

    function authenticateUser(username, password) {
        return new Promise((resolve, reject) => {
            usersRef.child(username).once('value', (snapshot) => {
                if (!snapshot.exists()) {
                    reject(new Error('User not found'));
                    return;
                }

                const user = snapshot.val();
                
                // Check if password matches
                if (user.password !== password) {
                    reject(new Error('Invalid password'));
                    return;
                }

                // Check if user has required level (3 or 4)
                if (user.level !== 3 && user.level !== 4) {
                    reject(new Error('Access denied. Only supervisors (level 3) and admins (level 4) can access this system.'));
                    return;
                }

                resolve({
                    username: username,
                    fullName: user.fullName,
                    level: user.level,
                    employeeType: user.employeeType
                });
            });
        });
    }

    function saveUserSession(userData) {
        sessionStorage.setItem('elavil_user', JSON.stringify(userData));
    }

    function redirectBasedOnLevel(level) {
        // Level 3 (Supervisor) - can access requests and supervisor pages
        // Level 4 (Admin) - can access users and buses pages only
        if (level === 3) {
            // Redirect to supervisor page by default for level 3
            window.location.href = 'supervisor.html';
        } else if (level === 4) {
            // Redirect to users page by default for level 4 (admin)
            window.location.href = 'users.html';
        }
    }

    // Check if user is already logged in
    function checkExistingSession() {
        const userSession = sessionStorage.getItem('elavil_user');
        if (userSession) {
            try {
                const userData = JSON.parse(userSession);
                if (userData.level === 3 || userData.level === 4) {
                    redirectBasedOnLevel(userData.level);
                }
            } catch (e) {
                // Invalid session data, clear it
                sessionStorage.removeItem('elavil_user');
            }
        }
    }

    // Handle form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            showError('Please enter both username and password');
            return;
        }

        showLoading();

        try {
            const userData = await authenticateUser(username, password);
            saveUserSession(userData);
            redirectBasedOnLevel(userData.level);
        } catch (error) {
            hideLoading();
            showError(error.message);
        }
    });

    // Check for existing session on page load
    checkExistingSession();

    // Add Enter key support
    document.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !loginBtn.disabled) {
            loginForm.dispatchEvent(new Event('submit'));
        }
    });

    // Toggle password visibility
    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', function(){
            const isHidden = passwordInput.getAttribute('type') === 'password';
            passwordInput.setAttribute('type', isHidden ? 'text' : 'password');
            const icon = this.querySelector('i');
            if (icon) {
                icon.className = isHidden ? 'fas fa-eye-slash' : 'fas fa-eye';
            }
            this.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
        });
    }
})();
