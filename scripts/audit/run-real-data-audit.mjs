#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import path from 'node:path'

import JSZip from 'jszip'
import { chromium } from '@playwright/test'

const zipPath = process.env.SPOTIFY_ZIP_PATH
const baseUrl = process.env.LISTENTROPY_AUDIT_BASE_URL ?? 'http://127.0.0.1:4173'
const reportPath = path.join(process.cwd(), 'test-results', 'real-data-audit-report.json')
const contextReportPath = path.join(process.cwd(), 'test-results', 'real-data-context-report.json')

const tabExpectations = [
  {
    tab: 'Explore',
    assert: async (page) => {
      await page.getByRole('button', { name: 'Rankings' }).click()
      await page.getByPlaceholder('Search leaderboard...').waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: 'Trends' }).click()
      await page.getByRole('heading', { name: 'Listening timeline' }).waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: 'Behavior' }).click()
      await page.getByRole('heading', { name: 'Skip and shuffle trend' }).waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: 'Context' }).click()
      await page.getByRole('heading', { name: 'Context Intelligence' }).waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: 'Rhythm' }).click()
      await page.getByRole('heading', { name: 'Radial Clock' }).waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: 'Eras' }).click()
      await page.getByRole('heading', { name: 'Music Eras' }).waitFor({ state: 'visible', timeout: 30_000 })
    },
  },
  { tab: 'Taste DNA', assert: async (page) => page.getByRole('heading', { name: 'Taste DNA' }).waitFor({ state: 'visible', timeout: 30_000 }) },
  { tab: 'Share', assert: async (page) => page.getByRole('heading', { name: 'Share Studio' }).waitFor({ state: 'visible', timeout: 30_000 }) },
  {
    tab: 'Advanced',
    open: async (page) => page.getByRole('button', { name: 'Advanced' }).click(),
    assert: async (page) => {
      await page.getByRole('heading', { name: 'Advanced' }).waitFor({ state: 'visible', timeout: 30_000 })
      const sectionSelect = page.getByLabel('Advanced section')
      await sectionSelect.selectOption('artist')
      await page.getByRole('heading', { name: 'Artist Analysis' }).waitFor({ state: 'visible', timeout: 30_000 })
      await sectionSelect.selectOption('network')
      await page.getByRole('heading', { name: 'Music Universe Graph' }).waitFor({ state: 'visible', timeout: 30_000 })
      const crashCount = await page.getByText('This view crashed').count()
      if (crashCount > 0) {
        throw new Error('Universe view showed generic crash boundary text')
      }
      await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 30_000 })
    },
  },
]

function now() {
  return Date.now()
}

function isLoopbackHost(hostname) {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1' || hostname === '[::1]'
}

async function assertZipPath(filePath) {
  if (!filePath) {
    throw new Error('SPOTIFY_ZIP_PATH is required. Example: SPOTIFY_ZIP_PATH=/abs/path.zip pnpm audit:real-data')
  }

  await access(filePath, fsConstants.R_OK)
  const info = await stat(filePath)
  if (!info.isFile()) {
    throw new Error(`SPOTIFY_ZIP_PATH is not a file: ${filePath}`)
  }

  const buffer = await readFile(filePath)
  const zip = await JSZip.loadAsync(buffer)
  const historyFiles = Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .map((entry) => entry.name)
    .filter((name) => /Streaming_History_(Audio|Video)_.*\.json$/i.test(name))

  if (historyFiles.length === 0) {
    throw new Error('Zip does not contain Spotify streaming history JSON files.')
  }

  return {
    bytes: info.size,
    historyFileCount: historyFiles.length,
    historyFiles,
  }
}

async function waitForServer(url, timeoutMs = 90_000) {
  const start = now()
  let lastError = null
  while (now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET' })
      if (response.ok) {
        return
      }
      lastError = new Error(`Server responded with ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Timed out waiting for ${url}: ${String(lastError)}`)
}

function startPreviewServer() {
  const child = spawn('pnpm', ['preview', '--host', '--port', '4173', '--strictPort'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  })

  const output = []
  child.stdout.on('data', (chunk) => output.push(chunk.toString()))
  child.stderr.on('data', (chunk) => output.push(chunk.toString()))

  return {
    child,
    getOutput: () => output.join(''),
  }
}

async function stopPreviewServer(child) {
  if (!child || child.killed) {
    return
  }
  child.kill('SIGTERM')
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolve()
    }, 5_000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

async function writeReport(report) {
  await mkdir(path.dirname(reportPath), { recursive: true })
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8')
}

async function writeContextReport(report) {
  await mkdir(path.dirname(contextReportPath), { recursive: true })
  await writeFile(contextReportPath, JSON.stringify(report, null, 2), 'utf8')
}

function toBase64Url(value) {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function runAudit() {
  const report = {
    generatedAt: new Date().toISOString(),
    zipPath,
    checks: {
      zipValidated: false,
      uploadParsed: false,
      tabsRendered: false,
      contextRendered: false,
      weeklyTimelineSane: false,
      timezoneToggleWorks: false,
      noRemoteNetworkDependencies: false,
      shareRouteRendered: false,
      sharePresetFlows: false,
      shareV2BackwardCompatible: false,
      invalidShareHandled: false,
      universeStable: false,
    },
    timingsMs: {},
    console: {
      errors: [],
      warnings: [],
      pageErrors: [],
    },
    network: {
      totalRequests: 0,
      remoteHttpRequestCount: 0,
      remoteRequests: [],
    },
    context: {
      weeklyLabelCount: 0,
      weeklyLabelsSample: [],
      weeklyMaxObserved: 0,
      contextTopCountriesVisible: false,
    },
    status: 'fail',
  }

  const validation = await assertZipPath(zipPath)
  report.zip = validation
  report.checks.zipValidated = true

  const preview = startPreviewServer()
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  const baseOrigin = new URL(baseUrl).origin
  const baseParsed = new URL(baseUrl)

  page.on('console', (message) => {
    const text = message.text()
    const type = message.type()
    if (type === 'error') {
      report.console.errors.push(text)
    }
    if (type === 'warning') {
      report.console.warnings.push(text)
    }
  })

  page.on('pageerror', (error) => {
    report.console.pageErrors.push(error.message)
  })

  page.on('request', (request) => {
    report.network.totalRequests += 1
    let parsedUrl
    try {
      parsedUrl = new URL(request.url())
    } catch {
      return
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return
    }
    if (parsedUrl.origin === baseOrigin) {
      return
    }
    if (
      isLoopbackHost(parsedUrl.hostname) &&
      isLoopbackHost(baseParsed.hostname) &&
      parsedUrl.port === baseParsed.port
    ) {
      return
    }
    report.network.remoteHttpRequestCount += 1
    if (report.network.remoteRequests.length < 20) {
      report.network.remoteRequests.push({
        url: request.url(),
        resourceType: request.resourceType(),
        method: request.method(),
      })
    }
  })

  const startedAt = now()

  try {
    const serverStartAt = now()
    await waitForServer(baseUrl)
    report.timingsMs.serverStartup = now() - serverStartAt

    const uploadStartAt = now()
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
    await page.locator('input[type="file"]').setInputFiles(zipPath)
    await page.getByRole('tab', { name: 'Overview' }).waitFor({ state: 'visible', timeout: 180_000 })
    const unlockFull = page.getByRole('button', { name: 'Unlock Full Analytics' })
    if ((await unlockFull.count()) > 0) {
      await unlockFull.click()
    }
    report.timingsMs.uploadAndParse = now() - uploadStartAt
    report.checks.uploadParsed = true

    const tabsStartAt = now()
    for (const item of tabExpectations) {
      if (item.open) {
        await item.open(page)
      } else {
        await page.getByRole('tab', { name: item.tab }).click()
      }
      await item.assert(page)
      if (item.tab === 'Advanced') {
        report.checks.universeStable = true
      }
      if (item.tab === 'Explore') {
        report.checks.contextRendered = true
        report.context.contextTopCountriesVisible = await page.getByText('Country footprint').first().isVisible()
      }
    }
    report.timingsMs.tabTraversal = now() - tabsStartAt
    report.checks.tabsRendered = true

    const weeklyStartAt = now()
    await page.getByRole('tab', { name: 'Explore' }).click()
    await page.getByRole('button', { name: 'Trends' }).click()
    await page
      .locator('main select')
      .filter({ has: page.locator('option[value="weekly"]') })
      .first()
      .selectOption('weekly')
    const timelineLabels = await page.locator('svg text').allTextContents()
    const weeklyLabels = timelineLabels.filter((value) => /^\d{4}-W\d{2}$/.test(value.trim()))
    const weeks = weeklyLabels.map((value) => Number(value.split('-W')[1] ?? '0')).filter((value) => Number.isFinite(value))
    const maxWeek = weeks.length > 0 ? Math.max(...weeks) : 0
    report.context.weeklyLabelCount = weeklyLabels.length
    report.context.weeklyLabelsSample = weeklyLabels.slice(0, 16)
    report.context.weeklyMaxObserved = maxWeek
    report.timingsMs.weeklyTimeline = now() - weeklyStartAt
    if (weeklyLabels.length > 10 && maxWeek > 6) {
      report.checks.weeklyTimelineSane = true
    } else {
      throw new Error(`Weekly timeline sanity check failed (labels=${weeklyLabels.length}, maxWeek=${maxWeek})`)
    }

    const timezoneStartAt = now()
    const timezoneSelect = page.getByLabel('Select timezone mode')
    await timezoneSelect.selectOption('utc')
    await page.getByText('(UTC)').first().waitFor({ state: 'visible', timeout: 30_000 })
    await timezoneSelect.selectOption('local')
    await page.getByText('(local time)').first().waitFor({ state: 'visible', timeout: 30_000 })
    report.timingsMs.timezoneToggle = now() - timezoneStartAt
    report.checks.timezoneToggleWorks = true

    if (report.network.remoteHttpRequestCount === 0) {
      report.checks.noRemoteNetworkDependencies = true
    } else {
      throw new Error(
        `Unexpected remote HTTP(S) requests detected during audit (${report.network.remoteHttpRequestCount})`,
      )
    }

    const shareStartAt = now()
    await page.getByRole('tab', { name: 'Share' }).click()
    await page.getByRole('button', { name: 'Headline Stats' }).click()
    await page.getByRole('button', { name: 'Anonymous Highlights' }).click()
    const shareLink = await page.locator('code').first().innerText()
    if (!shareLink.includes('/share#')) {
      throw new Error('Share link did not include /share# payload hash')
    }
    await page.goto(shareLink, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Shared Listening Snapshot' }).waitFor({ state: 'visible', timeout: 30_000 })
    await page.getByText(/payload v4/i).waitFor({ state: 'visible', timeout: 30_000 })
    report.timingsMs.shareRoute = now() - shareStartAt
    report.checks.shareRouteRendered = true
    report.checks.sharePresetFlows = true

    const v2Payload = {
      version: 2,
      privacyLevel: 'aggregate',
      checksum: 'legacy-v2-audit',
      includeName: false,
      anonymize: false,
      generatedAt: '2026-01-01T00:00:00.000Z',
      timezoneMode: 'utc',
      totalHours: 100,
      totalPlays: 1000,
      uniqueArtists: 50,
      uniqueTracks: 100,
      dateRange: ['2011', '2026'],
      topArtists: [['Artist A', 100]],
      topTracks: [['Track A', 'Artist A', 100]],
      archetype: 'Night Owl',
      archetypes: ['Night Owl'],
      peakHour: 23,
      skipRate: 0.2,
      shuffleRate: 0.5,
      longestStreak: 11,
      tasteDimensions: [0.2, 0.5, 0.8],
    }
    const v2Hash = toBase64Url(JSON.stringify(v2Payload))
    await page.goto(`${baseUrl}/share#${v2Hash}`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Shared Listening Snapshot' }).waitFor({ state: 'visible', timeout: 30_000 })
    report.checks.shareV2BackwardCompatible = true

    const invalidShareStartAt = now()
    await page.goto(`${baseUrl}/share#not-valid-payload`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Invalid Share Link' }).waitFor({ state: 'visible', timeout: 30_000 })
    report.timingsMs.invalidShare = now() - invalidShareStartAt
    report.checks.invalidShareHandled = true

    report.timingsMs.total = now() - startedAt

    const hasConsoleNoise =
      report.console.errors.length > 0 ||
      report.console.warnings.length > 0 ||
      report.console.pageErrors.length > 0

    report.status = Object.values(report.checks).every(Boolean) && !hasConsoleNoise ? 'pass' : 'fail'

    await writeReport(report)
    await writeContextReport({
      generatedAt: report.generatedAt,
      zipPath: report.zipPath,
      status: report.status,
      checks: {
        contextRendered: report.checks.contextRendered,
        weeklyTimelineSane: report.checks.weeklyTimelineSane,
        timezoneToggleWorks: report.checks.timezoneToggleWorks,
        noRemoteNetworkDependencies: report.checks.noRemoteNetworkDependencies,
        sharePresetFlows: report.checks.sharePresetFlows,
        shareV2BackwardCompatible: report.checks.shareV2BackwardCompatible,
      },
      context: report.context,
      timingsMs: {
        weeklyTimeline: report.timingsMs.weeklyTimeline ?? null,
        timezoneToggle: report.timingsMs.timezoneToggle ?? null,
        tabTraversal: report.timingsMs.tabTraversal ?? null,
      },
      network: {
        remoteHttpRequestCount: report.network.remoteHttpRequestCount,
        remoteRequests: report.network.remoteRequests,
      },
    })

    if (report.status !== 'pass') {
      throw new Error(`Real-data audit failed. Report written to ${reportPath}`)
    }

    console.log(`Real-data audit passed. Report: ${reportPath}`)
  } finally {
    await browser.close()
    await stopPreviewServer(preview.child)
    if (report.status !== 'pass') {
      await writeReport(report)
      await writeContextReport({
        generatedAt: report.generatedAt,
        zipPath: report.zipPath,
        status: report.status,
        checks: {
          contextRendered: report.checks.contextRendered,
          weeklyTimelineSane: report.checks.weeklyTimelineSane,
          timezoneToggleWorks: report.checks.timezoneToggleWorks,
          noRemoteNetworkDependencies: report.checks.noRemoteNetworkDependencies,
          sharePresetFlows: report.checks.sharePresetFlows,
          shareV2BackwardCompatible: report.checks.shareV2BackwardCompatible,
        },
        context: report.context,
        timingsMs: {
          weeklyTimeline: report.timingsMs.weeklyTimeline ?? null,
          timezoneToggle: report.timingsMs.timezoneToggle ?? null,
          tabTraversal: report.timingsMs.tabTraversal ?? null,
        },
        network: {
          remoteHttpRequestCount: report.network.remoteHttpRequestCount,
          remoteRequests: report.network.remoteRequests,
        },
      })
      if (preview.getOutput().trim()) {
        console.error('\nPreview server output:\n')
        console.error(preview.getOutput())
      }
      console.error(`Audit report: ${reportPath}`)
      console.error(`Context report: ${contextReportPath}`)
    }
  }
}

runAudit().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
