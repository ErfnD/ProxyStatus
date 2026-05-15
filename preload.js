const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getTheme: () => ipcRenderer.invoke('get-theme'),
  onThemeUpdated: (callback) => ipcRenderer.on('theme-updated', (event, isDark) => callback(isDark)),

  getProxyStatus: () => ipcRenderer.invoke('get-proxy-status'),
  applyProxy: (data) => ipcRenderer.invoke('apply-proxy', data),
  onProxyChanged: (callback) => ipcRenderer.on('proxy-changed', (event, status) => callback(status)),

  getProfiles: () => ipcRenderer.invoke('get-profiles'),
  addProfile: (data) => ipcRenderer.invoke('add-profile', data),
  activateProfile: (id) => ipcRenderer.invoke('activate-profile', id),
  deleteProfile: (id) => ipcRenderer.invoke('delete-profile', id),
  getActiveProfileId: () => ipcRenderer.invoke('get-active-profile-id'),
  getDefaultExceptions: () => ipcRenderer.invoke('get-default-exceptions'),

  closeWindow: () => ipcRenderer.invoke('close-window'),
  getLoginItemSettings: () => ipcRenderer.invoke('get-login-item-settings'),
  setLoginItemSettings: (openAtLogin) => ipcRenderer.invoke('set-login-item-settings', openAtLogin)
});