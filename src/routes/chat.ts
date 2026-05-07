import { Router } from 'express'
import { chat, reindexCV } from '../controllers/chatController'
const router = Router()
router.post('/:username', chat)
router.post('/:username/reindex', reindexCV)
export default router
