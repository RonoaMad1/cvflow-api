import { Router } from 'express'
import { getScrapedJobs, updateScrapedJobStatus, triggerScraper, getScrapedJobDetail } from '../controllers/scraperController'
const router = Router()
router.get('/', getScrapedJobs)
router.get('/:id', getScrapedJobDetail)
router.put('/:id/status', updateScrapedJobStatus)
router.post('/trigger', triggerScraper)
export default router
