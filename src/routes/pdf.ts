import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { generatePDF } from '../controllers/pdfController'

const router = Router()
router.post('/generate', authenticate, generatePDF)

export default router
