# NightCode OS (Windows 11 edition)

Turns a spare laptop into a NightCode machine: it installs Windows 11 almost hands-free from a USB stick and signs
in straight to **NightCode**, the ColeForge app, full screen. Windows keeps running underneath (Wi-Fi, GPU, sleep,
Windows Update, its taskbar and Settings), so everything NightCode has works, including Netcon, Disk Dude, the
Forge Arcade engines and Albert.

Two modes:

- **App mode (default):** NightCode is an ordinary app that opens full screen at every sign-in. Windows' desktop
  is still there behind it, so Wi-Fi, Bluetooth, printers and every other Windows program just work.
- **Shell mode (`-ShellMode`):** ColeForge *replaces* Windows' desktop (explorer.exe). Purer, but Windows'
  own Wi-Fi flyout, Start menu and taskbar are gone; only pick it if you know you want that.

## What you need

- the spare laptop (UEFI, 2018 or newer; anything on it gets replaced)
- a USB stick, **16 GB or bigger** (it gets erased)
- the official **Windows 11 ISO** (the one Codex downloaded, or microsoft.com/software-download/windows11)
- a Windows license: a laptop that came with Windows activates by itself; otherwise Setup asks for a key
- the **NightCode OS kit**: on GitHub go to **Actions > NightCode OS kit > the newest run > Artifacts >
  NightCode-OS-Kit** and download it (it includes the ColeForge installer). Or use this folder from the
  repository after building the installer (`cd coleforge\desktop; npm install; npm run dist:win`).

## 1. Make the USB (on your main PC)

Unzip the kit, then in PowerShell **as administrator**, in the kit folder:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Make-NightCodeUSB.ps1
```

It finds the Windows 11 ISO in Downloads/Desktop (or pass `-Iso C:\path\Win11.iso`), lists your USB drives,
asks which one to erase (you type `ERASE`), asks for the laptop account's password, and writes the stick. It
takes 10-20 minutes.

| Option | |
| --- | --- |
| `-UserName Cole` | the laptop account (default Cole) |
| `-ShellMode` | make ColeForge the Windows shell instead of a full-screen app (see the two modes above) |
| `-ComputerName NIGHTCODE` | the laptop's name |
| `-AutoLogon` | keep signing in by itself (a laptop that stays home); off by default |
| `-Games` | also download the Forge Arcade game engines on first boot |
| `-NoPython` | skip Python (Netcon and Disk Dude then won't run) |
| `-SkipHardwareCheck` | install on a laptop without TPM 2.0 / Secure Boot / a supported CPU |
| `-ExistingUsb E:\` | already made a Windows USB with Rufus? This just adds NightCode to it |

## 2. Install (on the laptop)

1. Plug in the USB, power on and open the boot menu: usually **F12** (Dell, Lenovo, Acer), **F9** (HP),
   **Esc** (ASUS) or **F11** (MSI). Pick the USB's **UEFI** entry.
2. Windows Setup asks **one thing: where to install**. Pick the laptop's drive. For a clean start, delete its
   partitions and choose the unallocated space. (If it asks for a product key, click *I don't have a product key*;
   a laptop that shipped with Windows activates once it's online.)
3. When asked, **connect to Wi-Fi**. From then on it's automatic: it creates your account, signs in, and runs
   the NightCode setup (a console window with the NightCode logo):
   - installs ColeForge, sets NightCode to open full screen at every sign-in (plus a **NightCode** desktop
     shortcut), with the NightCode sounds and wallpaper
   - sets the NightCode lock screen, account picture, "NightCode OS" in System > About and the boot menu,
     dark mode, and turns off Windows tips, suggested apps and ads
   - installs Python and builds Netcon and Disk Dude (and the game engines with `-Games`)
   - deletes the password Setup left on the laptop, then restarts **straight into NightCode**

Total: about 30-45 minutes, mostly Windows Setup.

## Living with it

- **F11** switches NightCode between full screen and a normal window. The **Windows key** brings up Windows'
  Start menu and taskbar on top of it; the NightCode window is on the taskbar like any other app.
- **Wi-Fi:** click the network icon in NightCode's tray; it opens Windows' Wi-Fi list.
- **Start > Shut Down** really shuts down (or restarts) the laptop; pick **Close NightCode (back to Windows)**
  there to just leave NightCode.
- **Closed NightCode?** Double-click **NightCode** on the desktop. Launching it twice just brings the open one
  to the front.
- **Stop it opening at sign-in:** Task Manager > *Startup apps* > NightCode > Disable.
- **Shell mode only:** Windows' own desktop is Ctrl+Shift+Esc > *Run new task* > `explorer.exe`, and
  `C:\NightCode\coleforge\core\windows\uninstall-coleforge.ps1` puts Windows' desktop back for good.
- **Run the NightCode setup again** (e.g. it was offline): `powershell -ExecutionPolicy Bypass -File C:\NightCode\firstboot.ps1`.
  Its log is `C:\NightCode\logs\firstboot.log`.
- **Updates:** Windows Update keeps drivers and security up to date. Install a newer ColeForge by running its
  installer again.
- **The USB** still holds your password in `autounattend.xml`: reformat it or delete that file when you're done.

## Files

```
Make-NightCodeUSB.ps1        makes the USB (runs on your main PC)
autounattend.template.xml    the answers for Windows Setup (Make-NightCodeUSB fills in your settings)
NightCode\                   copied to C:\NightCode on the laptop
  firstboot.ps1              first-sign-in setup
  nightcode-tweaks.ps1       branding and quiet-Windows settings
  art\                       NightCode OEM logo, account picture (+ lock screen, added by the USB maker)
```

The kit build (`.github/workflows/nightcode-os.yml`) also parses every script and dry-runs the USB maker.
