/**
 * ==========================================================================
 * DecisionVault Client Authentication Controller
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // If already logged in, redirect away from login/register pages
  const token = AuthToken.get();
  const currentPath = window.location.pathname;

  if (token && (currentPath.includes('login.html') || currentPath.includes('register.html'))) {
    window.location.href = '/';
    return;
  }

  // 1. Handle Login Form Submission
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const btnLogin = document.getElementById('btn-login');

      if (!email || !password) {
        showToast('Please enter both email and password', 'error');
        return;
      }

      try {
        btnLogin.disabled = true;
        btnLogin.textContent = 'Logging In...';

        await API.login(email, password);
        showToast('Welcome back to DecisionVault!', 'success');

        setTimeout(() => {
          window.location.href = '/';
        }, 500);
      } catch (error) {
        showToast(error.message || 'Login failed', 'error');
        btnLogin.disabled = false;
        btnLogin.textContent = 'Log In';
      }
    });
  }

  // 2. Handle Register Form Submission
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const btnRegister = document.getElementById('btn-register');

      if (!name || !email || !password) {
        showToast('Please fill out all required fields', 'error');
        return;
      }

      if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
      }

      if (password.length < 6) {
        showToast('Password must be at least 6 characters long', 'error');
        return;
      }

      try {
        btnRegister.disabled = true;
        btnRegister.textContent = 'Creating Account...';

        await API.register(name, email, password, confirmPassword);
        showToast('Account created successfully!', 'success');

        setTimeout(() => {
          window.location.href = '/';
        }, 500);
      } catch (error) {
        showToast(error.message || 'Registration failed', 'error');
        btnRegister.disabled = false;
        btnRegister.textContent = 'Create Account';
      }
    });
  }

  // 3. Handle Guest Mode Authentication
  const btnGuestAuth = document.getElementById('btn-guest-auth');
  if (btnGuestAuth) {
    btnGuestAuth.addEventListener('click', async () => {
      try {
        btnGuestAuth.disabled = true;
        btnGuestAuth.textContent = 'Launching Guest Session...';

        await API.guestLogin();
        showToast('Entered Guest Mode. Your decisions are tracked temporarily.', 'success');

        setTimeout(() => {
          window.location.href = '/';
        }, 500);
      } catch (error) {
        showToast(error.message || 'Guest access failed', 'error');
        btnGuestAuth.disabled = false;
        btnGuestAuth.textContent = '⚡ Continue as Guest (Instant Demo)';
      }
    });
  }

  // 4. Handle Official Google Identity Services (GSI)
  const btnGoogleAuth = document.getElementById('btn-google-auth');
  const googleBtnContainer = document.getElementById('google-signin-btn-container');

  async function initializeGoogleIdentityServices() {
    try {
      const res = await fetch('/api/auth/google/client-id');
      const data = await res.json();
      const clientId = data.clientId;

      if (clientId && window.google && google.accounts && google.accounts.id) {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            try {
              showToast('Verifying Google Account...', 'info');
              await API.googleAuth({ credential: response.credential });
              showToast('Welcome to DecisionVault!', 'success');
              setTimeout(() => {
                window.location.href = '/';
              }, 500);
            } catch (err) {
              showToast(err.message || 'Google Sign-In verification failed', 'error');
            }
          }
        });

        if (googleBtnContainer) {
          google.accounts.id.renderButton(googleBtnContainer, {
            theme: 'outline',
            size: 'large',
            width: 320,
            text: 'continue_with',
            shape: 'rectangular'
          });
          // Hide custom fallback button since official Google button is rendered
          if (btnGoogleAuth) btnGoogleAuth.style.display = 'none';
        }
      }
    } catch (e) {
      console.warn('Google Identity Services initialization note:', e.message);
    }
  }

  // Attempt GSI initialization once DOM and scripts are ready
  if (window.google) {
    initializeGoogleIdentityServices();
  } else {
    window.addEventListener('load', () => {
      setTimeout(initializeGoogleIdentityServices, 300);
    });
  }

  // Fallback handler if clicked when official client ID is not yet configured in environment
  if (btnGoogleAuth) {
    btnGoogleAuth.addEventListener('click', async () => {
      const promptEmail = prompt(
        'Google OAuth Setup Note:\nTo use the official Google popup on your domain, add GOOGLE_CLIENT_ID to your environment variables.\n\nEnter your Google email to test Google Sign-In right now:',
        'demo.user@gmail.com'
      );
      if (!promptEmail) return;

      const promptName = prompt('Enter your name for your Google profile:', 'Google Explorer') || 'Google Explorer';

      try {
        btnGoogleAuth.disabled = true;
        await API.googleAuth({
          email: promptEmail,
          name: promptName,
          googleId: `google_${Date.now()}`
        });
        showToast(`Signed in with Google as ${promptName}!`, 'success');
        setTimeout(() => {
          window.location.href = '/';
        }, 500);
      } catch (error) {
        showToast(error.message || 'Google login failed', 'error');
        btnGoogleAuth.disabled = false;
      }
    });
  }
});
