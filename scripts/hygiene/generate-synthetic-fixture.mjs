#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const outputDir = join(process.cwd(), 'tests', 'fixtures', 'generated')
const outputFile = join(outputDir, 'synthetic-extended-history.json')

const baseTs = Date.parse('2024-01-01T08:00:00Z')
const records = Array.from({ length: 48 }, (_, index) => {
  const isPodcast = index % 19 === 0
  const ts = new Date(baseTs + index * 60 * 60 * 1000).toISOString()
  return {
    ts,
    platform: index % 3 === 0 ? 'ios' : index % 3 === 1 ? 'osx' : 'web_player osx',
    ms_played: 120000 + (index % 5) * 15000,
    conn_country: 'US',
    ip_addr: '0.0.0.0',
    master_metadata_track_name: isPodcast ? null : `Synthetic Track ${index % 12}`,
    master_metadata_album_artist_name: isPodcast ? null : `Synthetic Artist ${index % 8}`,
    master_metadata_album_album_name: isPodcast ? null : `Synthetic Album ${index % 4}`,
    spotify_track_uri: isPodcast ? null : `spotify:track:synthetic${index}`,
    episode_name: isPodcast ? `Synthetic Episode ${index}` : null,
    episode_show_name: isPodcast ? 'Synthetic Podcast' : null,
    spotify_episode_uri: isPodcast ? `spotify:episode:synthetic${index}` : null,
    audiobook_title: null,
    audiobook_uri: null,
    audiobook_chapter_uri: null,
    audiobook_chapter_title: null,
    reason_start: 'playbtn',
    reason_end: index % 7 === 0 ? 'fwdbtn' : 'trackdone',
    shuffle: index % 2 === 0,
    skipped: index % 7 === 0,
    offline: false,
    offline_timestamp: null,
    incognito_mode: false,
  }
})

mkdirSync(outputDir, { recursive: true })
writeFileSync(outputFile, JSON.stringify(records, null, 2), 'utf8')

console.log(`Generated synthetic fixture: ${outputFile}`)
