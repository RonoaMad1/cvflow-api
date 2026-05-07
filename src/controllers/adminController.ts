import { Request, Response } from 'express'
import prisma from '../services/prisma'

export const getStats = async (req: Request, res: Response) => {
  try {
    const stats = await prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*)::INTEGER as total_messages,
        COUNT(CASE WHEN is_jailbreak = true THEN 1 END)::INTEGER as jailbreak_count,
        ROUND(AVG(latency_ms))::INTEGER as avg_latency_ms,
        COUNT(DISTINCT username)::INTEGER as unique_users,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END)::INTEGER as messages_24h,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END)::INTEGER as messages_7d
      FROM "ChatLog"
    `) as any[]

    const byProvider = await prisma.$queryRawUnsafe(`
      SELECT provider, model, COUNT(*)::INTEGER as count, ROUND(AVG(latency_ms))::INTEGER as avg_latency
      FROM "ChatLog"
      WHERE provider IS NOT NULL
      GROUP BY provider, model
      ORDER BY count DESC
    `) as any[]

    const byDay = await prisma.$queryRawUnsafe(`
      SELECT
        DATE(created_at) as date,
        COUNT(*)::INTEGER as total,
        COUNT(CASE WHEN is_jailbreak = true THEN 1 END)::INTEGER as jailbreaks
      FROM "ChatLog"
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `) as any[]

    const ragStats = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::INTEGER as total_chunks, COUNT(DISTINCT cv_id)::INTEGER as indexed_cvs
      FROM "CVChunk"
    `) as any[]

    res.json({
      overview: stats[0],
      byProvider,
      byDay,
      rag: ragStats[0]
    })
  } catch (e) {
    console.error('Stats error:', e)
    res.status(500).json({ error: 'Erreur stats' })
  }
}

export const getConversations = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const offset = (page - 1) * limit
    const jailbreakOnly = req.query.jailbreak === 'true'

    const where = jailbreakOnly ? 'WHERE is_jailbreak = true' : ''

    const conversations = await prisma.$queryRawUnsafe(`
      SELECT id, username, LEFT(message, 100) as message, LEFT(response, 150) as response,
             provider, model, latency_ms, is_jailbreak, jailbreak_reason, created_at
      FROM "ChatLog"
      ${where}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `) as any[]

    const total = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count FROM "ChatLog" ${where}
    `) as any[]

    res.json({ conversations, total: parseInt(total[0].count), page, limit })
  } catch (e) {
    console.error('Conversations error:', e)
    res.status(500).json({ error: 'Erreur conversations' })
  }
}

export const getConversationDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const conversation = await prisma.$queryRawUnsafe(`
      SELECT * FROM "ChatLog" WHERE id = $1
    `, parseInt(id as string)) as any[]

    if (!conversation[0]) return res.status(404).json({ error: 'Non trouve' })
    res.json(conversation[0])
  } catch (e) {
    res.status(500).json({ error: 'Erreur' })
  }
}

export const getSecurityStats = async (req: Request, res: Response) => {
  try {
    const jailbreaks = await prisma.$queryRawUnsafe(`
      SELECT id, username, message, jailbreak_reason, created_at
      FROM "ChatLog"
      WHERE is_jailbreak = true
      ORDER BY created_at DESC
      LIMIT 50
    `) as any[]

    const patterns = await prisma.$queryRawUnsafe(`
      SELECT jailbreak_reason, COUNT(*)::INTEGER as count
      FROM "ChatLog"
      WHERE is_jailbreak = true AND jailbreak_reason IS NOT NULL
      GROUP BY jailbreak_reason
      ORDER BY count DESC
    `) as any[]

    const byUser = await prisma.$queryRawUnsafe(`
      SELECT username, COUNT(*)::INTEGER as attempts
      FROM "ChatLog"
      WHERE is_jailbreak = true
      GROUP BY username
      ORDER BY attempts DESC
      LIMIT 10
    `) as any[]

    res.json({ jailbreaks, patterns, byUser })
  } catch (e) {
    res.status(500).json({ error: 'Erreur securite' })
  }
}
