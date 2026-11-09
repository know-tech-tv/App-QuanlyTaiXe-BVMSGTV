import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { unwrapAspNet } from './schema.mjs'
import { FieldProfiler } from './mapping.mjs'

const tracked = new Set([
  '/Monitor.aspx/VehicleListV2',
  '/Monitor.aspx/RefreshVehicle',
  '/Monitor.aspx/GetListVehicleForVideoMonitor',
  '/Monitor.aspx/GetRefreshVehicleForVideoMonitor'
])
const entries=new Map()
let browser
function observe(page) {
  page.on('response',async (response)=>{
    try {
      const url=new URL(response.url())
      if (url.hostname!=='quanlyxe.vn'||!tracked.has(url.pathname)||response.request().method()!=='POST') return
      const length=Number(response.headers()['content-length']||0)
      if (length>1_000_000) return
      const raw=await response.text()
      if(raw.length>1_000_000) return
      const data=unwrapAspNet(JSON.parse(raw))
      if(!data||typeof data!=='object'||Array.isArray(data)) return
      const entry=entries.get(url.pathname) ?? {endpoint:url.pathname,responseCount:0,arrays:{Vehicles:new FieldProfiler(),Data:new FieldProfiler()}}
      entry.responseCount++
      for(const key of ['Vehicles','Data']) if(Array.isArray(data[key])) entry.arrays[key].add(data[key])
      entries.set(url.pathname,entry)
    } catch { /* Never log URL parameters, responses, requests or credentials. */ }
  })
}
try {
  browser=await chromium.launch({channel:'chrome',headless:false})
  const context=await browser.newContext({locale:'vi-VN'})
  context.on('page',observe)
  const page=await context.newPage()
  console.log('Vietmap Field Map Probe v4 — Only field categories/counts and column indexes are saved.')
  console.log('Dang nhap tren Chrome, mo Giam sat xe, chon xe, cho 30-60 giay.')
  await page.goto('https://quanlyxe.vn/',{waitUntil:'domcontentloaded'})
  const rl=createInterface({input:stdin,output:stdout})
  await rl.question('Nhan ENTER sau khi theo doi GPS... ')
  rl.close()
  const report={version:'v4',inspectedAt:new Date().toISOString(),privacy:'Only fixed semantic labels, structural counts, and zero-based indexes. No source values, real GPS, plates, usernames, cookies, passwords, headers, response bodies, authorization details, or URL query parameters.',endpoints:[...entries.values()].map(e=>({endpoint:e.endpoint,responseCount:e.responseCount,arrays:Object.fromEntries(Object.entries(e.arrays).map(([k,v])=>[k,v.summary()]))}))}
  await mkdir('probe-output',{recursive:true})
  await writeFile('probe-output/vietmap-field-map-safe.json',JSON.stringify(report,null,2),'utf8')
  console.log('Da tao: probe-output/vietmap-field-map-safe.json')
  await context.close()
} catch {console.error('Khong chay duoc Chrome; kiem tra package va trinh duyet.');process.exitCode=1}
finally {await browser?.close()}
