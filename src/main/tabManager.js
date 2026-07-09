import { WebContentsView } from 'electron'

// TabTube — main-process tab manager.
//
// Each tab is its own WebContentsView (a full, independent renderer running the app),
// all parented to one BrowserWindow. The window's own webContents renders the tab-bar
// chrome as a fixed strip along the top; the active tab's view fills the area below it.
// Inactive views stay alive (the window is created with backgroundThrottling disabled),
// so a video in a background tab keeps playing and never loses its place.

export const TAB_BAR_HEIGHT = 40

export class TabManager {
  /**
   * @param {import('electron').BrowserWindow} window host window (its webContents = the chrome)
   * @param {object} opts
   * @param {import('electron').WebPreferences} opts.webPreferences preferences for each tab view
   * @param {string} opts.rootAppUrl default URL a tab loads
   * @param {(view: WebContentsView, tabId: string) => void} [opts.configureView] hook to wire
   *        per-view handlers (e.g. setWindowOpenHandler → newTab, IPC)
   * @param {(tabs: {id:string,title:string,active:boolean}[]) => void} [opts.onTabsChanged]
   *        called whenever the tab list/active/title changes, so the chrome can re-render
   */
  constructor(window, opts) {
    this.window = window
    this.opts = opts
    /** @type {{ id: string, view: WebContentsView, title: string }[]} */
    this.tabs = []
    this.activeId = null
    this._uid = 0
    // When a tab enters HTML fullscreen (e.g. the video player), the chrome strip
    // is hidden and the active view fills the whole window (see setChromeHidden).
    this._chromeHidden = false

    // Defer: on maximize/fullscreen the event fires before getContentSize() reflects
    // the new bounds, so lay out on the next tick (and again on the settled resize).
    const relayout = () => { setTimeout(() => this._layout(), 0) }
    window.on('resize', relayout)
    window.on('enter-full-screen', relayout)
    window.on('leave-full-screen', relayout)
    window.on('maximize', relayout)
    window.on('unmaximize', relayout)
  }

  _nextId() {
    return `tab-${Date.now().toString(36)}-${(this._uid++).toString(36)}`
  }

  activeView() {
    const tab = this.tabs.find(t => t.id === this.activeId)
    return tab ? tab.view : null
  }

  /** Broadcast a channel to every tab's renderer (used to widen window-centric IPC). */
  broadcast(channel, ...args) {
    for (const tab of this.tabs) {
      if (!tab.view.webContents.isDestroyed()) {
        tab.view.webContents.send(channel, ...args)
      }
    }
  }

  /** Reload a tab's page (e.g. an unstuck/stalled video). Defaults to the active tab. */
  reload(id = this.activeId) {
    const tab = this.tabs.find(t => t.id === id)
    if (tab && !tab.view.webContents.isDestroyed()) {
      tab.view.webContents.reload()
    }
  }

  /**
   * Open a new tab. Activates it unless `activate` is false (background open).
   * @param {string} [url]
   * @param {{ activate?: boolean }} [options]
   */
  newTab(url, { activate = true, focusSearch = false } = {}) {
    const view = new WebContentsView({ webPreferences: this.opts.webPreferences })
    const tab = { id: this._nextId(), view, title: '', loading: true }
    this.tabs.push(tab)
    this.window.contentView.addChildView(view)

    // A brand-new tab (opened via the "+" button) lands ready to type: focus the
    // search bar once the app has rendered.
    if (focusSearch) {
      view.webContents.once('did-finish-load', () => {
        view.webContents.executeJavaScript(`(function(){
          var tries = 0;
          var timer = setInterval(function(){
            var el = document.querySelector('.searchInput input, .searchContainer input, input[placeholder]');
            if (el) { el.focus(); if (el.select) { el.select(); } clearInterval(timer); }
            if (++tries > 40) { clearInterval(timer); }
          }, 100);
        })();`, true).catch(function () {})
      })
    }

    // Stay in the loading state (spinner) until the page reports its real title
    // (video/channel name), then show it directly — no "New Tab" placeholder.
    view.webContents.on('page-title-updated', (_event, title) => {
      tab.title = title
      tab.loading = false
      if (tab.id === this.activeId) { this._syncWindowTitle() }
      this._emit()
    })
    // Keep background tabs paused as the tab (re)loads.
    view.webContents.on('dom-ready', () => this._applyPlayback(tab))
    view.webContents.on('destroyed', () => this._forget(tab.id))

    this.opts.configureView?.(view, tab.id)
    view.webContents.loadURL(url || this.opts.rootAppUrl)

    if (activate) {
      this.activate(tab.id)
    } else {
      view.setVisible(false)
      this._emit()
    }
    return tab
  }

  activate(id) {
    const tab = this.tabs.find(t => t.id === id)
    if (!tab) { return }
    this.activeId = id
    this._syncWindowTitle()
    for (const t of this.tabs) {
      t.view.setVisible(t.id === id)
    }
    this._layout()
    // Bring the newly active view to the top of the z-order and focus it.
    this.window.contentView.addChildView(tab.view)
    tab.view.webContents.focus()
    // Play the now-active tab; pause all the others.
    for (const t of this.tabs) { this._applyPlayback(t) }
    this._emit()
  }

  // Ensure only the active tab's video plays. Injects a small guard so a background
  // tab's player can't autoplay; the video starts only once the tab is activated.
  _applyPlayback(tab) {
    const wc = tab.view.webContents
    if (wc.isDestroyed()) { return }
    const active = tab.id === this.activeId
    wc.executeJavaScript(`(function(){
      window.__ttActive = ${active};
      if (!window.__ttPlayGuard) {
        window.__ttPlayGuard = true;
        var guard = function(){
          document.querySelectorAll('video').forEach(function(v){
            if (!window.__ttActive && !v.paused) { try { v.pause(); } catch (e) {} }
          });
        };
        document.addEventListener('play', guard, true);
        setInterval(guard, 400);
      }
      if (window.__ttActive) {
        var v = document.querySelector('video');
        if (v && v.paused) { var p = v.play(); if (p && p.catch) { p.catch(function(){}); } }
      } else {
        document.querySelectorAll('video').forEach(function(v){ try { v.pause(); } catch (e) {} });
      }
    })();`, true).catch(function () {})
  }

  closeTab(id) {
    const idx = this.tabs.findIndex(t => t.id === id)
    if (idx === -1) { return }
    const [tab] = this.tabs.splice(idx, 1)
    this.window.contentView.removeChildView(tab.view)
    if (!tab.view.webContents.isDestroyed()) {
      tab.view.webContents.close()
    }

    if (this.tabs.length === 0) {
      // Keep the window usable: last tab closed → open a fresh default tab.
      this.newTab(this.opts.rootAppUrl)
      return
    }
    if (this.activeId === id) {
      const neighbour = this.tabs[Math.min(idx, this.tabs.length - 1)]
      this.activate(neighbour.id)
    } else {
      this._emit()
    }
  }

  cycle(offset) {
    if (this.tabs.length < 2) { return }
    const idx = this.tabs.findIndex(t => t.id === this.activeId)
    const next = (idx + offset + this.tabs.length) % this.tabs.length
    this.activate(this.tabs[next].id)
  }

  activateIndex(index) {
    if (index >= 0 && index < this.tabs.length) {
      this.activate(this.tabs[index].id)
    }
  }

  closeActive() {
    if (this.activeId) { this.closeTab(this.activeId) }
  }

  // A view was destroyed out from under us (e.g. crash); drop it from the list.
  _forget(id) {
    const idx = this.tabs.findIndex(t => t.id === id)
    if (idx === -1) { return }
    this.tabs.splice(idx, 1)
    if (this.activeId === id && this.tabs.length > 0) {
      this.activate(this.tabs[Math.min(idx, this.tabs.length - 1)].id)
    } else {
      this._emit()
    }
  }

  _layout() {
    const [width, height] = this.window.getContentSize()
    const active = this.activeView()
    if (active) {
      // In HTML fullscreen the chrome strip is hidden, so the active view fills
      // the whole window; otherwise it sits below the fixed tab-bar strip.
      const top = this._chromeHidden ? 0 : TAB_BAR_HEIGHT
      active.setBounds({
        x: 0,
        y: top,
        width,
        height: Math.max(0, height - top)
      })
    }
  }

  /**
   * Hide/show the tab-bar chrome (used for HTML fullscreen, e.g. the video player).
   * When hidden, the active view expands to fill the whole window.
   */
  setChromeHidden(hidden) {
    this._chromeHidden = hidden
    // Defer so the layout reflects the window's settled fullscreen bounds.
    setTimeout(() => this._layout(), 0)
  }

  /** Keep the window heading in sync with the ACTIVE tab's title. */
  _syncWindowTitle() {
    if (this.window.isDestroyed()) { return }
    const tab = this.tabs.find(t => t.id === this.activeId)
    this.window.setTitle(tab && tab.title ? tab.title : 'TabTube')
  }

  _emit() {
    const list = this.tabs.map(t => ({
      id: t.id,
      title: t.title || '',
      active: t.id === this.activeId,
      loading: !!t.loading
    }))
    this.opts.onTabsChanged?.(list)
  }
}
