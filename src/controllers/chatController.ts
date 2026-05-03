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
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
      const model = genAI.getGenerativeModel({ model: cv.aiModel || 'gemini-2.0-flash', systemInstruction: systemPrompt })
      const history = messages.slice(0, -1).map((m: any) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
      const chatSession = model.startChat({ history })
      const result = await chatSession.sendMessage(messages[messages.length - 1].content)
      res.json({ message: result.response.text() })
    } else {
      const response = await axios.post('https://api.anthropic.com/v1/messages',
        { model: 'claude-sonnet-4-6', max_tokens: 1024, system: systemPrompt, messages },
        { headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' } }
      )
      res.json({ message: response.data.content[0].text })
    }
  } catch (e) { console.error('Chat error:', e); res.status(500).json({ error: 'Erreur IA' }) }
}