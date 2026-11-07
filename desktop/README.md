# Yoinks GUI (Windows desktop app)

A simple desktop interface for the original [yoinks](https://github.com/pablostanley/yoinks) downloader. The original terminal app remains available and unchanged.

## Use it

1. Paste a supported video URL and click **Bağlantıyı bul**.
2. Select **Video + ses** or **Yalnızca ses (MP3)**.
3. Select an available video resolution and audio quality.
4. (Optional) click **Klasör seç** to change the output location.
5. Click **İndir**. Watch the progress bar; use **İptal et** to stop.

The default output location is your Downloads folder. The app fetches yt-dlp automatically if it is not already installed, and uses ffmpeg-static if system ffmpeg is unavailable. The first launch requires internet access. Some websites may require authentication or block downloads; no download tool can guarantee all links will work. Only download media you are entitled to save.

## Develop from this fork

Prerequisites: **Node.js 20+**, npm, internet access.

Open a terminal **in the repository root**:

```sh
cd desktop
npm install
npm start
```

To check types/tests:

```sh
cd desktop
npm run typecheck
npm test
```

## Create Windows installers

On Windows:

```sh
cd desktop
npm install
npm run dist:win
```

The output is under `desktop/release/`: an NSIS setup installer and a portable executable. Builds must run on Windows for best results; there is also a GitHub Actions workflow for this.

### Important notes

- This is a real Electron desktop app, **not** a website.
- It reuses `src/lib/ytdlp.ts` and `src/lib/format.ts` from the existing yoinks repository.
- Only advertised resolutions and audio track bitrates are selectable. MP3 conversion quality is limited by the source; selecting a higher target quality never improves the original recording.
- Higher-resolution video may require ffmpeg to merge audio and video.
- The GUI is currently in Turkish.
- Download interruptions or site changes can cause errors; try the latest yt-dlp version if supported links stop working.
- The original yoinks CLI works as before: from the root of the repository, run `npm install && npm run build`.


## Troubleshooting: Electron binary missing on newer Node.js versions

If `npm start` reports `Electron failed to install correctly` and
`node_modules/electron/dist` contains only `locales`, the dependency's
ZIP extraction may be failing under newer Node.js versions.

From the `desktop` directory:

```cmd
npm pkg set "overrides.yauzl=^3.3.1"
npm install
node node_modules\electron\install.js
dir node_modules\electron\dist\electron.exe
npm start
```

This repository includes the `yauzl` override for new checkouts. Existing
ZIP downloads should install/update their local dependencies with the
commands above. If the Electron executable is still missing, try Node.js 22
LTS and reinstall dependencies. Avoid `npm audit fix --force` until the
dependency changes can be reviewed.
