import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
let kitchenWin: BrowserWindow | null

const kitchenOrdersFile = () => path.join(app.getPath('userData'), 'kitchen-orders.json')

function readPersistedKitchenOrders() {
  try {
    const file = kitchenOrdersFile()
    if (!fs.existsSync(file)) return null
    const orders = JSON.parse(fs.readFileSync(file, 'utf8'))
    return Array.isArray(orders) ? orders : []
  } catch {
    return []
  }
}

function writePersistedKitchenOrders(orders: unknown) {
  if (!Array.isArray(orders)) return
  const file = kitchenOrdersFile()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(orders, null, 2), 'utf8')
}

function createKitchenWindow() {
  if (kitchenWin && !kitchenWin.isDestroyed()) {
    return
  }

  kitchenWin = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'POSphere - Kitchen Display',
    backgroundColor: '#182126',
    webPreferences: { preload: path.join(__dirname, 'preload.mjs') },
  })

  kitchenWin.on('closed', () => {
    kitchenWin = null
  })

  if (VITE_DEV_SERVER_URL) kitchenWin.loadURL(`${VITE_DEV_SERVER_URL}#kitchen`)
  else kitchenWin.loadFile(path.join(RENDERER_DIST, 'index.html'), { hash: 'kitchen' })
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1120,
    minHeight: 720,
    title: 'POSphere - Point of Sale',
    backgroundColor: '#f5f7f6',
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  // Kitchen Display adalah layar operasional bersama dan selalu aktif,
  // tidak mengikuti sesi login/logout salah satu kasir.
  createKitchenWindow()

}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  ipcMain.on('kitchen-orders-read', (event) => {
    event.returnValue = readPersistedKitchenOrders()
  })
  ipcMain.on('kitchen-orders-write', (_event, orders) => {
    writePersistedKitchenOrders(orders)
    BrowserWindow.getAllWindows().forEach((window) => {
      if (!window.isDestroyed()) window.webContents.send('kitchen-orders-updated')
    })
  })
  createWindow()
})
