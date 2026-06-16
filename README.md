# Solaar Individual Battery - GNOME Extension

A modern, native GNOME Shell extension (designed specifically for GNOME 45+ / 50 on Wayland) that seamlessly integrates your Logitech peripherals' battery status into the GNOME desktop. It reads directly from the `solaar` CLI to bypass UPower limitations for Bolt/Unifying receivers.


<center><img width="231" height="64" alt="Captura de tela de 2026-06-16 18-21-42" src="https://github.com/user-attachments/assets/d75e6e20-5435-4348-b14f-648ad6154b6b" /> </center>

## ✨ Features

- **Dual Interface:** Provides a unified experience by displaying individual battery indicators on the **Top Panel** and grouping them under a dedicated expandable pill in the **Quick Settings** menu.
- **Native Aesthetics:** Utilizes GNOME's native symbolic battery icons (`battery-level-*-symbolic`), ensuring it matches the system design language perfectly.
- **Dynamic Hover Interactions:** Hide textual clutter on the Top Panel by default. Simply hover over an icon to smoothly expand it and reveal the exact device name and battery percentage.
- **Charging State Detection:** Automatically detects if your device is currently charging and applies the correct charging battery icon.
- **Quick Solaar Access:** Click on any of the battery indicators (or items inside the Quick Settings menu) to instantly launch the Solaar GUI.
- **Pure Asynchronous:** Built with pure ESM modules and fully asynchronous `Gio.Subprocess` calls to prevent UI freezing during battery polling.

## 📦 Dependencies

- `solaar` must be installed on your system. 
  - Ensure that running `solaar show` in your terminal returns the status of your connected Logitech devices.
- GNOME 45 or newer (Tested on GNOME 50).

## 🚀 Installation

1. Copy this entire folder to your local GNOME Extensions directory:
   ```bash
   cp -r . ~/.local/share/gnome-shell/extensions/solaar-individual-battery@marcus.local
   ```
2. **Wayland Users:** Log out and log back into your GNOME session to reload the extensions. 
   *(X11 users can simply press `Alt + F2`, type `r` and hit Enter).*
3. Enable the extension via the command line or the GNOME Extensions app:
   ```bash
   gnome-extensions enable solaar-individual-battery@marcus.local
   ```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
