# TabTube — Flatpak / Flathub

These files package TabTube as a Flatpak and are the basis of a Flathub submission
(which is how it appears in GNOME Software, KDE Discover, and **Linux Mint's Software
Manager**).

- `io.github.mangofillet.TabTube.yml` — Flatpak manifest (repackages the released AppImage
  on the Electron base app).
- `io.github.mangofillet.TabTube.metainfo.xml` — AppStream metadata (store listing).
- `io.github.mangofillet.TabTube.desktop` — desktop entry.
- `icon-512.png` — app icon.

## Build & install locally

Needs `flatpak-builder` and the Electron base app:

```bash
# one-time tooling (flatpak-builder may need: sudo apt install flatpak-builder)
flatpak install -y flathub org.freedesktop.Platform//24.08 org.freedesktop.Sdk//24.08 \
  org.electronjs.Electron2.BaseApp//24.08

# build + install (run from this flathub/ directory)
flatpak-builder --user --install --force-clean build-dir io.github.mangofillet.TabTube.yml

# run it (also now appears in the Software Manager's installed apps)
flatpak run io.github.mangofillet.TabTube
```

## Submit to Flathub (appear in the store for everyone)

1. Add at least one real **screenshot** and host it (e.g. commit `screenshot-1.png` here — the
   metainfo already points at `raw.githubusercontent.com/.../flathub/screenshot-1.png`).
2. Keep the manifest's AppImage `url` + `sha256` in sync with the latest GitHub release.
3. Fork [`flathub/flathub`](https://github.com/flathub/flathub), create a branch named
   `io.github.mangofillet.TabTube`, add these files, and open a PR against the `new-pr` branch
   following <https://docs.flathub.org/docs/for-app-authors/submission>.
4. Flathub maintainers **review** it (they check licensing, the "unofficial fork" framing, the
   app-id, and metadata). Address feedback; once merged it's published and auto-updates.

> Note: Flathub prefers **build-from-source** manifests. For this pnpm/Electron app that means
> generating offline npm sources with
> [`flatpak-node-generator`](https://github.com/flatpak/flatpak-builder-tools) and building in
> the manifest. The AppImage-repackage manifest here is the pragmatic starting point and is
> accepted by reviewers for some Electron apps; be prepared to switch to a source build if asked.
