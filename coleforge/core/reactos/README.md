# Experimental core: ReactOS

[ReactOS](https://github.com/reactos/reactos) is an open-source, Windows-compatible (NT
architecture) operating system under the GPL. It's the closest thing to a fully open
"Windows core": it runs many real Win32 `.exe` programs and uses Windows-style drivers.
It is written from scratch and refuses code derived from leaked Microsoft sources, so it's a
clean base to fork and brand.

## Reality check for the spare laptop

ReactOS is still alpha. Before investing time, boot the live image on the laptop:

| Works well | Hit or miss | Usually not yet |
| --- | --- | --- |
| VMs (VirtualBox, QEMU), older PCs, IDE/AHCI storage, PS/2 & USB input | USB 3, some Wi‑Fi cards (via Windows XP-era NDIS drivers), UEFI-only machines | Modern Radeon/NVIDIA acceleration, most current laptop Wi‑Fi |

If the live image boots with working display and networking, you can go further. If not, use
the Windows core track for the laptop and keep ReactOS for a VM or an older PC.

## ColeForge branding on ReactOS

The ColeForge shell (Electron/Chromium) needs Windows 10+ APIs, so it won't run on ReactOS.
Instead, bring the ColeForge look to ReactOS natively:

1. **Build ReactOS:** install the ReactOS Build Environment (RosBE), clone
   `reactos/reactos`, then `configure` → `ninja bootcd` (see the ReactOS wiki "Building ReactOS").
2. **Boot splash:** replace the boot logo bitmap used by `bootvid`/`freeldr` with a
   640×480, 16-color version of `shell/assets/art/boot-splash.webp`.
3. **Sounds:** copy `shell/assets/sounds/*.wav` into `media/` in the source tree (or `C:\ReactOS\Media`)
   and set them up in Control Panel → Sounds. The names match Windows events (see `core/windows/install-coleforge.ps1`).
4. **Theme:** ReactOS supports `.msstyles` visual styles. Start from its bundled "Lautus" style
   and recolor the title bars and Start button to the ColeForge navy/electric-blue palette in `shell/css/forge.css`.
5. **Wallpaper & cursors:** set them through Display/Mouse properties. Cursors need `.cur` exports of `shell/assets/cursors/*.svg`.
6. **Apps:** Doom Legacy, Chocolate Doom and EDuke32 all have Win32 builds that can run on ReactOS.

## Licensing note

Your ReactOS fork must stay GPL (publish source if you ever distribute it). The "Windows"
name is a Microsoft trademark. Fine for a private build; rename before sharing.
