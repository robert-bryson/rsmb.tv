import fs from 'fs-extra'
import path from 'path'

const cesiumSrc = path.resolve('node_modules/cesium/Build/Cesium')
const cesiumDest = path.resolve('public/cesium')

fs.removeSync(cesiumDest)  // clean old build
fs.copySync(cesiumSrc, cesiumDest)

console.log('✅ Copied Cesium assets to public/cesium')