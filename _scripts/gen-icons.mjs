// TabTube: generate all packaging icon formats from the source SVG.
//  - _icons/iconColor.png  (512 PNG — runtime window/tray + Linux)
//  - _icons/icon.ico       (Windows)
//  - _icons/iconMac.icns   (macOS)
// Run: node _scripts/gen-icons.mjs
import { writeFileSync } from 'fs'
import sharp from 'sharp'
import png2icons from 'png2icons'

const SVG = '_icons/tabtube-icon.svg'

const png512 = await sharp(SVG).resize(512, 512).png().toBuffer()
writeFileSync('_icons/iconColor.png', png512)

// png2icons builds multi-resolution .ico/.icns from a single large PNG.
const png1024 = await sharp(SVG).resize(1024, 1024).png().toBuffer()
writeFileSync('_icons/icon.ico', png2icons.createICO(png1024, png2icons.BILINEAR, 0, false))
writeFileSync('_icons/iconMac.icns', png2icons.createICNS(png1024, png2icons.BILINEAR, 0))

console.log('Generated iconColor.png, icon.ico, iconMac.icns from', SVG)
