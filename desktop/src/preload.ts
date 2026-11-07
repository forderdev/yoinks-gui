import {contextBridge, ipcRenderer} from 'electron'

contextBridge.exposeInMainWorld('yoinks', {
  config: () => ipcRenderer.invoke('app:config'),
  folder: () => ipcRenderer.invoke('app:folder'),
  analyze: (url: string) => ipcRenderer.invoke('app:analyze', url),
  download: (options: {mode: 'video' | 'audio'; videoId: string; audioId: string}) =>
    ipcRenderer.invoke('app:download', options),
  cancel: () => ipcRenderer.invoke('app:cancel'),
  openFolder: () => ipcRenderer.invoke('app:open-folder'),
  onStatus: (callback: (status: string) => void) => {
    const listener = (_event: unknown, status: string) => callback(status)
    ipcRenderer.on('job:status', listener)
    return () => ipcRenderer.removeListener('job:status', listener)
  },
  onProgress: (callback: (progress: unknown) => void) => {
    const listener = (_event: unknown, progress: unknown) => callback(progress)
    ipcRenderer.on('job:progress', listener)
    return () => ipcRenderer.removeListener('job:progress', listener)
  },
})
