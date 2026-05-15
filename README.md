# 🖥️ Proxy Status

A Windows system tray application for managing proxy settings from system tray.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-blue)
![Electron](https://img.shields.io/badge/electron-28.x-9feaf9)

## ✨ Features

- 🎯 **System Tray Integration** – Green/red icon shows proxy status at a glance
- 🔄 **One-Click Toggle** – Turn proxy on/off from tray menu
- 📋 **Profile Management** – Save, edit, activate, and delete multiple proxy configurations
- 🌓 **Auto Dark Mode** – Follows Windows theme automatically
- 🪟 **Windows 11 Design** – Glassmorphism, animations, and native scrollbars
- 🔔 **Toast Notifications** – Non-intrusive alerts instead of popup dialogs
- 🚀 **Startup with Windows** – Optional auto-start toggle in tray menu
- 🔄 **Live Sync** – Detects proxy changes from other apps in real-time

## 🚀 Installation

### Download
Download the latest installer from the [Releases](https://github.com/erfandavari/ProxyStatus/releases) page.

### Build from Source
```bash
# Clone the repository
git clone https://github.com/erfandavari/ProxyStatus.git
cd ProxyStatus

# Install dependencies
npm install

# Run in development mode
npm start

# Build installer
npm run build
```

Prerequisites:

Node.js 18+
npm
Windows 10 or 11

🛠️ Tech Stack
Electron – Desktop framework

electron-builder – Packaging & distribution

electron-store – Persistent storage

Windows Registry API – Proxy management

CSS Glassmorphism – Windows 11 design

📁 Project Structure
text
ProxyStatus/
├── assets/              # Icons and images
│   ├── proxy-on.png
│   ├── proxy-off.png
│   ├── icon-view.png
│   ├── icon-activate.png
│   ├── icon-active.png
│   └── icon-delete.png
├── build/               # Installer resources
│   ├── icon.ico
│   ├── installer-header.bmp
│   └── installer-sidebar.bmp
├── main.js              # Electron main process
├── preload.js           # Preload script
├── renderer.js          # UI logic
├── index.html           # Main window
├── styles.css           # Styling
├── profiles.html        # Profiles page (if separate)
├── profiles-renderer.js # Profiles logic
├── LICENSE              # MIT License
├── README.md
└── package.json

🔧 Usage
Launch – App starts silently in system tray

Click tray icon – Opens settings window

Configure – Enter proxy server, port, and exceptions

Toggle – Use switch to turn proxy on/off

Profiles – Save configurations for quick switching

Right-click tray – Access proxy toggle and startup settings

📝 License
MIT © Erfan Davari

🤝 Contributing
Contributions, issues, and feature requests are welcome!
Feel free to check the issues page.

⭐ Show Your Support
Give a ⭐️ if this project helped you!

