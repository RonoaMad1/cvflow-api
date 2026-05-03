import { Request, Response } from 'express'
import axios from 'axios'
import prisma from '../services/prisma'

const GRADES = ['F', 'D', 'C', 'B', 'A']

function scoreToGrade(score: number): string {
  if (score >= 4.5) return 'A'
  if (score >= 3.5) return 'B'
  if (score >= 2.5) return 'C'
  if (score >= 1.5) return 'D'
  return 'F'
}

export const analyzeJob = async (req: any, res: Response) => {
  try {
    const { url, description, title, company } = req.body
    if (!description) return res.status(400).json({ error: 'Description requise' })

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { cv: true }
    })
    if (!user || !(user as any).cv) return res.status(404).json({ error: 'CV non trouve' })

    const cv = (user as any).cv
    const cvText = [
      cv.title, cv.summary,
      ...(cv.experiences || []).map((e: any) => e.role + ' ' + e.company + ' ' + e.description),
      ...(cv.skills || []).map((s: any) => s.name)
    ].join(' ')

    const prompt = `Tu es un expert en recrutement. Analyse la compatibilite entre ce CV et cette offre d emploi.

CV:
${cvText}

OFFRE D EMPLOI - ${title || ''} chez ${company || ''}:
${description}

Reponds UNIQUEMENT en JSON valide avec cette structure exacte:
{
  "score": 3.8,
  "grade": "B",
  "title": "titre du poste",
  "company": "nom entreprise",
  "summary": "resume en 1 phrase",
  "pros": ["point fort 1", "point fort 2", "point fort 3"],
  "cons": ["point faible 1", "point faible 2"],
  "keywords": ["mot cle 1", "mot cle 2", "mot cle 3"],
  "recommendation": "conseil en 1-2 phrases"
}

Le score est de 1 a 5. Grade: A(4.5+) B(3.5+) C(2.5+) D(1.5+) F(<1.5)`

    let analysis: any = { score: 0, grade: 'F', title: title||'', company: company||'', summary: '', pros: [], cons: [], keywords: [], recommendation: '' }
    const aiProvider = cv.aiProvider || 'ollama'

    if (aiProvider === 'ollama') {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
      const response = await axios.post(ollamaUrl + '/api/chat', {
        model: cv.aiModel || 'llama3.2:3b',
        messages: [{ role: 'user', content: prompt }],
        stream: false
      })
      const text = response.data.message.content
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) analysis = JSON.parse(jsonMatch[0])
    } else {
      const response = await axios.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      }, { headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' } })
      const text = response.data.content[0].text
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) analysis = JSON.parse(jsonMatch[0])
    }

    const job = await prisma.$queryRawUnsafe(
      'INSERT INTO "Job" (id, "userId", url, title, company, description, score, grade, analysis, status, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,NOW(),NOW()) RETURNING *',
      Math.random().toString(36).slice(2),
      req.userId,
      url || '',
      analysis.title || title || '',
      analysis.company || company || '',
      description.slice(0, 2000),
      String(analysis.score || 0),
      analysis.grade || 'F',
      JSON.stringify(analysis),
      'new'
    )

    res.json({ job: (job as any[])[0], analysis })
  } catch (e) {
    console.error('analyzeJob error:', e)
    res.status(500).json({ error: 'Erreur analyse' })
  }
}

export const getJobs = async (req: any, res: Response) => {
  try {
    const jobs = await prisma.$queryRawUnsafe(
      'SELECT * FROM "Job" WHERE "userId" = $1 ORDER BY "createdAt" DESC',
      req.userId
    )
    res.json(jobs)
  } catch (e) {
    res.status(500).json({ error: 'Erreur' })
  }
}

export const updateJobStatus = async (req: any, res: Response) => {
  try {
    const { status } = req.body
    await prisma.$queryRawUnsafe(
      'UPDATE "Job" SET status=$1, "updatedAt"=NOW() WHERE id=$2 AND "userId"=$3',
      status, req.params.id, req.userId
    )
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Erreur' })
  }
}
