import {app, BrowserWindow, dialog, ipcMain, shell} from 'electron'
import {randomUUID} from 'node:crypto'
import {existsSync} from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {download, ensureYtDlp, findFfmpeg, probe, type VideoInfo} from '../../src/lib/ytdlp.js'
import {audioOptions, downloadChoice, videoOptions} from './options.js'

const root = path.dirname(fileURLToPath(import.meta.url))
let window: BrowserWindow | undefined
let controller: AbortController | undefined
let stage: 'idle' | 'analyzing' | 'downloading' = 'idle'
let analyzed: {url: string; info: VideoInfo; infoJsonPath: string} | undefined
let ytdlp: string | undefined
let outDir = path.join(os.homedir(), 'Downloads')
let generation = 0
let lastFile: string | undefined

function emit(event: string, value: unknown) {
  if (window && !window.isDestroyed()) window.webContents.send(event, value)
}

function safeUrl(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length > 4096) throw new Error('Geçerli bir bağlantı girin.')
  let parsed: URL
  try { parsed = new URL(raw.trim()) } catch { throw new Error('Geçerli bir bağlantı girin.') }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Yalnızca HTTP/HTTPS bağlantıları desteklenir.')
  return parsed.toString()
}

function safeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError' || /abort|cancelled/i.test(error.message)) return 'İşlem iptal edildi.'
    return error.message
  }
  return String(error)
}

function resetJob() {
  controller?.abort()
  controller = undefined
  stage = 'idle'
  generation++
}

function createWindow() {
  window = new BrowserWindow({
    title: 'Yoinks GUI',
    width: 1000,
    height: 800,
    minWidth: 650,
    minHeight: 630,
    backgroundColor: '#0e1017',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(root, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  window.loadFile(path.join(root, '..', 'renderer', 'index.html'))
  window.webContents.setWindowOpenHandler(() => ({action: 'deny'}))
  window.on('closed', () => {
    resetJob()
    window = undefined
  })
}

app.whenReady().then(() => {
  ipcMain.handle('app:config', () => ({outDir}))
  ipcMain.handle('app:folder', async () => {
    if (!window) return {outDir}
    const result = await dialog.showOpenDialog(window, {
      title: 'İndirilecek klasörü seç',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: outDir,
    })
    if (!result.canceled && result.filePaths[0]) outDir = result.filePaths[0]
    return {outDir}
  })
  ipcMain.handle('app:analyze', async (_event, raw: unknown) => {
    if (stage !== 'idle') throw new Error('Önce mevcut işlemi durdurun.')
    const url = safeUrl(raw)
    stage = 'analyzing'
    const id = ++generation
    const active = new AbortController()
    controller = active
    analyzed = undefined
    try {
      emit('job:status', 'İndirme motoru hazırlanıyor…')
      ytdlp = ytdlp ?? await ensureYtDlp(message => {
        if (id === generation) emit('job:status', message)
      }, active.signal)
      if (active.signal.aborted) throw new Error('İşlem iptal edildi.')
      emit('job:status', 'Video bilgileri alınıyor…')
      const found = await probe(ytdlp, url, active.signal)
      if (active.signal.aborted || id !== generation) throw new Error('İşlem iptal edildi.')
      analyzed = {url, ...found}
      return {
        title: found.info.title,
        uploader: found.info.uploader ?? '',
        duration: found.info.duration ?? null,
        video: videoOptions(found.info),
        audio: audioOptions(found.info),
      }
    } catch (error) {
      if (id === generation) emit('job:status', safeError(error))
      throw new Error(safeError(error))
    } finally {
      if (id === generation) {
        stage = 'idle'
        controller = undefined
      }
    }
  })
  ipcMain.handle('app:download', async (_event, options: unknown) => {
    if (stage !== 'idle') throw new Error('Başka bir işlem devam ediyor.')
    if (!analyzed || !ytdlp) throw new Error('Önce bağlantıyı analiz edin.')
    if (typeof options !== 'object' || !options) throw new Error('Geçersiz indirme seçenekleri.')
    const input = options as Record<string, unknown>
    const mode = input.mode
    const videoId = input.videoId
    const audioId = input.audioId
    if ((mode !== 'video' && mode !== 'audio') || typeof videoId !== 'string' || typeof audioId !== 'string') {
      throw new Error('Geçersiz indirme seçenekleri.')
    }
    const choice = downloadChoice(analyzed.info, mode, videoId, audioId)
    await fs.mkdir(outDir, {recursive: true})
    const id = ++generation
    const active = new AbortController()
    controller = active
    stage = 'downloading'
    lastFile = undefined
    try {
      emit('job:status', 'İndirme başlatılıyor…')
      const ffmpegLocation = await findFfmpeg()
      if (active.signal.aborted) throw new Error('İşlem iptal edildi.')
      const opts = {ytdlp, ffmpegLocation, url: analyzed.url, choice, outDir}
      const handlers = {
        onProgress: (p: unknown) => {if (id === generation) emit('job:progress', p)},
        onProcessing: () => {if (id === generation) emit('job:status', 'Dosya birleştiriliyor / dönüştürülüyor…')},
      }
      let filepath: string
      try {
        filepath = await download({...opts, infoJsonPath: analyzed.infoJsonPath}, handlers, active.signal)
      } catch (error) {
        if (active.signal.aborted) throw error
        emit('job:status', 'Bağlantı yenilenerek tekrar deneniyor…')
        filepath = await download(opts, handlers, active.signal)
      }
      if (id !== generation || active.signal.aborted) throw new Error('İşlem iptal edildi.')
      lastFile = filepath
      emit('job:status', 'İndirme tamamlandı.')
      return {filepath}
    } catch (error) {
      throw new Error(safeError(error))
    } finally {
      if (id === generation) {
        controller = undefined
        stage = 'idle'
      }
    }
  })
  ipcMain.handle('app:cancel', () => {
    resetJob()
    emit('job:status', 'İşlem iptal edildi.')
    return {cancelled: true}
  })
  ipcMain.handle('app:open-folder', async () => {
    if (lastFile && existsSync(lastFile)) shell.showItemInFolder(lastFile)
    else await shell.openPath(outDir)
  })
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
app.on('window-all-closed', () => {
  resetJob()
  if (process.platform !== 'darwin') app.quit()
})
