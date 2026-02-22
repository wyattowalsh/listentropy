#!/usr/bin/env node
import { copyFile, mkdir, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { constants as fsConstants } from 'node:fs'

const distDir = path.join(process.cwd(), 'dist')
const indexHtml = path.join(distDir, 'index.html')
const fallbackHtml = path.join(distDir, '404.html')
const noJekyll = path.join(distDir, '.nojekyll')

async function main() {
  await mkdir(distDir, { recursive: true })
  await access(indexHtml, fsConstants.R_OK)
  await copyFile(indexHtml, fallbackHtml)
  await writeFile(noJekyll, '', 'utf8')
  console.log(`Prepared GitHub Pages fallback: ${path.relative(process.cwd(), fallbackHtml)}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
