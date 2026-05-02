import { Request, Response } from 'express'
import prisma from '../services/prisma'
import axios from 'axios'
export const chat = async (req: Request, res: Response) => {
  try {
    const { username } = req.params
    const { messages } = req.body
    const user = await prisma.user.findUnique({ where: { username: req.params.username as string }, include: { cv: true } })
    const cv = (user as any).cv
    const systemPrompt = cv.systemPrompt || 'Tu es l assistant IA de ' + cv.firstName + ' ' + cv.lastName + '. Tu connais son parcours et reponds aux questions des recruteurs.'
    if (cv.aiProvider === 'ollama') {
      const response = await axios.post(process.env.OLLAMA_URL + '/api/chat', { model: cv.aiModel, messages: [{ role: 'system', content: systemPrompt }, ...messages], stream: false })
      res.json({ message: response.data.message.content })
    } else {
      const response = await axios.post('https://api.anthropic.com/v1/messages', { model: 'claude-sonnet-4-6', max_tokens: 1024, system: systemPrompt, messages }, { headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' } })
      res.json({ message: response.data.content[0].text })
    }
  } catch (e) { console.error('Chat error:', e); res.status(500).json({ error: 'Erreur IA' }) }
}