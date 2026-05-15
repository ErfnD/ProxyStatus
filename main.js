const { app, Tray, Menu, BrowserWindow, nativeImage, ipcMain, nativeTheme } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const Store = require('electron-store');

// ------------------------------------------------------------------
//  Persistent store for profiles, active profile & last proxy state
// ------------------------------------------------------------------
const store = new Store({
  defaults: {
    profiles: [],
    activeProfileId: null,
    lastUsedProxy: { server: '', port: '', exceptions: '' }  // saved for tray toggle
  }
});

const { execSync } = require('child_process');

// ------------------------------------------------------------------
//  Helper: get current proxy from registry using reg command
// ------------------------------------------------------------------
async function getProxyStatus() {
  try {
    // Query registry values
    const enableData = execSync(
      'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable',
      { encoding: 'utf8' }
    ).trim();
    
    const serverData = execSync(
      'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer',
      { encoding: 'utf8' }
    ).trim();
    
    const overrideData = execSync(
      'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyOverride',
      { encoding: 'utf8' }
    ).trim();

    // Parse values
    const enabled = enableData.includes('0x1');
    
    // Extract server (format: "ProxyServer    REG_SZ    127.0.0.1:8080")
    const serverMatch = serverData.match(/REG_SZ\s+(.+)/);
    const server = serverMatch ? serverMatch[1].trim() : '';
    
    // Extract exceptions
    const overrideMatch = overrideData.match(/REG_SZ\s+(.+)/);
    const exceptions = overrideMatch ? overrideMatch[1].trim() : '';

    return { enabled, server, exceptions };
  } catch (err) {
    console.error('Error reading registry:', err.message);
    return { enabled: false, server: '', exceptions: '' };
  }
}

// ------------------------------------------------------------------
//  Helper: write proxy settings and refresh Windows
// ------------------------------------------------------------------
async function setProxySettings(enabled, server, exceptions) {
  try {
    // Set ProxyEnable
    execSync(
      `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d ${enabled ? 1 : 0} /f`,
      { encoding: 'utf8' }
    );

    // Set ProxyServer
    execSync(
      `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer /t REG_SZ /d "${server}" /f`,
      { encoding: 'utf8' }
    );

    // Set ProxyOverride (exceptions)
    execSync(
      `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyOverride /t REG_SZ /d "${exceptions}" /f`,
      { encoding: 'utf8' }
    );

    // Refresh Windows internet settings
    refreshInternetSettings();
    
    return true;
  } catch (err) {
    console.error('Error setting proxy:', err.message);
    throw err;
  }
}

// ------------------------------------------------------------------
//  Helper: refresh Windows internet settings
// ------------------------------------------------------------------
function refreshInternetSettings() {
  try {
    // Use PowerShell to call InternetSetOption
    const psCommand = `
      Add-Type -TypeDefinition @"
        using System;
        using System.Runtime.InteropServices;
        public class WinINet {
          [DllImport("wininet.dll", SetLastError = true)]
          public static extern bool InternetSetOption(IntPtr hInternet, int dwOption, IntPtr lpBuffer, int dwBufferLength);
        }
"@;
      [WinINet]::InternetSetOption(0, 39, 0, 0) | Out-Null;
      [WinINet]::InternetSetOption(0, 37, 0, 0) | Out-Null;
    `;
    
    execSync(`powershell -NoProfile -Command "${psCommand.replace(/"/g, '\\"')}"`, {
      encoding: 'utf8',
      timeout: 5000
    });
  } catch (err) {
    console.error('Error refreshing internet settings:', err.message);
    // Non-critical error - settings are saved, just might take a moment to propagate
  }
}

// ------------------------------------------------------------------
//  Global proxy state (used for polling & tray)
// ------------------------------------------------------------------
let lastProxyStatus = { enabled: false, server: '', exceptions: '' };
let tray = null;
let mainWindow = null;

// ------------------------------------------------------------------
//  Dynamic tray menu builder
// ------------------------------------------------------------------
function buildTrayMenu() {
  const proxyEnabled = lastProxyStatus.enabled;
  const loginItemSettings = app.getLoginItemSettings();

  return Menu.buildFromTemplate([
    {
      label: 'Proxy On',
      type: 'checkbox',
      checked: proxyEnabled,
      click: async () => {
        // Toggle proxy using current registry values (server/port)
        const current = await getProxyStatus();
        const newEnabled = !current.enabled;
        await setProxySettings(newEnabled, current.server, current.exceptions);
        const updated = await getProxyStatus();
        lastProxyStatus = updated;
        updateTray(updated);
        updateTrayMenu();
        // Notify renderer
        if (mainWindow) {
          mainWindow.webContents.send('proxy-changed', updated);
        }
      }
    },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: loginItemSettings.openAtLogin,
      click: () => {
        const currentSetting = app.getLoginItemSettings().openAtLogin;
        app.setLoginItemSettings({ openAtLogin: !currentSetting });
        updateTrayMenu(); // refresh checkmark
      }
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
}

function updateTrayMenu() {
  if (tray) {
    tray.setContextMenu(buildTrayMenu());
  }
}

// ------------------------------------------------------------------
//  Tray icon & tooltip
// ------------------------------------------------------------------
function getAssetPath(filename) {
  // In development, files are in the project root
  // In production, they're in the app's resources
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'assets', filename);
  }
  return path.join(__dirname, 'assets', filename);
}

function updateTray(status) {
  const iconName = status.enabled ? 'proxy-on.png' : 'proxy-off.png';
  const iconPath = getAssetPath(iconName);
  tray.setImage(nativeImage.createFromPath(iconPath));
  tray.setToolTip(status.enabled ? `${status.server}` : 'Proxy Off');
}

// ------------------------------------------------------------------
//  Polling for external proxy changes
// ------------------------------------------------------------------
let pollInterval = null;

function startProxyPolling() {
  // Check every 2 seconds
  pollInterval = setInterval(async () => {
    const current = await getProxyStatus();
    if (
      current.enabled !== lastProxyStatus.enabled ||
      current.server !== lastProxyStatus.server ||
      current.exceptions !== lastProxyStatus.exceptions
    ) {
      lastProxyStatus = current;
      updateTray(current);
      updateTrayMenu();
      if (mainWindow) {
        mainWindow.webContents.send('proxy-changed', current);
      }
    }
  }, 2000);
}

// ------------------------------------------------------------------
//  Main window
// ------------------------------------------------------------------
function createMainWindow() {
  const isDark = nativeTheme.shouldUseDarkColors;
  mainWindow = new BrowserWindow({
    width: 400,
    height: 400,
    resizable: false,
    maximizable: false, 
    frame: false,
    title: 'Proxy Manager',
    backgroundColor: isDark ? '#1E1E1E' : '#F9F9F9',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('theme-updated', nativeTheme.shouldUseDarkColors);
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ------------------------------------------------------------------
//  App initialisation
// ------------------------------------------------------------------
app.isQuitting = false;
app.on('before-quit', () => {
  app.isQuitting = true;
  if (pollInterval) clearInterval(pollInterval);
});

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);

  // Load initial proxy status
  lastProxyStatus = await getProxyStatus();

  // Create tray
  const iconPath = getAssetPath('proxy-off.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  updateTray(lastProxyStatus);
  updateTrayMenu();

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
    } else {
      createMainWindow();
    }
  });

  // Start watching for external proxy changes
  startProxyPolling();

  // Initial login item setting (menu already built with it)
});

// ------------------------------------------------------------------
//  IPC handlers
// ------------------------------------------------------------------

// Theme
ipcMain.handle('get-theme', () => nativeTheme.shouldUseDarkColors);

// Proxy
ipcMain.handle('get-proxy-status', async () => await getProxyStatus());

ipcMain.handle('apply-proxy', async (event, { enabled, server, exceptions }) => {
  await setProxySettings(enabled, server, exceptions);
  const status = await getProxyStatus();
  lastProxyStatus = status;
  updateTray(status);
  updateTrayMenu();
  store.set('activeProfileId', null);
  return status;
});

// Profiles
ipcMain.handle('get-profiles', () => store.get('profiles'));

ipcMain.handle('add-profile', async (event, { server, port, exceptions }) => {
  const profiles = store.get('profiles');
  
  // Check for exact duplicate
  const duplicate = profiles.find(p =>
    p.server === server && 
    p.port === port && 
    p.exceptions === exceptions
  );
  
  if (duplicate) {
    return { success: false, message: 'Profile already exists.' };
  }

  const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  profiles.push({ id, server, port, exceptions });
  store.set('profiles', profiles);
  return { success: true, id };
});

ipcMain.handle('activate-profile', async (event, profileId) => {
  const profiles = store.get('profiles');
  const profile = profiles.find(p => p.id === profileId);
  if (!profile) return { success: false, message: 'Profile not found' };
  await setProxySettings(true, `${profile.server}:${profile.port}`, profile.exceptions);
  store.set('activeProfileId', profileId);
  const status = await getProxyStatus();
  lastProxyStatus = status;
  updateTray(status);
  updateTrayMenu();
  return status;
});

ipcMain.handle('delete-profile', async (event, profileId) => {
  const profiles = store.get('profiles').filter(p => p.id !== profileId);
  store.set('profiles', profiles);
  if (store.get('activeProfileId') === profileId) {
    store.set('activeProfileId', null);
  }
  return true;
});

ipcMain.handle('get-active-profile-id', () => store.get('activeProfileId'));

ipcMain.handle('get-default-exceptions', () =>
  '<local>;localhost;127.*;10.*;172.16.*;172.17.*;172.18.*;172.19.*;172.20.*;172.21.*;172.22.*;172.23.*;172.24.*;172.25.*;172.26.*;172.27.*;172.28.*;172.29.*;172.30.*;172.31.*;192.168.*'
);

// Close window
ipcMain.handle('close-window', () => {
  if (mainWindow) mainWindow.hide();
  return true;
});

// Login item (startup)
ipcMain.handle('get-login-item-settings', () => app.getLoginItemSettings().openAtLogin);
ipcMain.handle('set-login-item-settings', (event, openAtLogin) => {
  app.setLoginItemSettings({ openAtLogin });
  updateTrayMenu();
  return app.getLoginItemSettings().openAtLogin;
});