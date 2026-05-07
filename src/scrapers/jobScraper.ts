import axios from 'axios'
import prisma from '../services/prisma'

// ============================================================
// CONFIG — Mots-clés par catégorie
// ============================================================
const SEARCH_QUERIES = [
  { q: 'administrateur systeme', category: 'Admin Sys/DevOps' },
  { q: 'devops kubernetes', category: 'Admin Sys/DevOps' },
  { q: 'developpeur fullstack', category: 'Dev Full Stack' },
  { q: 'developpeur react nodejs', category: 'Dev Full Stack' },
  { q: 'support informatique', category: 'Support IT' },
  { q: 'technicien support', category: 'Support IT' },
  { q: 'ressources humaines', category: 'RH' },
  { q: 'chargé RH recrutement', category: 'RH' },
]

const LOCATION = 'Paris'

// ============================================================
// SCORING IA
// ============================================================
async function scoreJob(title: string, description: string, category: string): Promise<{ score: number; grade: string; summary: string }> {
  try {
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
    const prompt = `Tu es un expert RH. Analyse cette offre d emploi et donne un score de 0 a 5.

Offre: ${title}
Categorie: ${category}
Description (extrait): ${description.slice(0, 500)}

Reponds UNIQUEMENT en JSON valide:
{"score": 4.2, "grade": "A", "summary": "Poste interessant car...", "keywords": ["kubernetes", "linux"]}

Grades: A=4.5-5, B=3.5-4.4, C=2.5-3.4, D=1.5-2.4, F=0-1.4`

    const response = await axios.post(ollamaUrl + '/api/generate', {
      model: process.env.OLLAMA_MODEL || 'qwen2.5:14b',
      prompt, stream: false, format: 'json'
    }, { timeout: 60000 })

    const result = JSON.parse(response.data.response)
    return {
      score: result.score || 3.0,
      grade: result.grade || 'C',
      summary: result.summary || ''
    }
  } catch (e) {
    return { score: 3.0, grade: 'C', summary: 'Analyse non disponible' }
  }
}

// ============================================================
// SCRAPER POLE EMPLOI (API officielle)
// ============================================================
async function scrapePoleEmploi(): Promise<number> {
  let total = 0
  try {
    // Auth Pôle Emploi API
    const clientId = process.env.POLE_EMPLOI_CLIENT_ID
    const clientSecret = process.env.POLE_EMPLOI_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      console.log('[PoleEmploi] Pas de credentials - utilisation mode demo')
      return await scrapePoleEmploiDemo()
    }

    const authResponse = await axios.post(
      'https://entreprise.pole-emploi.fr/connexion/oauth2/access_token?realm=%2Fpartenaire',
      `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}&scope=api_offresdemploiv2%20o2dsoffre`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 }
    )
    const token = authResponse.data.access_token

    for (const query of SEARCH_QUERIES) {
      const response = await axios.get('https://api.pole-emploi.io/partenaire/offresdemploi/v2/offres/search', {
        headers: { Authorization: `Bearer ${token}` },
        params: { motsCles: query.q, commune: '75056', distance: 30, range: '0-19' },
        timeout: 15000
      })

      const offres = response.data.resultats || []
      for (const offre of offres) {
        try {
          const { score, grade, summary } = await scoreJob(offre.intitule, offre.description || '', query.category)
          await prisma.$queryRawUnsafe(
            `INSERT INTO "JobScrape" (source, external_id, url, title, company, location, description, salary, contract_type, remote, category, score, grade, ai_analysis)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
             ON CONFLICT (source, external_id) DO NOTHING`,
            'pole-emploi', offre.id,
            `https://candidat.pole-emploi.fr/offres/recherche/detail/${offre.id}`,
            offre.intitule, offre.entreprise?.nom || 'N/A',
            offre.lieuTravail?.libelle || LOCATION,
            offre.description || '', offre.salaire?.libelle || null,
            offre.typeContrat || null, offre.experienceLibelle?.includes('télétravail') || false,
            query.category, score, grade, JSON.stringify({ summary })
          )
          total++
        } catch (e) { /* skip duplicate */ }
      }
      await new Promise(r => setTimeout(r, 1000))
    }
  } catch (e: any) {
    console.error('[PoleEmploi] Error:', e.message)
  }
  return total
}

async function scrapePoleEmploiDemo(): Promise<number> {
  const demoJobs = [
    { title: 'Administrateur Systeme Linux', company: 'TechCorp Paris', category: 'Admin Sys/DevOps', desc: 'Gestion infrastructure Linux, Docker, Kubernetes. 3 ans exp requis.' },
    { title: 'DevOps Engineer', company: 'Startup IA', category: 'Admin Sys/DevOps', desc: 'CI/CD GitLab, Terraform, AWS. Remote friendly.' },
    { title: 'Developpeur React Node.js', company: 'Agence Web', category: 'Dev Full Stack', desc: 'React 18, Node.js, TypeScript, PostgreSQL. Profil senior.' },
    { title: 'Technicien Support N2', company: 'ESN Paris', category: 'Support IT', desc: 'Support utilisateurs, ITSM ServiceNow, Active Directory.' },
    { title: 'Charge de Recrutement IT', company: 'Cabinet RH', category: 'RH', desc: 'Recrutement profils tech, sourcing LinkedIn, entretiens.' },
  ]

  let total = 0
  for (const job of demoJobs) {
    const { score, grade, summary } = await scoreJob(job.title, job.desc, job.category)
    try {
      await prisma.$queryRawUnsafe(
        `INSERT INTO "JobScrape" (source, external_id, url, title, company, location, description, category, score, grade, ai_analysis)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (source, external_id) DO NOTHING`,
        'demo', `demo-${Date.now()}-${total}`,
        `https://cvflow.onemad.uk/jobs/${total}`,
        job.title, job.company, 'Paris (75)',
        job.desc, job.category, score, grade,
        JSON.stringify({ summary })
      )
      total++
    } catch (e) {}
  }
  return total
}

// ============================================================
// SCRAPER INDEED (RSS)
// ============================================================
async function scrapeIndeed(): Promise<number> {
  let total = 0
  try {
    for (const query of SEARCH_QUERIES.slice(0, 4)) {
      const rssUrl = `https://fr.indeed.com/rss?q=${encodeURIComponent(query.q)}&l=${encodeURIComponent(LOCATION)}&radius=30`
      const response = await axios.get(rssUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CVFlow/1.0)' },
        timeout: 15000
      })

      const items = response.data.match(/<item>(.*?)<\/item>/gs) || []
      for (const item of items.slice(0, 10)) {
        const title = item.match(/<title>(.*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || ''
        const link = item.match(/<link>(.*?)<\/link>/)?.[1]?.trim() || ''
        const company = item.match(/<source[^>]*>(.*?)<\/source>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || 'N/A'
        const desc = item.match(/<description>(.*?)<\/description>/)?.[1]?.replace(/<[^>]*>/g, '').replace(/<!\[CDATA\[|\]\]>/g, '').trim() || ''
        const externalId = link.split('jk=')[1]?.split('&')[0] || link.slice(-20)

        if (!title || !link) continue

        const { score, grade, summary } = await scoreJob(title, desc, query.category)
        try {
          await prisma.$queryRawUnsafe(
            `INSERT INTO "JobScrape" (source, external_id, url, title, company, location, description, category, score, grade, ai_analysis)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             ON CONFLICT (source, external_id) DO NOTHING`,
            'indeed', externalId, link, title, company,
            LOCATION, desc, query.category, score, grade,
            JSON.stringify({ summary })
          )
          total++
        } catch (e) {}
      }
      await new Promise(r => setTimeout(r, 2000))
    }
  } catch (e: any) {
    console.error('[Indeed] Error:', e.message)
  }
  return total
}

// ============================================================
// SCRAPER WELCOME TO THE JUNGLE (API publique)
// ============================================================
async function scrapeWTTJ(): Promise<number> {
  let total = 0
  try {
    const queries = ['devops', 'administrateur+systeme', 'support+informatique', 'fullstack', 'recrutement']
    for (const q of queries) {
      const response = await axios.get(
        `https://api.welcometothejungle.com/api/v1/jobs?query=${q}&location=Paris&page=1&per_page=10`,
        { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }
      )

      const jobs = response.data.jobs || response.data.results || []
      for (const job of jobs) {
        const title = job.name || job.title || ''
        const company = job.organization?.name || job.company || 'N/A'
        const desc = job.description || job.profile || ''
        const url = `https://www.welcometothejungle.com/fr/companies/${job.organization?.slug}/jobs/${job.slug}`
        const externalId = job.uuid || job.id || url.slice(-20)
        const category = SEARCH_QUERIES.find(sq => title.toLowerCase().includes(sq.q.split(' ')[0]))?.category || 'Autre'

        const { score, grade, summary } = await scoreJob(title, desc, category)
        try {
          await prisma.$queryRawUnsafe(
            `INSERT INTO "JobScrape" (source, external_id, url, title, company, location, description, category, score, grade, ai_analysis)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             ON CONFLICT (source, external_id) DO NOTHING`,
            'wttj', externalId, url, title, company,
            job.office?.city || LOCATION, desc, category,
            score, grade, JSON.stringify({ summary })
          )
          total++
        } catch (e) {}
      }
      await new Promise(r => setTimeout(r, 1500))
    }
  } catch (e: any) {
    console.error('[WTTJ] Error:', e.message)
  }
  return total
}

// ============================================================
// MAIN SCRAPER
// ============================================================
export async function runScraper(): Promise<void> {
  console.log('[Scraper] Démarrage...')
  const start = Date.now()

  const [pe, indeed, wttj] = await Promise.allSettled([
    scrapePoleEmploi(),
    scrapeIndeed(),
    scrapeWTTJ(),
  ])

  const total =
    (pe.status === 'fulfilled' ? pe.value : 0) +
    (indeed.status === 'fulfilled' ? indeed.value : 0) +
    (wttj.status === 'fulfilled' ? wttj.value : 0)

  const duration = Math.round((Date.now() - start) / 1000)
  console.log(`[Scraper] Terminé: ${total} nouvelles offres en ${duration}s`)
  console.log(`  Pôle Emploi: ${pe.status === 'fulfilled' ? pe.value : 'erreur'}`)
  console.log(`  Indeed: ${indeed.status === 'fulfilled' ? indeed.value : 'erreur'}`)
  console.log(`  WTTJ: ${wttj.status === 'fulfilled' ? wttj.value : 'erreur'}`)
}
