import axios from 'axios'

const ADZUNA_BASE = 'https://api.adzuna.com/v1/api/jobs/fr/search'

export async function scrapeAdzuna(queries: string[], location: string): Promise<any[]> {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY
  if (!appId || !appKey) {
    console.log('[Adzuna] Pas de credentials')
    return []
  }

  const jobs: any[] = []

  for (const query of queries.slice(0, 6)) {
    try {
      const response = await axios.get(`${ADZUNA_BASE}/1`, {
        params: {
          app_id: appId,
          app_key: appKey,
          what: query,
          where: location,
          distance: 30,
          results_per_page: 10,

        },
        timeout: 15000
      })

      const results = response.data.results || []
      console.log(`[Adzuna] ${query}: ${results.length} offres`)

      for (const job of results) {
        jobs.push({
          source: 'adzuna',
          externalId: job.id,
          url: job.redirect_url,
          title: job.title,
          company: job.company?.display_name || 'N/A',
          location: job.location?.display_name || location,
          description: job.description || '',
          salary: job.salary_min ? `${Math.round(job.salary_min)}€ - ${Math.round(job.salary_max || job.salary_min)}€` : null,
          contractType: job.contract_time || null,
          category: job.category?.label || null
        })
      }

      await new Promise(r => setTimeout(r, 1000))
    } catch (e: any) {
      console.error(`[Adzuna] Error for "${query}":`, e.response?.status, e.message)
    }
  }

  return jobs
}
