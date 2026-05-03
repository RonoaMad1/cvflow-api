import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { generateQuestions, evaluateAnswer } from '../controllers/interviewController'

const router = Router()
router.post('/questions', authenticate, generateQuestions)
router.post('/evaluate', authenticate, evaluateAnswer)

export default router
