import { Request, Response } from 'express'
import prisma from '../services/prisma'

export const getCV = async (req: any, res: Response) => {
  try {
    const cv = await prisma.cV.findUnique({ where: { userId: req.userId } })
    res.json(cv)
  } catch (e) { res.status(500).json({ error: 'Erreur serveur' }) }
}

export const updateCV = async (req: any, res: Response) => {
  try {
    const d = req.body
    const existing = await prisma.cV.findUnique({ where: { userId: req.userId } })
    if (existing) {
      await prisma.$queryRawUnsafe(
        'UPDATE "CV" SET "firstName"=$1,"lastName"=$2,"title"=$3,"summary"=$4,"email"=$5,"phone"=$6,"location"=$7,"linkedin"=$8,"github"=$9,"website"=$10,"experiences"=$11::jsonb,"education"=$12::jsonb,"skills"=$13::jsonb,"languages"=$14::jsonb,"aiProvider"=$15,"aiModel"=$16,"systemPrompt"=$17,"isPublic"=$18,"certifications"=$19::jsonb,"photo"=$20 WHERE "userId"=$21',
        d.firstName||'', d.lastName||'', d.title||'', d.summary||'',
        d.email||'', d.phone||'', d.location||'', d.linkedin||'', d.github||'', d.website||'',
        JSON.stringify(d.experiences||[]), JSON.stringify(d.education||[]),
        JSON.stringify(d.skills||[]), JSON.stringify(d.languages||[]),
        d.aiProvider||'ollama', d.aiModel||'llama3.2:3b', d.systemPrompt||'',
        d.isPublic !== false,
        JSON.stringify(d.certifications||[]), d.photo||'',
        req.userId
      )
    } else {
      await prisma.$queryRawUnsafe(
        'INSERT INTO "CV" (id,"userId","firstName","lastName","title","summary","email","phone","location","linkedin","github","website","experiences","education","skills","languages","aiProvider","aiModel","systemPrompt","isPublic","certifications","photo") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17,$18,$19,$20,$21::jsonb,$22)',
        Math.random().toString(36).slice(2), req.userId,
        d.firstName||'', d.lastName||'', d.title||'', d.summary||'',
        d.email||'', d.phone||'', d.location||'', d.linkedin||'', d.github||'', d.website||'',
        JSON.stringify(d.experiences||[]), JSON.stringify(d.education||[]),
        JSON.stringify(d.skills||[]), JSON.stringify(d.languages||[]),
        d.aiProvider||'ollama', d.aiModel||'llama3.2:3b', d.systemPrompt||'',
        d.isPublic !== false,
        JSON.stringify(d.certifications||[]), d.photo||''
      )
    }
    const cv = await prisma.cV.findUnique({ where: { userId: req.userId } })
    res.json(cv)
  } catch (e) { console.error('updateCV error:', e); res.status(500).json({ error: 'Erreur serveur' }) }
}

export const getPublicCV = async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { username: req.params.username as string }, include: { cv: true } })
    res.json((user as any).cv)
  } catch (e) { res.status(500).json({ error: 'Erreur serveur' }) }
}