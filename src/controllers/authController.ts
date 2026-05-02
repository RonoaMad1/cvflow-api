import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../services/prisma'
const JWT_SECRET = process.env.JWT_SECRET || 'cvflow-secret'

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, username } = req.body
    if (!email || !password || !username) return res.status(400).json({ error: 'Tous les champs sont requis' })
    const exists = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } })
    if (exists) return res.status(409).json({ error: 'Email ou username deja utilise' })
    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({ data: { email, password: hashed, username } })
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' })
    res.status(201).json({ token, user: { id: user.id, email: user.email, username: user.username } })
  } catch (e) { res.status(500).json({ error: 'Erreur serveur' }) }
}

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(401).json({ error: 'Identifiants invalides' })
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ error: 'Identifiants invalides' })
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, user: { id: user.id, email: user.email, username: user.username } })
  } catch (e) { res.status(500).json({ error: 'Erreur serveur' }) }
}

export const me = async (req: any, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, email: true, username: true, createdAt: true } })
    res.json(user)
  } catch (e) { res.status(500).json({ error: 'Erreur serveur' }) }
}
