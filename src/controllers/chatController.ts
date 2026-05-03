import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import axios from 'axios'
import prisma from '../services/prisma'

export const chat = async (req: Request, res: Response) => {
  try {
    const { username } = req.params
    const { messages } = req.body
    const user = await prisma.user.findUnique({ where: { username: req.params.username as string }, include: { cv: true } })
    if (!user || !(user as any).cv) return res.status(404).json({ error: 'CV non trouve' })
    const cv = (user as any).cv
    const name = cv.firstName + ' ' + cv.lastName
    const systemPrompt = cv.systemPrompt || 'Tu es l assistant IA de ' + name + '. Tu connais son parcours et reponds aux questions des recruteurs en son nom.'
    if (cv.aiProvider === 'ollama') {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
      const response = await axios.post(ollamaUrl + '/api/chat', {
        model: cv.aiModel, messages: [{ role: 'system', content: systemPrompt }, ...messages], stream: false
      }, { timeout: 300000 })
      res.json({ message: response.data.message.content })
    } else if (cv.aiProvider === 'gemini') {
      const geminiModel = cv.aiModel || 'gemini-2.0-flash'
      const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' + geminiModel + ':generateContent?key=' + (process.env.GEMINI_API_KEY || '')
      const geminiMessages = [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + messages.map((m: any) => m.role + ': ' + m.content).join('\n') }] }]
      const response = await axios.post(geminiUrl, { contents: geminiMessages }, { timeout: 60000 })
      const text = response.data.candidates[0].content.parts[0].text
      res.json({ message: text })
    } else {
      const response = await axios.post('https://api.anthropic.com/v1/messages',
        { model: 'claude-sonnet-4-6', max_tokens: 1024, system: systemPrompt, messages },
        { headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' } }
      )
      res.json({ message: response.data.content[0].text })
    }
  } catch (e) { console.error('Chat error:', e); res.status(500).json({ error: 'Erreur IA' }) }
}