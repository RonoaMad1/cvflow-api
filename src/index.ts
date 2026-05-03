import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth'
import cvRoutes from './routes/cv'
import chatRoutes from './routes/chat'
import jobRoutes from './routes/jobs'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors({ origin: ['https://cvflow.onemad.uk', 'http://localhost:5173'], credentials: true }))
app.use(express.json())

app.get('/health', (_, res) => res.json({ status: 'ok' }))
app.use('/api/auth', authRoutes)
app.use('/api/cv', cvRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/jobs', jobRoutes)

app.listen(PORT, () => console.log(`🚀 CVFlow API running on port ${PORT}`))
