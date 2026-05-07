import { Request, Response } from 'express'
import axios from 'axios'
import prisma from '../services/prisma'

const JAILBREAK_PATTERNS = [
  /ignore (all |previous |above |prior )?instructions/i,
  /forget (everything|all|your instructions)/i,
  /you are now (a |an )?(?!assistant)/i,
  /act as (a |an )?(?!assistant)/i,
  /pretend (you are|to be)/i,
  /jailbreak/i,
  /dan mode/i,
  /developer mode/i,
  /system prompt/i,
  /reveal (your|the) (prompt|instructions|system)/i,
  /bypass (your|the) (rules|restrictions|guidelines)/i,
]

function detectJailbreak(message: string): { isJailbreak: boolean; reason?: string } {
  for (const pattern of JAILBREAK_PATTERNS) {
    if (pattern.test(message)) {
      return { isJailbreak: true, reason: pattern.toString() }
    }
  }
  return { isJailbreak: false }
}

async function getEmbedding(text: string, ollamaUrl: string): Promise<number[] | null> {
  try {
    const response = await axios.post(ollamaUrl + '/api/embeddings', {
      model: 'nomic-embed-text', prompt: text
    }, { timeout: 30000 })
    return response.data.embedding
  } catch (e) {
    return null
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

async function indexCV(cvId: number, cv: any, ollamaUrl: string): Promise<void> {
  await prisma.$queryRawUnsafe(`DELETE FROM "CVChunk" WHERE cv_id = $1`, cvId)
  const chunks: { content: string; type: string }[] = []

  chunks.push({ content: `Je m'appelle ${cv.firstName} ${cv.lastName}. Mon titre est ${cv.title || ""}. ${cv.summary || ""}`, type: "summary" })

  if (cv.email || cv.phone || cv.location) {
    chunks.push({ content: `Contact: email ${cv.email || ""}, telephone ${cv.phone || ""}, localisation ${cv.location || ""}. LinkedIn: ${cv.linkedin || ""}. GitHub: ${cv.github || ""}`, type: "contact" })
  }

  const experiences = Array.isArray(cv.experiences) ? cv.experiences : []
  for (const exp of experiences) {
    chunks.push({ content: `Experience: ${exp.role || ""} chez ${exp.company || ""} de ${exp.startDate || ""} a ${exp.current ? "aujourd'hui" : exp.endDate || ""}. ${exp.description || ""}`, type: "experience" })
  }

  const education = Array.isArray(cv.education) ? cv.education : []
  for (const edu of education) {
    chunks.push({ content: `Formation: ${edu.degree || ""} en ${edu.field || ""} a ${edu.school || ""} de ${edu.startDate || ""} a ${edu.endDate || ""}.`, type: "education" })
  }

  const skills = Array.isArray(cv.skills) ? cv.skills : []
  if (skills.length > 0) {
    chunks.push({ content: `Competences: ${skills.map((s: any) => s.name).join(", ")}.`, type: "skills" })
  }

  const languages = Array.isArray(cv.languages) ? cv.languages : []
  if (languages.length > 0) {
    chunks.push({ content: `Langues: ${languages.map((l: any) => l.name + " (" + l.level + ")").join(", ")}.`, type: "languages" })
  }

  const certifications = Array.isArray(cv.certifications) ? cv.certifications : []
  for (const cert of certifications) {
    chunks.push({ content: `Certification: ${cert.name || ""} obtenue en ${cert.date || ""} chez ${cert.issuer || ""}.`, type: "certification" })
  }

  for (const chunk of chunks) {
    const embedding = await getEmbedding(chunk.content, ollamaUrl)
    await prisma.$queryRawUnsafe(
      `INSERT INTO "CVChunk" (cv_id, content, chunk_type, embedding) VALUES ($1, $2, $3, $4)`,
      cvId, chunk.content, chunk.type, embedding ? JSON.stringify(embedding) : null
    )
  }
}

async function retrieveRelevantChunks(cvId: number, query: string, ollamaUrl: string, topK = 3): Promise<string> {
  const queryEmbedding = await getEmbedding(query, ollamaUrl)
  const chunks = await prisma.$queryRawUnsafe(`SELECT content, embedding FROM "CVChunk" WHERE cv_id = $1`, cvId) as any[]

  if (!queryEmbedding || chunks.length === 0) {
    return chunks.map((c: any) => c.content).join("\n")
  }

  const scored = chunks
    .filter((c: any) => c.embedding)
    .map((c: any) => ({ content: c.content, score: cosineSimilarity(queryEmbedding, c.embedding) }))
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, topK)

  return scored.map((s: any) => s.content).join("\n\n")
}

export const chat = async (req: Request, res: Response) => {
  const startTime = Date.now()
  try {
    const { username } = req.params
    const { messages } = req.body
    const user = await prisma.user.findUnique({ where: { username: username as string }, include: { cv: true } })
    if (!user || !(user as any).cv) return res.status(404).json({ error: "CV non trouve" })
    const cv = (user as any).cv
    const lastMessage = messages[messages.length - 1]?.content || ""

    const jailbreakCheck = detectJailbreak(lastMessage)
    if (jailbreakCheck.isJailbreak) {
      await prisma.$queryRawUnsafe(
        `INSERT INTO "ChatLog" (username, message, response, provider, model, latency_ms, is_jailbreak, jailbreak_reason) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        username, lastMessage, "Tentative de manipulation detectee.", cv.aiProvider, cv.aiModel, Date.now() - startTime, true, jailbreakCheck.reason
      ).catch(() => {})
      return res.json({ message: "Je suis l'assistant de " + cv.firstName + " " + cv.lastName + " et je ne reponds qu'aux questions sur son parcours professionnel." })
    }

    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434"
    let ragContext = ""
    try {
      const chunkCount = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "CVChunk" WHERE cv_id = $1`, cv.id) as any[]
      if (!chunkCount[0] || parseInt(chunkCount[0].count) === 0) {
        await indexCV(cv.id, cv, ollamaUrl)
      }
      ragContext = await retrieveRelevantChunks(cv.id, lastMessage, ollamaUrl)
    } catch (ragError) {
      console.error("RAG error:", ragError)
    }

    const name = cv.firstName + " " + cv.lastName
    const basePrompt = cv.systemPrompt || `Tu es l'assistant IA de ${name}. Tu reponds aux questions des recruteurs en son nom, a la premiere personne.`
    const systemPrompt = ragContext ? `${basePrompt}\n\n## Informations pertinentes du CV:\n${ragContext}\n\nUtilise ces informations pour repondre avec precision.` : basePrompt

    let responseText = ""

    if (cv.aiProvider === "ollama") {
      const response = await axios.post(ollamaUrl + "/api/chat", {
        model: cv.aiModel, messages: [{ role: "system", content: systemPrompt }, ...messages], stream: false
      }, { timeout: 300000 })
      responseText = response.data.message.content
    } else if (cv.aiProvider === "gemini") {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cv.aiModel || "gemini-2.0-flash"}:generateContent?key=${process.env.GEMINI_API_KEY || ""}`
      const response = await axios.post(geminiUrl, { contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\n" + messages.map((m: any) => m.role + ": " + m.content).join("\n") }] }] }, { timeout: 60000 })
      responseText = response.data.candidates[0].content.parts[0].text
    } else {
      const response = await axios.post("https://api.anthropic.com/v1/messages", {
        model: "claude-sonnet-4-6", max_tokens: 1024, system: systemPrompt, messages
      }, { headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" } })
      responseText = response.data.content[0].text
    }

    const latency = Date.now() - startTime
    await prisma.$queryRawUnsafe(
      `INSERT INTO "ChatLog" (username, message, response, provider, model, latency_ms, is_jailbreak) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      username, lastMessage, responseText, cv.aiProvider, cv.aiModel, latency, false
    ).catch(e => console.error("Log error:", e))

    res.json({ message: responseText })
  } catch (e) {
    console.error("Chat error:", e)
    res.status(500).json({ error: "Erreur IA" })
  }
}

export const reindexCV = async (req: Request, res: Response) => {
  try {
    const { username } = req.params
    const user = await prisma.user.findUnique({ where: { username: username as string }, include: { cv: true } })
    if (!user || !(user as any).cv) return res.status(404).json({ error: "CV non trouve" })
    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434"
    await indexCV((user as any).cv.id, (user as any).cv, ollamaUrl)
    res.json({ message: "CV reindexe avec succes" })
  } catch (e) {
    console.error("Reindex error:", e)
    res.status(500).json({ error: "Erreur reindexation" })
  }
}
