import { Router } from 'express'
import { getCV, updateCV, getPublicCV } from '../controllers/cvController'
import { authenticate } from '../middleware/auth'

const router = Router()
router.get('/me', authenticate, getCV)
router.put('/me', authenticate, updateCV)
router.get('/:username', getPublicCV)

export default router
