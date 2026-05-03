import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { analyzeJob, getJobs, updateJobStatus, deleteJob } from '../controllers/jobController'

const router = Router()
router.post('/analyze', authenticate, analyzeJob)
router.get('/', authenticate, getJobs)
router.put('/:id/status', authenticate, updateJobStatus)
router.delete('/:id', authenticate, deleteJob)

export default router
