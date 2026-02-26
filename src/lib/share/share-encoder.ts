import { z } from 'zod'

import { SHARE_CARD_NAMES } from '@/lib/constants'
import type { SharePayload, SharePayloadV1, SharePayloadV2, SharePayloadV3, SharePayloadV4 } from '@/lib/types'

const sharePayloadV1Schema = z.object({
  version: z.literal(1),
  privacyLevel: z.union([z.literal('aggregate'), z.literal('profiled')]),
  checksum: z.string().min(1),
  name: z.string().optional(),
  includeName: z.boolean(),
  totalHours: z.number(),
  totalPlays: z.number(),
  uniqueArtists: z.number(),
  uniqueTracks: z.number(),
  dateRange: z.tuple([z.string(), z.string()]),
  topArtists: z.array(z.tuple([z.string(), z.number()])),
  topTracks: z.array(z.tuple([z.string(), z.string(), z.number()])),
  archetype: z.string(),
  peakHour: z.number(),
  skipRate: z.number(),
  shuffleRate: z.number(),
  longestStreak: z.number(),
  tasteDimensions: z.array(z.number()),
})

const sharePayloadV2Schema = z.object({
  version: z.literal(2),
  privacyLevel: z.union([z.literal('aggregate'), z.literal('profiled')]),
  checksum: z.string().min(1),
  name: z.string().optional(),
  includeName: z.boolean(),
  anonymize: z.boolean(),
  generatedAt: z.string(),
  timezoneMode: z.union([z.literal('local'), z.literal('utc')]).optional(),
  totalHours: z.number(),
  totalPlays: z.number(),
  uniqueArtists: z.number(),
  uniqueTracks: z.number(),
  dateRange: z.tuple([z.string(), z.string()]),
  topArtists: z.array(z.tuple([z.string(), z.number()])),
  topTracks: z.array(z.tuple([z.string(), z.string(), z.number()])),
  archetype: z.string(),
  archetypes: z.array(z.string()),
  peakHour: z.number(),
  skipRate: z.number(),
  shuffleRate: z.number(),
  longestStreak: z.number(),
  tasteDimensions: z.array(z.number()),
})

const sharePayloadContextSchema = z.object({
  homeCountry: z.string().nullable(),
  domesticShare: z.number(),
  travelShare: z.number(),
  topReasons: z.array(z.tuple([z.string(), z.number()])),
  offlineRate: z.number(),
  incognitoRate: z.number(),
  topDeviceTransition: z
    .tuple([
      z.string(),
      z.string(),
      z.number(),
    ])
    .optional(),
})

const sharePayloadV3Schema = z.object({
  version: z.literal(3),
  privacyLevel: z.union([z.literal('aggregate'), z.literal('profiled')]),
  checksum: z.string().min(1),
  name: z.string().optional(),
  includeName: z.boolean(),
  anonymize: z.boolean(),
  generatedAt: z.string(),
  timezoneMode: z.union([z.literal('local'), z.literal('utc')]),
  totalHours: z.number(),
  totalPlays: z.number(),
  uniqueArtists: z.number(),
  uniqueTracks: z.number(),
  dateRange: z.tuple([z.string(), z.string()]),
  topArtists: z.array(z.tuple([z.string(), z.number()])),
  topTracks: z.array(z.tuple([z.string(), z.string(), z.number()])),
  archetype: z.string(),
  archetypes: z.array(z.string()),
  peakHour: z.number(),
  skipRate: z.number(),
  shuffleRate: z.number(),
  longestStreak: z.number(),
  tasteDimensions: z.array(z.number()),
  context: sharePayloadContextSchema,
})

const sharePayloadV4Schema = z.object({
  version: z.literal(4),
  privacyLevel: z.union([z.literal('aggregate'), z.literal('profiled')]),
  checksum: z.string().min(1),
  name: z.string().optional(),
  includeName: z.boolean(),
  anonymize: z.boolean(),
  generatedAt: z.string(),
  timezoneMode: z.union([z.literal('local'), z.literal('utc')]),
  totalHours: z.number(),
  totalPlays: z.number(),
  uniqueArtists: z.number(),
  uniqueTracks: z.number(),
  dateRange: z.tuple([z.string(), z.string()]),
  topArtists: z.array(z.tuple([z.string(), z.number()])),
  topTracks: z.array(z.tuple([z.string(), z.string(), z.number()])),
  archetype: z.string(),
  archetypes: z.array(z.string()),
  peakHour: z.number(),
  skipRate: z.number(),
  shuffleRate: z.number(),
  longestStreak: z.number(),
  tasteDimensions: z.array(z.number()),
  context: sharePayloadContextSchema,
  selectedCards: z.array(z.string()).min(1),
  sharePreset: z.union([z.literal('headline-stats'), z.literal('detailed-stats'), z.literal('anonymous-highlights')]),
  themeKey: z.union([
    z.literal('spotify-dark'),
    z.literal('editorial-light'),
    z.literal('brutalist'),
    z.literal('midnight'),
  ]),
})

const sharePayloadSchema = z.union([sharePayloadV1Schema, sharePayloadV2Schema, sharePayloadV3Schema, sharePayloadV4Schema])

const utf8Encoder = new TextEncoder()
const utf8Decoder = new TextDecoder('utf-8', { fatal: true })

function bytesToBinaryString(bytes: Uint8Array): string {
  let result = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    result += String.fromCharCode(...chunk)
  }
  return result
}

function binaryStringToBytes(binary: string): Uint8Array {
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function toBase64Url(value: string): string {
  const bytes = utf8Encoder.encode(value)
  const base64 = typeof Buffer !== 'undefined'
    ? Buffer.from(bytes).toString('base64')
    : btoa(bytesToBinaryString(bytes))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4
  const padded = padding > 0 ? normalized.padEnd(normalized.length + (4 - padding), '=') : normalized
  const bytes = typeof Buffer !== 'undefined'
    ? Uint8Array.from(Buffer.from(padded, 'base64'))
    : binaryStringToBytes(atob(padded))

  try {
    return utf8Decoder.decode(bytes)
  } catch {
    // Backward compatibility: pre-hardening links used btoa/atob over raw JS strings (latin1 semantics).
    return bytesToBinaryString(bytes)
  }
}

// Advisory only: this legacy checksum is a lightweight fingerprint for accidental corruption/debugging.
// It is not cryptographic integrity and is intentionally not enforced on decode for backwards compatibility.
function computeAdvisoryChecksum(payload: Omit<SharePayload, 'checksum'>): string {
  const value = JSON.stringify(payload)
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return `v${payload.version}-${Math.abs(hash)}`
}

function stripChecksum<T extends SharePayload>(payload: T): Omit<T, 'checksum'> {
  return {
    ...payload,
    checksum: undefined,
  } as unknown as Omit<T, 'checksum'>
}

function upgradeV1(payload: SharePayloadV1): SharePayloadV2 {
  return {
    version: 2,
    privacyLevel: payload.privacyLevel,
    checksum: payload.checksum,
    name: payload.name,
    includeName: payload.includeName,
    anonymize: false,
    generatedAt: new Date().toISOString(),
    totalHours: payload.totalHours,
    totalPlays: payload.totalPlays,
    uniqueArtists: payload.uniqueArtists,
    uniqueTracks: payload.uniqueTracks,
    dateRange: payload.dateRange,
    topArtists: payload.topArtists,
    topTracks: payload.topTracks,
    archetype: payload.archetype,
    archetypes: [payload.archetype],
    peakHour: payload.peakHour,
    skipRate: payload.skipRate,
    shuffleRate: payload.shuffleRate,
    longestStreak: payload.longestStreak,
    tasteDimensions: payload.tasteDimensions,
  }
}

function upgradeV1ToV3(payload: SharePayloadV1): SharePayloadV3 {
  return {
    ...upgradeV1(payload),
    version: 3,
    timezoneMode: 'local',
    context: {
      homeCountry: null,
      domesticShare: 0,
      travelShare: 0,
      topReasons: [],
      offlineRate: 0,
      incognitoRate: 0,
    },
  }
}

function upgradeV2ToV3(payload: SharePayloadV2): SharePayloadV3 {
  return {
    ...payload,
    version: 3,
    timezoneMode: payload.timezoneMode ?? 'local',
    context: {
      homeCountry: null,
      domesticShare: 0,
      travelShare: 0,
      topReasons: [],
      offlineRate: 0,
      incognitoRate: 0,
    },
  }
}

function upgradeV3ToV4(payload: SharePayloadV3): SharePayloadV4 {
  return {
    ...payload,
    version: 4,
    selectedCards: [...SHARE_CARD_NAMES],
    sharePreset: 'detailed-stats',
    themeKey: 'spotify-dark',
  }
}

function upgradeV2ToV4(payload: SharePayloadV2): SharePayloadV4 {
  return upgradeV3ToV4(upgradeV2ToV3(payload))
}

function upgradeV1ToV4(payload: SharePayloadV1): SharePayloadV4 {
  return upgradeV3ToV4(upgradeV1ToV3(payload))
}

export function encodeSharePayload<T extends SharePayload>(input: T): string {
  const payloadWithoutChecksum = stripChecksum(input)
  const payload: T = {
    ...input,
    checksum: input.checksum === 'pending'
      ? computeAdvisoryChecksum(payloadWithoutChecksum as Omit<SharePayload, 'checksum'>)
      : input.checksum,
  }
  const parsed = sharePayloadSchema.parse(payload)
  return toBase64Url(JSON.stringify(parsed))
}

export function decodeSharePayload(encoded: string): SharePayload {
  try {
    const decoded = fromBase64Url(encoded)
    const parsed = JSON.parse(decoded)
    return sharePayloadSchema.parse(parsed)
  } catch (error) {
    throw new Error(`Invalid share payload: ${(error as Error).message}`)
  }
}

export function decodeSharePayloadV2(encoded: string): SharePayloadV2 {
  const decoded = decodeSharePayload(encoded)
  if (decoded.version === 2) {
    return decoded
  }
  if (decoded.version === 1) {
    return upgradeV1(decoded)
  }
  if (decoded.version === 4) {
    return {
      version: 2,
      privacyLevel: decoded.privacyLevel,
      checksum: decoded.checksum,
      name: decoded.name,
      includeName: decoded.includeName,
      anonymize: decoded.anonymize,
      generatedAt: decoded.generatedAt,
      timezoneMode: decoded.timezoneMode,
      totalHours: decoded.totalHours,
      totalPlays: decoded.totalPlays,
      uniqueArtists: decoded.uniqueArtists,
      uniqueTracks: decoded.uniqueTracks,
      dateRange: decoded.dateRange,
      topArtists: decoded.topArtists,
      topTracks: decoded.topTracks,
      archetype: decoded.archetype,
      archetypes: decoded.archetypes,
      peakHour: decoded.peakHour,
      skipRate: decoded.skipRate,
      shuffleRate: decoded.shuffleRate,
      longestStreak: decoded.longestStreak,
      tasteDimensions: decoded.tasteDimensions,
    }
  }
  return {
    version: 2,
    privacyLevel: decoded.privacyLevel,
    checksum: decoded.checksum,
    name: decoded.name,
    includeName: decoded.includeName,
    anonymize: decoded.anonymize,
    generatedAt: decoded.generatedAt,
    timezoneMode: decoded.timezoneMode,
    totalHours: decoded.totalHours,
    totalPlays: decoded.totalPlays,
    uniqueArtists: decoded.uniqueArtists,
    uniqueTracks: decoded.uniqueTracks,
    dateRange: decoded.dateRange,
    topArtists: decoded.topArtists,
    topTracks: decoded.topTracks,
    archetype: decoded.archetype,
    archetypes: decoded.archetypes,
    peakHour: decoded.peakHour,
    skipRate: decoded.skipRate,
    shuffleRate: decoded.shuffleRate,
    longestStreak: decoded.longestStreak,
    tasteDimensions: decoded.tasteDimensions,
  }
}

export function decodeSharePayloadV3(encoded: string): SharePayloadV3 {
  const decoded = decodeSharePayload(encoded)
  if (decoded.version === 4) {
    const { selectedCards: _selectedCards, sharePreset: _sharePreset, themeKey: _themeKey, ...rest } = decoded
    void _selectedCards
    void _sharePreset
    void _themeKey
    return {
      ...rest,
      version: 3,
    }
  }
  if (decoded.version === 3) {
    return decoded
  }
  if (decoded.version === 2) {
    return upgradeV2ToV3(decoded)
  }
  return upgradeV1ToV3(decoded)
}

export function decodeSharePayloadV4(encoded: string): SharePayloadV4 {
  const decoded = decodeSharePayload(encoded)
  if (decoded.version === 4) {
    return decoded
  }
  if (decoded.version === 3) {
    return upgradeV3ToV4(decoded)
  }
  if (decoded.version === 2) {
    return upgradeV2ToV4(decoded)
  }
  return upgradeV1ToV4(decoded)
}

export function safeDecodeSharePayload(encoded?: string): SharePayloadV4 | null {
  if (!encoded) {
    return null
  }
  try {
    return decodeSharePayloadV4(encoded)
  } catch {
    return null
  }
}

export function safeDecodeSharePayloadV3(encoded?: string): SharePayloadV3 | null {
  if (!encoded) {
    return null
  }
  try {
    return decodeSharePayloadV3(encoded)
  } catch {
    return null
  }
}

export function safeDecodeSharePayloadV4(encoded?: string): SharePayloadV4 | null {
  if (!encoded) {
    return null
  }
  try {
    return decodeSharePayloadV4(encoded)
  } catch {
    return null
  }
}
