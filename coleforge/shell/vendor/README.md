# Third-party libraries bundled with ColeForge

Copied unmodified from npm so ColeForge works offline. Each folder keeps the project's licence.

| Folder | Project | Version | Licence | Used by |
| --- | --- | --- | --- | --- |
| `libarchive/` | [libarchive.js](https://github.com/nika-begiashvili/libarchivejs), a WebAssembly build of [libarchive](https://github.com/libarchive/libarchive) (BSD-2-Clause) | 2.0.2 | MIT | WinNight: opens RAR (v4/v5), 7-Zip, TAR, GZIP, BZIP2, XZ, LZMA, ZSTD, ISO, CAB and more; writes .tar.gz/.tar.xz/.tar.bz2/.tar.zst |
| `hls/` | [hls.js](https://github.com/video-dev/hls.js) | 1.7.3 | Apache-2.0 | NightAmp: HLS (.m3u8) video and radio streams |

To update: `npm pack <name>@<version>`, then copy the files listed above from the package's `dist/`.

Also used, but kept inside our own files rather than in this folder:

| File | From | Licence | What |
| --- | --- | --- | --- |
| `js/nightamp-skin.js` | [Webamp](https://github.com/captbaritone/webamp) `skinSprites.ts` (Copyright (c) 2015 Jordan Eldredge) | MIT (notice in the file) | The Winamp 2 skin sprite coordinates NightAmp uses to read .wsz skins |
