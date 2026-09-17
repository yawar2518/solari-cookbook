'use client'

import { useState } from 'react'
import { Download, Save } from 'lucide-react'
import { useToast } from '@/components/providers/ToastProvider'
import { Spinner } from '@/components/ui/States'
import { api, errorMessage } from '@/lib/api'
import type { CvDocument } from '@/lib/types'
import { download } from '@/lib/utils'

/** ATS-style single-column render of a structured CV, plus download/save. */
export function CvPreview({ cv, onSave, saved, title = 'Preview' }: { cv: CvDocument; onSave?: () => Promise<void>; saved?: boolean; title?: string }) {
  const toast = useToast()
  const [busy, setBusy] = useState<'pdf' | 'save' | null>(null)
  const c = cv.contact || {}
  const contactLine = [c.email, c.phone, c.location, c.linkedin, c.github, c.website].filter(Boolean).join('  |  ')

  const pdf = async () => {
    setBusy('pdf')
    try {
      const blob = await api.cvPdf(cv)
      download(blob, `${(c.name || 'CV').replace(/[^A-Za-z0-9]+/g, '_')}_CV.pdf`)
      toast.success('PDF downloaded')
    } catch (err) {
      toast.error('Could not build the PDF', errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    if (!onSave) return
    setBusy('save')
    try {
      await onSave()
      toast.success('Saved to your profile')
    } catch (err) {
      toast.error('Could not save', errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-4 py-3">
        <div className="eyebrow">{title}</div>
        <div className="flex gap-2">
          {onSave && (
            <button className="btn btn-ghost h-8 text-xs" onClick={save} disabled={busy !== null || saved} type="button">
              {busy === 'save' ? <Spinner size={13} /> : <Save size={13} />} {saved ? 'Saved' : 'Save to profile'}
            </button>
          )}
          <button className="btn btn-primary h-8 text-xs" onClick={pdf} disabled={busy !== null} type="button">
            {busy === 'pdf' ? <Spinner size={13} /> : <Download size={13} />} Download PDF
          </button>
        </div>
      </div>

      {/* Paper */}
      <div className="bg-[#0a1428] p-3 sm:p-5">
        <div className="mx-auto max-w-[720px] rounded-md bg-white px-7 py-7 text-[12.5px] leading-[1.45] text-[#111] shadow-xl sm:px-10 sm:py-9" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
          <h2 className="text-[20px] font-bold tracking-tight text-black" style={{ fontFamily: 'inherit' }}>
            {c.name || 'Your Name'}
          </h2>
          {contactLine && <div className="mt-0.5 text-[10.5px] text-[#333]">{contactLine}</div>}

          {cv.summary && (
            <Section title="Summary">
              <p>{cv.summary}</p>
            </Section>
          )}

          {!!cv.skills?.length && (
            <Section title="Skills">
              {cv.skills.map((g, i) => (
                <div key={i}>
                  <b>{g.category}:</b> {(g.items || []).join(', ')}
                </div>
              ))}
            </Section>
          )}

          {!!cv.experience?.length && (
            <Section title="Experience">
              {cv.experience.map((e, i) => (
                <div key={i} className="mb-2">
                  <div>
                    <b>{e.title}</b> — {e.company}
                    {e.location ? `, ${e.location}` : ''}
                    {(e.start || e.end) && <span className="text-[#555]"> ({[e.start, e.end].filter(Boolean).join(' – ')})</span>}
                  </div>
                  <Bullets items={e.bullets} />
                </div>
              ))}
            </Section>
          )}

          {!!cv.projects?.length && (
            <Section title="Projects">
              {cv.projects.map((p, i) => (
                <div key={i} className="mb-2">
                  <div>
                    <b>{p.name}</b>
                    {p.tech?.length ? ` — ${p.tech.join(', ')}` : ''}
                    {p.link && <span className="text-[#555]"> {p.link}</span>}
                  </div>
                  <Bullets items={p.bullets} />
                </div>
              ))}
            </Section>
          )}

          {!!cv.education?.length && (
            <Section title="Education">
              {cv.education.map((e, i) => (
                <div key={i} className="mb-1.5">
                  <div>
                    <b>{e.degree}</b> — {e.institution}
                    {e.location ? `, ${e.location}` : ''}
                    {(e.start || e.end) && <span className="text-[#555]"> ({[e.start, e.end].filter(Boolean).join(' – ')})</span>}
                  </div>
                  {e.details && <div className="text-[11.5px] text-[#333]">{e.details}</div>}
                </div>
              ))}
            </Section>
          )}

          {!!cv.certifications?.length && (
            <Section title="Certifications">
              <Bullets items={cv.certifications} />
            </Section>
          )}
          {!!cv.achievements?.length && (
            <Section title="Achievements">
              <Bullets items={cv.achievements} />
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3.5">
      <div className="mb-1 border-b border-[#ddd] pb-0.5 text-[11px] font-bold uppercase tracking-wider text-black">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function Bullets({ items }: { items?: string[] }) {
  if (!items?.length) return null
  return (
    <ul className="ml-4 list-disc space-y-0.5">
      {items.map((b, i) => (
        <li key={i}>{b}</li>
      ))}
    </ul>
  )
}
