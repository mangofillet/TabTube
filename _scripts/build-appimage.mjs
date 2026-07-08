// TabTube: build only the Linux AppImage (skips rpm/pacman which need tooling not
// present on Debian/Mint). Reuses the shared electron-builder config.
import { Arch, build, Platform } from 'electron-builder'
import config from './ebuilder.config.mjs'

const targets = Platform.LINUX.createTarget(['AppImage'], Arch.x64)
const output = await build({ targets, config, publish: 'never' })
console.log('ARTIFACTS:', output)
