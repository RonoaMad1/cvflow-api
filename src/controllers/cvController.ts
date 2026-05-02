import { Request, Response } from 'express'
import prisma from '../services/prisma'
export const getCV = async (req: any, res: Response) => {
  try { const cv = await prisma.cV.findUnique({ where: { userId: req.userId } }); res.json(cv) }
  catch (e) { res.status(500).json({ error: 'Erreur serveur' }) }
}
export const updateCV = async (req: any, res: Response) => {
  try {
    const cv = await prisma.cV.upsert({ where: { userId: req.userId }, update: req.body, create: { ...req.body, userId: req.userId } })
    res.json(cv)
  } catch (e) { res.status(500).json({ error: 'Erreur serveur' }) }
}
export const getPublicCV = async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { username: req.params.username as string }, include: { cv: true } })
    res.json((user as any).cv)
  } catch (e) { res.status(500).json({ error: 'Erreur serveur' }) }
}