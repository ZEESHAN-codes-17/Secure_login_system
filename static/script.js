// Global state management
let currentUser = null;
let isLoggedIn = false;

// Utility Functions
function showFlashMessage(message, type = 'info') {
    const flashContainer = document.getElementById('flashMessages');
    const flashDiv = document.createElement('div');
    flashDiv.className = `flash-message ${type}`;
    flashDiv.textContent = message;
    
    flashContainer.appendChild(flashDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (flashDiv.parentNode) {
            flashDiv.parentNode.removeChild(flashDiv);
        }
    }, 5000);
}

function clearFormErrors() {
    document.querySelectorAll('.form-input').forEach(input => {
        input.classList.remove('error');
    });
}

function showFormErrors(errors) {
    if (Array.isArray(errors)) {
        errors.forEach(error => {
            showFlashMessage(error, 'error');
        });
    } else {
        showFlashMessage(errors, 'error');
    }
}

function setLoading(element, loading = true) {
    if (loading) {
        element.classList.add('loading');
        element.disabled = true;
    } else {
        element.classList.remove('loading');
        element.disabled = false;
    }
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
    const errors = [];
    
    if (password.length < 8) {
        errors.push("Password must be at least 8 characters long");
    }
    
    if (!/[A-Za-z]/.test(password)) {
        errors.push("Password must contain at least one letter");
    }
    
    if (!/[0-9]/.test(password)) {
        errors.push("Password must contain at least one number");
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// API Communication Functions
// API Communication Functions
async function apiCall(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || (data.errors && data.errors.join(', ')) || 'Request failed');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}


// Authentication Functions
async function handleLogin(formData) {
    const formObj = Object.fromEntries(formData);
    
    // Client-side validation
    if (!formObj.username || !formObj.password) {
        showFlashMessage('Username and password are required', 'error');
        return;
    }
    
    try {
        const data = await apiCall('/login', {
            method: 'POST',
            body: JSON.stringify(formObj)
        });
        
        showFlashMessage(data.message || 'Login successful!', 'success');
        isLoggedIn = true;
        updateNavigation();
        await loadUserProfile();
        showPage('dashboard');
        
    } catch (error) {
        showFlashMessage(error.message, 'error');
    }
}

async function handleRegister(formData) {
    const formObj = Object.fromEntries(formData);
    
    // Client-side validation
    const errors = [];
    
    if (!formObj.username || formObj.username.length < 3) {
        errors.push('Username must be at least 3 characters long');
    }
    
    if (!formObj.email || !validateEmail(formObj.email)) {
        errors.push('Valid email address is required');
    }
    
    if (formObj.password !== formObj.confirm_password) {
        errors.push('Passwords do not match');
    }
    
    const passwordValidation = validatePassword(formObj.password);
    if (!passwordValidation.isValid) {
        errors.push(...passwordValidation.errors);
    }
    
    if (errors.length > 0) {
        showFormErrors(errors);
        return;
    }
    
    try {
        const data = await apiCall('/register', {
            method: 'POST',
            body: JSON.stringify(formObj)
        });
        
        showFlashMessage(data.message || 'Registration successful!', 'success');
        isLoggedIn = true;
        updateNavigation();
        await loadUserProfile();
        showPage('dashboard');
        
    } catch (error) {
        showFlashMessage(error.message, 'error');
    }
}

async function handlePasswordReset(formData) {
    const formObj = Object.fromEntries(formData);
    
    if (!formObj.email || !validateEmail(formObj.email)) {
        showFlashMessage('Valid email address is required', 'error');
        return;
    }
    
    try {
        const data = await apiCall('/reset-password', {
            method: 'POST',
            body: JSON.stringify(formObj)
        });
        
        showFlashMessage(data.message || 'Reset link sent!', 'success');
        showPage('login');
        
    } catch (error) {
        showFlashMessage(error.message, 'error');
    }
}

async function handleLogout() {
    try {
        await fetch('/logout');
        isLoggedIn = false;
        currentUser = null;
        updateNavigation();
        showPage('home');
        showFlashMessage('Successfully logged out', 'info');
    } catch (error) {
        showFlashMessage('Logout failed', 'error');
    }
}

// User Profile Functions
async function loadUserProfile() {
    try {
        const data = await apiCall('/api/user/profile');
        currentUser = data;
        updateUserInfo();
    } catch (error) {
        console.error('Failed to load user profile:', error);
        // If profile loading fails, user might not be logged in
        isLoggedIn = false;
        updateNavigation();
    }
}

function updateUserInfo() {
    if (!currentUser) return;
    
    const userAvatar = document.getElementById('userAvatar');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const userEmail = document.getElementById('userEmail');
    const lastLogin = document.getElementById('lastLogin');
    const memberSince = document.getElementById('memberSince');
    
    if (userAvatar) {
        userAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
    }
    
    if (welcomeMessage) {
        welcomeMessage.textContent = `Welcome, ${currentUser.username}`;
    }
    
    if (userEmail) {
        userEmail.textContent = currentUser.email;
    }
    
    if (lastLogin) {
        if (currentUser.last_login) {
            const lastLoginDate = new Date(currentUser.last_login);
            lastLogin.textContent = lastLoginDate.toLocaleDateString();
        } else {
            lastLogin.textContent = 'First login';
        }
    }
    
    if (memberSince) {
        const createdDate = new Date(currentUser.created_at);
        memberSince.textContent = createdDate.toLocaleDateString();
    }
}

// Dashboard Functions
async function loadDashboardStats() {
    try {
        const data = await apiCall('/api/dashboard/stats');
        updateDashboardStats(data);
    } catch (error) {
        console.error('Failed to load dashboard stats:', error);
        showFlashMessage('Failed to load dashboard statistics', 'error');
    }
}

function updateDashboardStats(stats) {
    const statsContainer = document.getElementById('dashboardStats');
    if (!statsContainer) return;
    
    statsContainer.innerHTML = `
        <div class="stat-item">
            <div class="stat-value">${stats.neural_interface_status || 'Unknown'}</div>
            <div class="stat-label">Neural Interface</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${stats.security_level || 'Unknown'}</div>
            <div class="stat-label">Security Level</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${stats.network_connections || 0}</div>
            <div class="stat-label">Network Connections</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${stats.data_processed || '0 GB'}</div>
            <div class="stat-label">Data Processed</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${stats.uptime || '0%'}</div>
            <div class="stat-label">System Uptime</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${stats.active_sessions || 0}</div>
            <div class="stat-label">Active Sessions</div>
        </div>
    `;
}

function loadDashboardModule(module) {
    showFlashMessage(`Loading ${module} module...`, 'info');
    console.log(`Loading dashboard module: ${module}`);
    
    // In a real application, this would navigate to different module pages
    // For now, we'll just show a message
    setTimeout(() => {
        showFlashMessage(`${module} module loaded successfully`, 'success');
    }, 1000);
}

// Navigation Functions
function updateNavigation() {
    const loginLink = document.getElementById('loginLink');
    const registerLink = document.getElementById('registerLink');
    const dashboardLink = document.getElementById('dashboardLink');
    const logoutLink = document.getElementById('logoutLink');
    
    if (isLoggedIn) {
        loginLink.style.display = 'none';
        registerLink.style.display = 'none';
        dashboardLink.style.display = 'block';
        logoutLink.style.display = 'block';
    } else {
        loginLink.style.display = 'block';
        registerLink.style.display = 'block';
        dashboardLink.style.display = 'none';
        logoutLink.style.display = 'none';
    }
}

function showPage(pageId) {
    // Hide all pages
    const pages = document.querySelectorAll('.page-content');
    pages.forEach(page => page.classList.remove('active'));
    
    // Show target page
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
        
        // Load data for specific pages
        if (pageId === 'dashboard' && isLoggedIn) {
            loadDashboardStats();
        }
        
        // Redirect to login if trying to access dashboard without being logged in
        if (pageId === 'dashboard' && !isLoggedIn) {
            showFlashMessage('Please log in to access the dashboard', 'error');
            showPage('login');
            return;
        }
    }
}

// Form Event Handlers
function setupFormHandlers() {
    // Login Form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            clearFormErrors();
            
            const submitBtn = e.target.querySelector('.cyber-btn');
            setLoading(submitBtn, true);
            
            try {
                const formData = new FormData(e.target);
                await handleLogin(formData);
            } finally {
                setLoading(submitBtn, false);
            }
        });
    }
    
    // Register Form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            clearFormErrors();
            
            const submitBtn = e.target.querySelector('.cyber-btn');
            setLoading(submitBtn, true);
            
            try {
                const formData = new FormData(e.target);
                await handleRegister(formData);
            } finally {
                setLoading(submitBtn, false);
            }
        });
    }
    
    // Reset Password Form
    const resetForm = document.getElementById('resetForm');
    if (resetForm) {
        resetForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            clearFormErrors();
            
            const submitBtn = e.target.querySelector('.cyber-btn');
            setLoading(submitBtn, true);
            
            try {
                const formData = new FormData(e.target);
                await handlePasswordReset(formData);
            } finally {
                setLoading(submitBtn, false);
            }
        });
    }
}

// Visual Effects
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;
    
    const particleCount = 50;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.width = Math.random() * 4 + 2 + 'px';
        particle.style.height = particle.style.width;
        particle.style.animationDelay = Math.random() * 6 + 's';
        particle.style.animationDuration = (Math.random() * 4 + 4) + 's';
        particlesContainer.appendChild(particle);
    }
}

function setupInteractiveEffects() {
    // Dashboard card hover effects
    const cards = document.querySelectorAll('.dashboard-card');
    cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.animation = 'none';
            setTimeout(() => {
                this.style.animation = 'fadeInUp 0.8s ease-out';
            }, 10);
        });
    });
    
    // Form input effects
    document.querySelectorAll('.form-input').forEach(input => {
        input.addEventListener('focus', function() {
            this.style.animation = 'pulse 0.3s ease';
        });
        
        input.addEventListener('blur', function() {
            this.style.animation = 'none';
        });
        
        // Real-time validation feedback
        input.addEventListener('input', function() {
            this.classList.remove('error');
        });
    });
}

// Event Listeners
function setupEventListeners() {
    // Navbar scroll effect
    window.addEventListener('scroll', function() {
        const navbar = document.querySelector('.navbar');
        if (window.scrollY > 50) {
            navbar.style.background = 'rgba(0, 0, 0, 0.95)';
            navbar.style.borderBottom = '1px solid rgba(0, 245, 255, 0.4)';
        } else {
            navbar.style.background = 'rgba(0, 0, 0, 0.9)';
            navbar.style.borderBottom = '1px solid rgba(0, 245, 255, 0.2)';
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + L for login page
        if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
            e.preventDefault();
            if (!isLoggedIn) {
                showPage('login');
            }
        }
        
        // Ctrl/Cmd + R for register page (prevent browser refresh)
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            if (!isLoggedIn) {
                e.preventDefault();
                showPage('register');
            }
        }
        
        // Escape to go home
        if (e.key === 'Escape') {
            showPage('home');
        }
    });
    
    // Auto-hide flash messages on click
    const flashContainer = document.getElementById('flashMessages');
    if (flashContainer) {
        flashContainer.addEventListener('click', function(e) {
            if (e.target.classList.contains('flash-message')) {
                e.target.remove();
            }
        });
    }
}

// Session Check
async function checkSession() {
    try {
        await loadUserProfile();
        isLoggedIn = true;
        updateNavigation();
        console.log('User session found');
    } catch (error) {
        console.log('No active session found');
        isLoggedIn = false;
        updateNavigation();
    }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async function() {
    console.log('CyberNet initializing...');
    
    // Create visual effects
    createParticles();
    
    // Setup all event handlers
    setupFormHandlers();
    setupInteractiveEffects();
    setupEventListeners();
    
    // Check for existing session
    await checkSession();
    
    // Show default page
    showPage('home');
    
    console.log('CyberNet initialized successfully');
});