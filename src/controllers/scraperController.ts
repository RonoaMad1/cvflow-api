import { Request, Response } from 'express'
import prisma from '../services/prisma'
import { runScraper } from '../scrapers/jobScraper'

export const getScrapedJobs = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const offset = (page - 1) * limit
    const status = req.query.status as string || ''
    const category = req.query.category as string || ''
    const source = req.query.source as string || ''
    const minScore = parseFloat(req.query.minScore as string) || 0

    let where = 'WHERE score >= ' + minScore
    if (status) where += ` AND status = '${status}'`
    if (category) where += ` AND category = '${category}'`
    if (source) where += ` AND source = '${source}'`

    const jobs = await prisma.$queryRawUnsafe(`
      SELECT id, source, url, title, company, location, salary,
             contract_type, category, score, grade, status,
             ai_analysis, scraped_at,
             LEFT(description, 200) as description_preview
      FROM "JobScrape"
      ${where}
      ORDER BY score DESC, scraped_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `) as any[]

    const total = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::INTEGER as count FROM "JobScrape" ${where}
    `) as any[]

    const stats = await prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*)::INTEGER as total,
        COUNT(CASE WHEN status = 'new' THEN 1 END)::INTEGER as new_count,
        COUNT(CASE WHEN status = 'applied' THEN 1 END)::INTEGER as applied,
        COUNT(CASE WHEN grade IN ('A','B') THEN 1 END)::INTEGER as top_jobs,
        COUNT(DISTINCT source)::INTEGER as sources,
        COUNT(DISTINCT category)::INTEGER as categories,
        ROUND(AVG(score)::numeric, 2)::float as avg_score
      FROM "JobScrape"
    `) as any[]

    res.json({ jobs, total: total[0].count, page, limit, stats: stats[0] })
  } catch (e) {
    console.error('GetScrapedJobs error:', e)
    res.status(500).json({ error: 'Erreur' })
  }
}

export const updateScrapedJobStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { status } = req.body
    await prisma.$queryRawUnsafe(
      `UPDATE "JobScrape" SET status = $1 WHERE id = $2`,
      status, parseInt(id as string)
    )
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: 'Erreur' })
  }
}

export const triggerScraper = async (req: Request, res: Response) => {
  res.json({ message: 'Scraper lancé en arrière-plan' })
  runScraper().catch(console.error)
}

export const getScrapedJobDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const job = await prisma.$queryRawUnsafe(
      `SELECT * FROM "JobScrape" WHERE id = $1`, parseInt(id as string)
    ) as any[]
    if (!job[0]) return res.status(404).json({ error: 'Non trouve' })
    res.json(job[0])
  } catch (e) {
    res.status(500).json({ error: 'Erreur' })
  }
}
