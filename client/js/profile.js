/**
 * ==========================================================================
 * DecisionVault User Profile Controller
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', async () => {
  const token = AuthToken.get();
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  // DOM Elements
  const profileName = document.getElementById('profile-name');
  const profileEmail = document.getElementById('profile-email');
  const profileAccountBadge = document.getElementById('profile-account-type-badge');
  const profileJoinedDate = document.getElementById('profile-joined-date');
  const userAvatar = document.getElementById('user-avatar');

  const statTotal = document.getElementById('stat-total-decisions');
  const statReviewed = document.getElementById('stat-reviewed-decisions');
  const statAchieved = document.getElementById('stat-achieved-decisions');

  const guestUpgradeBox = document.getElementById('guest-upgrade-box');
  const upgradeForm = document.getElementById('upgrade-form');
  const btnSubmitUpgrade = document.getElementById('btn-submit-upgrade');

  const btnNavLogout = document.getElementById('btn-nav-logout');
  const btnLogoutProfile = document.getElementById('btn-logout-profile');

  // Bind logout actions
  if (btnNavLogout) btnNavLogout.addEventListener('click', () => API.logout());
  if (btnLogoutProfile) btnLogoutProfile.addEventListener('click', () => API.logout());

  try {
    const res = await API.getMe();
    const user = res.user;

    // Populate user details
    profileName.textContent = user.name;
    profileEmail.textContent = user.email;
    profileJoinedDate.textContent = formatDate(user.createdAt);
    userAvatar.textContent = (user.name || 'U').charAt(0).toUpperCase();

    // Account type badge
    if (user.isGuest) {
      profileAccountBadge.textContent = 'Guest Session';
      profileAccountBadge.className = 'badge badge-due';
      if (guestUpgradeBox) guestUpgradeBox.style.display = 'block';
    } else if (user.authProvider === 'google') {
      profileAccountBadge.textContent = 'Google Account';
      profileAccountBadge.className = 'badge badge-pending';
    } else {
      profileAccountBadge.textContent = 'Registered Account';
      profileAccountBadge.className = 'badge badge-achieved';
    }

    // Populate statistics
    if (user.stats) {
      statTotal.textContent = user.stats.totalDecisions || 0;
      statReviewed.textContent = user.stats.reviewedDecisions || 0;
      statAchieved.textContent = user.stats.achievedDecisions || 0;
    }

    // Handle Guest Account Upgrade
    if (upgradeForm) {
      upgradeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('upgrade-name').value.trim();
        const email = document.getElementById('upgrade-email').value.trim();
        const password = document.getElementById('upgrade-password').value;
        const confirmPassword = document.getElementById('upgrade-confirm-password').value;

        if (!name || !email || !password) {
          showToast('Please fill out all fields', 'error');
          return;
        }

        if (password !== confirmPassword) {
          showToast('Passwords do not match', 'error');
          return;
        }

        try {
          btnSubmitUpgrade.disabled = true;
          btnSubmitUpgrade.textContent = 'Upgrading Account...';

          await API.convertGuest(name, email, password, confirmPassword);
          showToast('Account upgraded successfully! All decisions permanently saved.', 'success');

          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } catch (error) {
          showToast(error.message || 'Account upgrade failed', 'error');
          btnSubmitUpgrade.disabled = false;
          btnSubmitUpgrade.textContent = 'Upgrade Account & Preserve Decisions';
        }
      });
    }
  } catch (error) {
    showToast('Failed to load profile data', 'error');
  }
});
