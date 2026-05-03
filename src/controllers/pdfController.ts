import { Response } from 'express'
import prisma from '../services/prisma'

export const generatePDF = async (req: any, res: Response) => {
  try {
    const { jobId } = req.body
    const user = await prisma.user.findUnique({ where: { id: req.userId }, include: { cv: true } })
    if (!user || !(user as any).cv) return res.status(404).json({ error: 'CV non trouve' })
    const cv = (user as any).cv
    let keywords: string[] = []
    let jobTitle = ''
    let jobCompany = ''
    if (jobId) {
      const jobs = await prisma.$queryRawUnsafe('SELECT * FROM "Job" WHERE id=$1 AND "userId"=$2', jobId, req.userId) as any[]
      if (jobs.length > 0) {
        const job = jobs[0]
        jobTitle = job.title || ''
        jobCompany = job.company || ''
        const analysis = typeof job.analysis === 'string' ? JSON.parse(job.analysis) : job.analysis
        keywords = analysis?.keywords || []
      }
    }
    const html = buildHTML(cv, keywords, jobTitle, jobCompany)
    try {
      const chromium = await import('@sparticuz/chromium')
      const puppeteer = await import('puppeteer-core')
      const browser = await puppeteer.default.launch({
        args: chromium.default.args,
        defaultViewport: { width: 1200, height: 900 },
        executablePath: await chromium.default.executablePath(),
        headless: true,
      })
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle0' })
      const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } })
      await browser.close()
      const name = cv.firstName + '_' + cv.lastName + '.pdf'
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'attachment; filename="' + name + '"')
      res.send(Buffer.from(pdf))
    } catch (err) {
      console.error('Puppeteer error:', err)
      res.setHeader('Content-Type', 'text/html')
      res.send(html)
    }
  } catch (e) {
    console.error('generatePDF error:', e)
    res.status(500).json({ error: 'Erreur generation PDF' })
  }
}

function hl(text: string, kws: string[]): string {
  if (!text || !kws.length) return text || ''
  let r = text
  kws.forEach(k => { r = r.replace(new RegExp('(' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>') })
  return r
}

function buildHTML(cv: any, kws: string[], jobTitle: string, jobCompany: string): string {
  const exps = Array.isArray(cv.experiences) ? cv.experiences : []
  const edus = Array.isArray(cv.education) ? cv.education : []
  const skills = Array.isArray(cv.skills) ? cv.skills : []
  const langs = Array.isArray(cv.languages) ? cv.languages : []
  const CSS = '* {margin:0;padding:0;box-sizing:border-box} body{font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#1a1a1a} .hdr{background:linear-gradient(135deg,#059669,#0d9488);color:white;padding:28px 32px} .hdr h1{font-size:26px;font-weight:700} .sub{font-size:13px;opacity:0.9;margin-top:4px} .ct{display:flex;gap:16px;margin-top:12px;font-size:10px;opacity:0.85;flex-wrap:wrap} .tgt{background:rgba(255,255,255,0.15);border-radius:6px;padding:6px 12px;margin-top:10px;font-size:10px} .main{display:grid;grid-template-columns:1fr 2fr} .sb{background:#f8fafc;padding:24px 20px;border-right:1px solid #e2e8f0} .cnt{padding:24px 28px} .sec{margin-bottom:20px} .st{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#059669;border-bottom:2px solid #059669;padding-bottom:4px;margin-bottom:10px} .ski{margin-bottom:7px} .skn{font-size:10px;color:#374151;margin-bottom:3px;display:flex;justify-content:space-between} .skb{height:4px;background:#e2e8f0;border-radius:2px} .skf{height:100%;background:linear-gradient(90deg,#059669,#0d9488);border-radius:2px} .exp{margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #f1f5f9} .exh{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:3px} .exr{font-weight:600;font-size:12px;color:#111827} .exc{color:#059669;font-weight:500;font-size:11px} .exd{font-size:9px;color:#6b7280;background:#f3f4f6;padding:2px 6px;border-radius:4px;white-space:nowrap} .ext{color:#4b5563;line-height:1.5;margin-top:4px;font-size:10px} .edu{margin-bottom:10px} .edg{font-weight:600;font-size:11px} .eds{color:#059669;font-size:10px} .edd{font-size:9px;color:#6b7280} .lng{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px} .lnb{font-size:9px;padding:2px 6px;background:#d1fae5;color:#065f46;border-radius:4px} .kws{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:8px 10px;margin-bottom:14px} .kwt{font-size:9px;font-weight:700;color:#065f46;margin-bottom:4px;text-transform:uppercase} .kwl{display:flex;flex-wrap:wrap;gap:4px} .kwi{font-size:9px;padding:2px 6px;background:white;border:1px solid #6ee7b7;color:#047857;border-radius:10px} mark{background:#fef9c3;padding:0 2px;border-radius:2px} .sum{background:#f8fafc;border-left:3px solid #059669;padding:10px 12px;border-radius:0 6px 6px 0;color:#374151;line-height:1.6;font-size:10px;margin-bottom:16px}'
  const kwH = kws.length ? '<div class="kws"><div class="kwt">Mots-cles</div><div class="kwl">' + kws.map(k => '<span class="kwi">' + k + '</span>').join('') + '</div></div>' : ''
  const skH = skills.length ? '<div class="sec"><div class="st">Competences</div>' + skills.map((s: any) => '<div class="ski"><div class="skn"><span>' + s.name + '</span><span>' + (s.level*20) + '%</span></div><div class="skb"><div class="skf" style="width:' + (s.level*20) + '%"></div></div></div>').join('') + '</div>' : ''
  const lnH = langs.length ? '<div class="sec"><div class="st">Langues</div>' + langs.map((l: any) => '<div class="lng"><span>' + l.name + '</span><span class="lnb">' + l.level + '</span></div>').join('') + '</div>' : ''
  const edH = edus.length ? '<div class="sec"><div class="st">Formation</div>' + edus.map((e: any) => '<div class="edu"><div class="edg">' + e.degree + '</div><div class="eds">' + e.school + '</div><div class="edd">' + e.startDate + ' - ' + (e.endDate||'present') + '</div></div>').join('') + '</div>' : ''
  const exH = exps.length ? '<div class="sec"><div class="st">Experience</div>' + exps.map((e: any) => '<div class="exp"><div class="exh"><div><div class="exr">' + e.role + '</div><div class="exc">' + e.company + '</div></div><div class="exd">' + e.startDate + ' - ' + (e.current ? 'Present' : e.endDate) + '</div></div><div class="ext">' + hl(e.description, kws) + '</div></div>').join('') + '</div>' : ''
  const sumH = cv.summary ? '<div class="sum">' + hl(cv.summary, kws) + '</div>' : ''
  const tgtH = jobTitle ? '<div class="tgt">CV adapte pour : ' + jobTitle + (jobCompany ? ' chez ' + jobCompany : '') + '</div>' : ''
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' + CSS + '</style></head><body>' +
    '<div class="hdr"><h1>' + cv.firstName + ' ' + cv.lastName + '</h1><div class="sub">' + (cv.title||'') + '</div>' +
    '<div class="ct">' + (cv.email||'') + ' ' + (cv.phone||'') + ' ' + (cv.location||'') + '</div>' + tgtH + '</div>' +
    '<div class="main"><div class="sb">' + kwH + skH + lnH + edH + '</div>' +
    '<div class="cnt">' + sumH + exH + '</div></div></body></html>'
}