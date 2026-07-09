import { contextBridge, ipcRenderer } from 'electron'

// TabTube — preload for the tab-bar chrome page. Exposes a tiny, safe API the chrome
// uses to drive the main-process TabManager and to receive tab-list updates.
contextBridge.exposeInMainWorld('tabBar', {
  onUpdate: (callback) => {
    ipcRenderer.on('tabbar:update', (_event, tabs) => callback(tabs))
  },
  newTab: () => ipcRenderer.send('tabbar:action', { type: 'new' }),
  closeTab: (id) => ipcRenderer.send('tabbar:action', { type: 'close', id }),
  activateTab: (id) => ipcRenderer.send('tabbar:action', { type: 'activate', id }),
  reloadTab: (id) => ipcRenderer.send('tabbar:action', { type: 'reload', id })
})
