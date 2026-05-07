import puppeteer from 'puppeteer-core'

export async function scrapeIndeedPuppeteer(queries: string[], location: string): Promise<any[]> {
  let browser = null
  const jobs: any[] = []

  try {
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1280,800'
      ]
    })

    for (const query of queries.slice(0, 3)) {
      try {
        const page = await browser.newPage()
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'fr-FR,fr;q=0.9' })

        const url = `https://fr.indeed.com/jobs?q=${encodeURIComponent(query)}&l=${encodeURIComponent(location)}&radius=30`
        console.log('[Indeed] Scraping:', url)

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
        await new Promise(r => setTimeout(r, 2000))

        // Extraire les offres
        const extracted = await page.evaluate(() => {
          const cards = document.querySelectorAll('[data-jk], .job_seen_beacon, .tapItem')
          const results: any[] = []

          cards.forEach((card: any) => {
            const title = card.querySelector('h2 a span, .jobTitle span')?.textContent?.trim()
            const company = card.querySelector('[data-testid="company-name"], .companyName')?.textContent?.trim()
            const location = card.querySelector('[data-testid="text-location"], .companyLocation')?.textContent?.trim()
            const salary = card.querySelector('[data-testid="attribute_snippet_testid"], .salary-snippet')?.textContent?.trim()
            const jobKey = card.getAttribute('data-jk') || card.querySelector('a')?.href?.split('jk=')[1]?.split('&')[0]
            const desc = card.querySelector('.job-snippet, [data-testid="job-snippet"]')?.textContent?.trim()

            if (title && company) {
              results.push({ title, company, location, salary, jobKey, desc })
            }
          })
          return results
        })

        for (const job of extracted) {
          if (job.title && job.company) {
            jobs.push({
              source: 'indeed',
              externalId: job.jobKey || `indeed-${Date.now()}-${Math.random()}`,
              url: job.jobKey ? `https://fr.indeed.com/viewjob?jk=${job.jobKey}` : 'https://fr.indeed.com',
              title: job.title,
              company: job.company,
              location: job.location || location,
              description: job.desc || '',
              salary: job.salary || null
            })
          }
        }

        console.log(`[Indeed] ${query}: ${extracted.length} offres`)
        await page.close()
        await new Promise(r => setTimeout(r, 3000))

      } catch (e: any) {
        console.error('[Indeed] Query error:', e.message)
      }
    }
  } catch (e: any) {
    console.error('[Indeed Puppeteer] Error:', e.message)
  } finally {
    if (browser) await browser.close()
  }

  return jobs
}
