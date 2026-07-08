// TabTube — tab-bar chrome page, inlined so it can be loaded as a data: URL in the
// main process (avoids dev-mode __dirname mocking and static-copy issues). The
// `tabbar` preload exposes `window.tabBar`.

export const TAB_BAR_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>TabTube tabs</title>
  <style>
    :root {
      --bar-bg: #f1f1f1; --tab-fg: #303030; --tab-active-bg: #ffffff;
      --accent: #6200ea; --hover-bg: rgba(0,0,0,0.06); --close-hover: #e53935;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bar-bg: #202020; --tab-fg: #e8e8e8; --tab-active-bg: #303030;
        --accent: #b388ff; --hover-bg: rgba(255,255,255,0.08); --close-hover: #ef5350;
      }
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; height: 100%; overflow: hidden; }
    body {
      display: flex; align-items: stretch; gap: 2px; padding: 0 4px;
      background: var(--bar-bg); font: 13px/1 system-ui, sans-serif;
      color: var(--tab-fg); user-select: none;
    }
    #strip { display: flex; align-items: stretch; gap: 2px; flex: 1 1 auto; min-width: 0; overflow-x: auto; scrollbar-width: thin; }
    .tab {
      display: flex; align-items: center; gap: 6px; min-width: 90px; max-width: 220px;
      padding: 0 6px 0 12px; border-top: 2px solid transparent; border-radius: 6px 6px 0 0;
      opacity: 0.7; cursor: default; white-space: nowrap;
    }
    .tab:hover { opacity: 0.95; background: var(--hover-bg); }
    .tab.active { opacity: 1; background: var(--tab-active-bg); border-top-color: var(--accent); }
    .title { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; }
    .spinner {
      flex: 0 0 auto; width: 12px; height: 12px; border: 2px solid var(--accent);
      border-top-color: transparent; border-radius: 50%; animation: tt-spin 0.7s linear infinite;
    }
    @keyframes tt-spin { to { transform: rotate(360deg); } }
    .close {
      flex: 0 0 auto; width: 18px; height: 18px; border: none; border-radius: 50%;
      background: transparent; color: inherit; cursor: pointer; font-size: 15px; line-height: 1; padding: 0;
    }
    .close:hover { background: var(--close-hover); color: #fff; }
    #new {
      flex: 0 0 auto; align-self: center; width: 26px; height: 26px; border: none;
      border-radius: 6px; background: transparent; color: var(--tab-fg); cursor: pointer; font-size: 18px; line-height: 1;
    }
    #new:hover { background: var(--hover-bg); }
  </style>
</head>
<body>
  <div id="strip"></div>
  <button id="new" title="New tab (Ctrl+T)" aria-label="New tab">+</button>
  <script>
    const strip = document.getElementById('strip')
    document.getElementById('new').addEventListener('click', () => window.tabBar.newTab())
    function render(tabs) {
      strip.textContent = ''
      for (const tab of tabs) {
        const el = document.createElement('div')
        el.className = 'tab' + (tab.active ? ' active' : '')
        el.title = tab.title || ''
        if (tab.loading) {
          const spinner = document.createElement('span')
          spinner.className = 'spinner'
          el.appendChild(spinner)
        }
        const title = document.createElement('span')
        title.className = 'title'
        title.textContent = tab.loading ? 'Loading\\u2026' : (tab.title || '')
        el.appendChild(title)
        const close = document.createElement('button')
        close.className = 'close'
        close.textContent = '\\u00d7'
        close.setAttribute('aria-label', 'Close tab')
        // Handle close on mousedown + stopPropagation so it never triggers the tab's
        // own mousedown (activate), whose re-render would otherwise remove this button
        // before a click completes.
        close.addEventListener('mousedown', (e) => {
          e.stopPropagation()
          e.preventDefault()
          window.tabBar.closeTab(tab.id)
        })
        el.appendChild(close)
        el.addEventListener('mousedown', (e) => {
          if (e.button === 0) { window.tabBar.activateTab(tab.id) }
          else if (e.button === 1) { e.preventDefault(); window.tabBar.closeTab(tab.id) }
        })
        strip.appendChild(el)
      }
    }
    window.tabBar.onUpdate(render)
  </script>
</body>
</html>`
