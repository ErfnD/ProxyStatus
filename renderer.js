const mainPage = document.getElementById('mainPage');
const profilesPage = document.getElementById('profilesPage');
const serverInput = document.getElementById('server');
const portInput = document.getElementById('port');
const exceptionsInput = document.getElementById('exceptions');
const toggleCheckbox = document.getElementById('toggleProxyCheckbox');
const defaultBtn = document.getElementById('defaultExceptions');
const addProfileBtn = document.getElementById('addProfile');
const profilesBtn = document.getElementById('profilesBtn');
const profileList = document.getElementById('profileList');
const titleBackBtn = document.getElementById('titleBackBtn');
const closeBtn = document.getElementById('closeBtn');
const toastContainer = document.getElementById('toastContainer');
const confirmModal = document.getElementById('confirmModal');
const modalMessage = document.getElementById('modalMessage');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');
const emptyState = document.getElementById('emptyState');

let isProxyOn = false;

// ---------- Toast System (unchanged) ----------
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  if (type === 'success') icon.textContent = '✅';
  else if (type === 'error') icon.textContent = '❌';
  else icon.textContent = 'ℹ️';

  const msg = document.createElement('span');
  msg.className = 'toast-message';
  msg.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', () => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 300);
  });

  toast.appendChild(icon);
  toast.appendChild(msg);
  toast.appendChild(closeBtn);
  toastContainer.appendChild(toast);

  // Force browser reflow then add show class (guarantees animation)
  toast.offsetHeight; // triggers reflow
  toast.classList.add('show');

  // Auto-dismiss after 3.5 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, 300);
    }
  }, 3500);
}

// ---------- Theme ----------
async function applyInitialTheme() {
  const isDark = await window.electronAPI.getTheme();
  document.body.classList.toggle('dark', isDark);
}
applyInitialTheme();
window.electronAPI.onThemeUpdated((isDark) => {
  document.body.classList.toggle('dark', isDark);
});

// ---------- Listen for external proxy changes ----------
window.electronAPI.onProxyChanged((status) => {
  // Only update UI if the main page is currently visible
  if (mainPage.classList.contains('active')) {
    refreshUI();
  }
  // Note: tray icon & tooltip are updated automatically by main process
});

// ---------- Page Switching ----------
function showPage(pageId) {
  const currentPage = document.querySelector('.page.active');
  const targetPage = document.getElementById(pageId);
  
  if (currentPage === targetPage) return;
  
  // Optional: track direction for more complex animations
  if (pageId === 'profilesPage') {
    targetPage.style.transform = 'translateX(30px)';
  } else {
    targetPage.style.transform = 'translateX(-20px)';
  }
  
  // Remove active from all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  
  // Add active to target
  targetPage.classList.add('active');
  
  // Reset transform after transition (handled by CSS)
  targetPage.style.transform = '';

  // Toggle back button visibility
  if (pageId === 'profilesPage') {
    titleBackBtn.style.display = 'inline-flex';
  } else {
    titleBackBtn.style.display = 'none';
  }
}

profilesBtn.addEventListener('click', async () => {
  showPage('profilesPage');
  await renderProfiles();
});

titleBackBtn.addEventListener('click', () => {
  showPage('mainPage');
  refreshUI();   // sync main form with current proxy status
});

// ---------- Core Proxy UI ----------
async function refreshUI() {
  const status = await window.electronAPI.getProxyStatus();
  isProxyOn = status.enabled;
  const [server = '', port = ''] = status.server.split(':');
  serverInput.value = server;
  portInput.value = port;
  exceptionsInput.value = status.exceptions;

  toggleCheckbox.checked = isProxyOn;

  const disabled = !isProxyOn;
  serverInput.disabled = disabled;
  portInput.disabled = disabled;
  exceptionsInput.disabled = disabled;
}

async function applySettings() {
  const server = serverInput.value.trim();
  const port = portInput.value.trim();
  const exceptions = exceptionsInput.value.trim();
  if (!server || !port) {
    showToast('Server and port are required.', 'error');
    return;
  }
  try {
    await window.electronAPI.applyProxy({ enabled: isProxyOn, server: `${server}:${port}`, exceptions });
    showToast('Proxy settings applied.', 'success');
    await refreshUI();
  } catch (err) {
    showToast('Failed to apply proxy settings.', 'error');
  }
}

// ---------- Confirmation Modal ----------
function showConfirm(message) {
  return new Promise((resolve) => {
    modalMessage.textContent = message;
    confirmModal.style.display = 'flex';
    
    const cleanup = () => {
      confirmModal.style.display = 'none';
      modalConfirmBtn.removeEventListener('click', onConfirm);
      modalCancelBtn.removeEventListener('click', onCancel);
    };
    
    const onConfirm = () => {
      cleanup();
      resolve(true);
    };
    
    const onCancel = () => {
      cleanup();
      resolve(false);
    };
    
    modalConfirmBtn.addEventListener('click', onConfirm);
    modalCancelBtn.addEventListener('click', onCancel);
  });
}

// Toggle proxy
toggleCheckbox.addEventListener('change', async () => {
  isProxyOn = toggleCheckbox.checked;
  const server = serverInput.value.trim();
  const port = portInput.value.trim();
  if (isProxyOn && (!server || !port)) {
    showToast('Please enter server and port before turning proxy on.', 'error');
    toggleCheckbox.checked = false;
    isProxyOn = false;
    return;
  }
  await applySettings();
});

// Default exceptions
defaultBtn.addEventListener('click', async () => {
  exceptionsInput.value = await window.electronAPI.getDefaultExceptions();
  showToast('Default exceptions loaded.', 'info');
});

// Add profile
addProfileBtn.addEventListener('click', async () => {
  const server = serverInput.value.trim();
  const port = portInput.value.trim();
  const exceptions = exceptionsInput.value.trim();
  
  if (!server || !port) {
    showToast('Server and port required.', 'error');
    return;
  }
  
  const result = await window.electronAPI.addProfile({ server, port, exceptions });
  
  if (result.success) {
    showToast('Profile added.', 'success');
    // Only refresh if profiles page is visible
    if (profilesPage.classList.contains('active')) {
      await renderProfiles();
    }
  } else {
    showToast(result.message, 'error');
  }
});

// Close button
closeBtn.addEventListener('click', async () => {
  await window.electronAPI.closeWindow();
});

// ---------- Profile List ----------
async function renderProfiles() {
  const profiles = await window.electronAPI.getProfiles();
  const activeId = await window.electronAPI.getActiveProfileId();

  if (profiles.length === 0) {
    profileList.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  profileList.style.display = '';
  profileList.innerHTML = '';
  emptyState.style.display = 'none';

  for (const p of profiles) {
    const li = document.createElement('li');
    li.className = 'profile-item';

    const info = document.createElement('span');
    info.className = 'profile-info';
    info.textContent = `${p.server}:${p.port}`;

    const actions = document.createElement('div');
    actions.className = 'profile-actions';

    // View button
    const viewBtn = document.createElement('button');
    viewBtn.className = 'icon-btn view';
    viewBtn.title = 'View / Edit';
    const viewImg = document.createElement('img');
    viewImg.src = 'assets/icon-view.png';
    viewImg.alt = 'View';
    viewImg.className = 'icon-img';
    viewBtn.appendChild(viewImg);
    viewBtn.addEventListener('click', () => {
      serverInput.value = p.server;
      portInput.value = p.port;
      exceptionsInput.value = p.exceptions;
      showPage('mainPage');
      showToast('Profile loaded for editing.', 'info');
      // Do NOT call renderProfiles() here
    });

    // Activate button
    const activateBtn = document.createElement('button');
    activateBtn.className = 'icon-btn';
    activateBtn.title = activeId === p.id ? 'Active' : 'Activate';
    const activateImg = document.createElement('img');
    if (activeId === p.id) {
      activateImg.src = 'assets/icon-active.png';
      activateImg.alt = 'Active';
      activateBtn.disabled = true;
    } else {
      activateImg.src = 'assets/icon-activate.png';
      activateImg.alt = 'Activate';
    }
    activateImg.className = 'icon-img';
    activateBtn.appendChild(activateImg);
    activateBtn.addEventListener('click', async () => {
      try {
        await window.electronAPI.activateProfile(p.id);
        showToast('Profile activated.', 'success');
        await renderProfiles();
      } catch (err) {
        showToast('Failed to activate profile.', 'error');
      }
    });

    // Delete button (inside renderProfiles)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-btn danger';
    deleteBtn.title = 'Delete';
    const deleteImg = document.createElement('img');
    deleteImg.src = 'assets/icon-delete.png';
    deleteImg.alt = 'Delete';
    deleteImg.className = 'icon-img';
    deleteBtn.appendChild(deleteImg);
    deleteBtn.addEventListener('click', async () => {
      const confirmed = await showConfirm(
        `Are you sure you want to delete the profile "${p.server}:${p.port}"?`
      );
      if (confirmed) {
        await window.electronAPI.deleteProfile(p.id);
        showToast('Profile deleted.', 'success');
        await renderProfiles();
      }
    });

    actions.appendChild(viewBtn);
    actions.appendChild(activateBtn);
    actions.appendChild(deleteBtn);
    li.appendChild(info);
    li.appendChild(actions);
    profileList.appendChild(li);
  }
}

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && confirmModal.style.display === 'flex') {
    modalCancelBtn.click();
  }
});

// Initial load
refreshUI();