import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { runMigrations } from './db.js'
import authRoutes from './routes/auth.js'
import datasetRoutes from './routes/datasets.js'
import aggregateRoutes from './routes/aggregates.js'
import enrichmentHandler from './routes/enrichment.js'
import { runAggregationPipeline } from './aggregation.js'
import { authLimiter, uploadLimiter, apiLimiter } from './rate-limit.js'

const app = express()
const PORT = parseInt(process.env.SERVER_PORT || '3001', 10)

app.set('trust proxy', 1)

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}))

const ALLOWED_ORIGINS = [
  ...(process.env.REPLIT_DEV_DOMAIN ? [`https://${process.env.REPLIT_DEV_DOMAIN}`] : []),
  ...(process.env.REPLIT_DOMAINS?.split(',').filter(d => d.trim()).map(d => `https://${d.trim()}`) ?? []),
  'http://localhost:5000',
]

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}))

app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/datasets', apiLimiter, datasetRoutes)
app.use('/api/aggregates', apiLimiter, aggregateRoutes)

app.post('/api/spotify/enrichment/audio-features', enrichmentHandler)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

function validateEnv(): void {
  const required = ['DATABASE_URL', 'ENCRYPTION_KEY']
  const missing = required.filter((k) => !process.env[k])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
  const spotifyVars = ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET']
  const missingSpotify = spotifyVars.filter((k) => !process.env[k])
  if (missingSpotify.length > 0) {
    console.warn(`[server] WARNING: Missing Spotify credentials (${missingSpotify.join(', ')}). OAuth login will fail.`)
  }
}

const AGGREGATION_INTERVAL_MS = 60 * 60 * 1000

function startAggregationScheduler(): void {
  setTimeout(() => {
    void runAggregationPipeline().catch((err) => {
      console.error('[scheduler] Initial aggregation failed:', err)
    })
  }, 30_000)

  setInterval(() => {
    void runAggregationPipeline().catch((err) => {
      console.error('[scheduler] Scheduled aggregation failed:', err)
    })
  }, AGGREGATION_INTERVAL_MS)

  console.log('[scheduler] Aggregation scheduler started (hourly)')
}

async function start() {
  try {
    validateEnv()
    await runMigrations()
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[server] API server running on port ${PORT}`)
      startAggregationScheduler()
    })
  } catch (err) {
    console.error('[server] Failed to start:', err)
    process.exit(1)
  }
}

start()
