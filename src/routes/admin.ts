import { Router } from 'express'
import { getStats, getConversations, getConversationDetail, getSecurityStats } from '../controllers/adminController'

const router = Router()
router.get('/stats', getStats)
router.get('/conversations', getConversations)
router.get('/conversations/:id', getConversationDetail)
router.get('/security', getSecurityStats)
export default router
