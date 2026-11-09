import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { unwrapAspNet } from './schema.mjs'
import { RowProfiler } from './structure.mjs'

// Only metadata from these four publicly visible application operations.
const TRACKED_PATHS = new Set([
  '/Monitor.aspx/VehicleListV2',
  '/Monitor.aspx/RefreshVehicle',
  '/Monitor.aspx/GetListVehicleForVideoMonitor',
  '/Monitor.aspx/GetRefreshVehicleForVideoMonitor',
])
const entries = new Map()
let browser

function addObserver(page) {
  page.on('response', async (response) => {
    try {
      const url = new URL(response.url())
      if (url.hostname !== 'quanlyxe.vn' || !TRACKED_PATHS.has(url.pathname)) return
      if (response.request().method() !== 'POST') return
      const path = url.pathname
      let entry = entries.get(path)
      if (!entry) {
        entry = { path, method: 'POST', responsesSeen: 0, statuses: [], arrays: { Vehicles: new RowProfiler(), Data: new RowProfiler(), SensorTypes: new RowProfiler() }, emptyArrayResponses: 0, errors: 0 }
        entries.set(path, entry)
      }
      entry.responsesSeen++
      if (!entry.statuses.includes(response.status())) entry.statuses.push(response.status())
      const contentLen = Number(response.headers()['content-length'] || 0)
      if (contentLen > 1_000_000) { entry.errors++; return }
      const raw = await response.text()
      if (raw.length > 1_000_000) { entry.errors++; return }
      let data
      try { data = unwrapAspNet(JSON.parse(raw)) } catch { entry.errors++; return }
      if (Array.isArray(data) && !data.length) entry.emptyArrayResponses++
      if (!data || typeof data !== 'object' || Array.isArray(data)) return
      for (const k of ['Vehicles', 'Data', 'SensorTypes']) {
        if (Array.isArray(data[k])) entry.arrays[k].add(data[k])
      }
    } catch {
      // No errors/logs from response data or request URL are printed to prevent sensitive data leakage.
    }
  })
}

try {
  browser = await chromium.launch({ headless: false, channel: 'chrome' })
  const context = await browser.newContext({ locale: 'vi-VN' }) // Ephemeral, no persistent login storage
  context.on('page', addObserver)
  const page = await context.newPage()
  console.log('Vietmap Structure Probe v3 – Chỉ phân tích kiểu chuỗi và VỊ TRÍ CỘT; không lưu giá trị dữ liệu.')
  console.log('Trong Chrome vừa mở: đăng nhập quanlyxe.vn -> Giám sát xe -> chọn xe -> chờ ít nhất 30 giây -> Giám sát Video.')
  await page.goto('https://quanlyxe.vn/', { waitUntil: 'domcontentloaded' })
  const rl = createInterface({ input: stdin, output: stdout })
  await rl.question('Đã thực hiện xong? Nhấn ENTER ở CMD để xuất báo cáo và đóng Chrome... ')
  rl.close()
  const report = {
    version: 'v3',
    inspectedAt: new Date().toISOString(),
    privacy: 'Only categorical counts and column indices; no response values, locations, license plates, usernames, URLs with query strings, headers, credentials or cookies.',
    endpoints: [...entries.values()].map((entry) => ({
      path: entry.path,
      method: entry.method,
      responsesSeen: entry.responsesSeen,
      statuses: entry.statuses,
      emptyArrayResponses: entry.emptyArrayResponses,
      parsingErrors: entry.errors,
      arrays: Object.fromEntries(Object.entries(entry.arrays).map(([k, v]) => [k, v.getSummary()])),
    })),
  }
  await mkdir('probe-output', { recursive: true })
  await writeFile('probe-output/vietmap-structure-safe.json', JSON.stringify(report, null, 2), 'utf8')
  console.log('Đã tạo: probe-output/vietmap-structure-safe.json')
  await context.close()
} catch {
  console.error('Không thể chạy trình duyệt khảo sát. Kiểm tra Chrome và các thư viện đã cài.')
  process.exitCode = 1
} finally {
  await browser?.close()
}
