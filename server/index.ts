import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { runMigrations } from './db.js'
import authRoutes from './routes/auth.js'
import enrichmentHandler from './routes/enrichment.js'

const app = express()
const PORT = parseInt(process.env.SERVER_PORT || '3001', 10)

app.set('trust proxy', 1)

const ALLOWED_ORIGINS = [
  `https://${process.env.REPLIT_DEV_DOMAIN}`,
  ...(process.env.REPLIT_DOMAINS?.split(',').map(d => `https://${d.trim()}`) ?? []),
  'http://localhost:5000',
].filter(Boolean)

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

app.use('/api/auth', authRoutes)

app.post('/api/spotify/enrichment/audio-features', enrichmentHandler)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

async function start() {
  try {
    await runMigrations()
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[server] API server running on port ${PORT}`)
    })
  } catch (err) {
    console.error('[server] Failed to start:', err)
    process.exit(1)
  }
}

start()
