
import { chromium } from 'playwright'
import * as h from './harness.mjs'
const b = await chromium.launch({ headless: true })
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.goto(process.env.XPEACH_URL, { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(11000)
const m = await import('./case-admin.mjs')
await m.run(p, [])
await b.close()
