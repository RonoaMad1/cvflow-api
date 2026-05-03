import { Response } from 'express'
import prisma from '../services/prisma'
import axios from 'axios'

async function callAI(cv: any, prompt: string): Promise<string> {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
  const response = await axios.post(ollamaUrl + '/api/chat', {
    model: cv.aiModel || 'llama3.2:3b',
    messages: [{ role: 'user', content: prompt }],
    stream: false
  })
  return response.data.message.content
}

export const generateQuestions = async (req: any, res: Response) => {
  try {
    const { jobId } = req.body
    const user = await prisma.user.findUnique({ where: { id: req.userId }, include: { cv: true } })
    if (!user || !(user as any).cv) return res.status(404).json({ error: 'CV non trouve' })
    const cv = (user as any).cv
    let jobDesc = ''
    let jobTitle = ''
    if (jobId) {
      const jobs = await prisma.$queryRawUnsafe('SELECT * FROM "Job" WHERE id=$1 AND "userId"=$2', jobId, req.userId) as any[]
      if (jobs.length > 0) {
        jobTitle = jobs[0].title || ''
        jobDesc = jobs[0].description || ''
      }
    }
    const cvText = [cv.title, cv.summary, ...(cv.experiences||[]).map((e:any)=>e.role+' '+e.company+' '+e.description), ...(cv.skills||[]).map((s:any)=>s.name)].join(' ')
    const prompt = 'Tu es un recruteur expert. Genere 8 questions d entretien pertinentes basees sur ce profil et cette offre. ' +
      'Inclus: 3 questions techniques, 2 questions comportementales STAR, 2 questions de motivation, 1 question sur les points faibles. ' +
      'CV: ' + cvText.slice(0,500) + ' OFFRE: ' + (jobTitle + ' ' + jobDesc).slice(0,500) + '. ' +
      'Reponds UNIQUEMENT en JSON: {"questions": [{"id":"1","type":"technique","question":"...","tip":"conseil pour repondre"}]}'
    const text = await callAI(cv, prompt)
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    let questions = []
    if (start !== -1 && end !== -1) {
      try { questions = JSON.parse(text.slice(start, end+1)).questions || [] } catch(e) {}
    }
    if (questions.length === 0) {
      questions = [
        { id:'1', type:'technique', question:'Decrivez votre experience avec les infrastructures cloud (Azure, AWS).', tip:'Donnez des exemples concrets avec des chiffres' },
        { id:'2', type:'technique', question:'Comment gerez-vous les incidents en production ?', tip:'Utilisez la methode STAR: Situation, Tache, Action, Resultat' },
        { id:'3', type:'technique', question:'Quelle est votre experience avec Docker et Kubernetes ?', tip:'Mentionnez des projets specifiques' },
        { id:'4', type:'comportementale', question:'Parlez-moi d un moment ou vous avez resolu un probleme complexe sous pression.', tip:'Structure STAR recommandee' },
        { id:'5', type:'comportementale', question:'Comment gerez-vous les conflits dans une equipe ?', tip:'Montrez votre capacite de communication' },
        { id:'6', type:'motivation', question:'Pourquoi etes-vous interesse par ce poste ?', tip:'Liez vos competences aux besoins du poste' },
        { id:'7', type:'motivation', question:'Où vous voyez-vous dans 5 ans ?', tip:'Montrez ambition et coherence avec le poste' },
        { id:'8', type:'faiblesse', question:'Quelle est votre principale faiblesse professionnelle ?', tip:'Choisissez une vraie faiblesse et expliquez comment vous la travaillez' }
      ]
    }
    res.json({ questions, jobTitle })
  } catch (e) {
    console.error('generateQuestions error:', e)
    res.status(500).json({ error: 'Erreur generation questions' })
  }
}

export const evaluateAnswer = async (req: any, res: Response) => {
  try {
    const { question, answer, type } = req.body
    if (!answer?.trim()) return res.status(400).json({ error: 'Reponse vide' })
    const user = await prisma.user.findUnique({ where: { id: req.userId }, include: { cv: true } })
    if (!user || !(user as any).cv) return res.status(404).json({ error: 'CV non trouve' })
    const cv = (user as any).cv
    const prompt = 'Tu es un coach en entretien. Evalue cette reponse a une question d entretien de type ' + type + '. ' +
      'Question: ' + question + ' Reponse: ' + answer + '. ' +
      'Reponds en JSON: {"score":8,"feedback":"commentaire constructif","strengths":["point fort 1"],"improvements":["a ameliorer 1"],"ideal_answer":"exemple de reponse ideale en 2-3 phrases"}'
    const text = await callAI(cv, prompt)
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    let evaluation = { score: 7, feedback: 'Bonne reponse', strengths: [], improvements: [], ideal_answer: '' }
    if (start !== -1 && end !== -1) {
      try { evaluation = JSON.parse(text.slice(start, end+1)) } catch(e) {}
    }
    res.json(evaluation)
  } catch (e) {
    console.error('evaluateAnswer error:', e)
    res.status(500).json({ error: 'Erreur evaluation' })
  }
}