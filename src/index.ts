import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth'
import cvRoutes from './routes/cv'
import chatRoutes from './routes/chat'
import jobRoutes from './routes/jobs'
import pdfRoutes from './routes/pdf'
import interviewRoutes from './routes/interview'
import adminRoutes from './routes/admin'
import scraperRoutes from './routes/scraper'
import { runScraper } from './scrapers/jobScraper'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors({ origin: ['https://cvflow.onemad.uk', 'http://localhost:5173'], credentials: true }))
app.use(express.json())

app.get('/health', (_, res) => res.json({ status: 'ok' }))
app.use('/api/auth', authRoutes)
app.use('/api/cv', cvRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/scraper', scraperRoutes)
app.use('/api/jobs', jobRoutes)
app.use('/api/pdf', pdfRoutes)
app.use('/api/interview', interviewRoutes)

// Lancer le scraper au démarrage puis toutes les 6h
setTimeout(() => runScraper().catch(console.error), 5000)
setInterval(() => runScraper().catch(console.error), 6 * 60 * 60 * 1000)

app.listen(PORT, () => console.log(`🚀 CVFlow API running on port ${PORT}`))
