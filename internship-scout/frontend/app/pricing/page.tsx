import type { Metadata } from 'next'
import { PricingSection } from '@/components/landing/PricingSection'
import { SiteFooter, SiteNav } from '@/components/landing/SiteNav'
import { createClient } from '@/lib/supabase/server'
import { serverFetch } from '@/lib/server-api'
import type { Me } from '@/lib/types'

export const metadata: Metadata = { title: 'Pricing' }

const FAQ = [
  {
    q: 'What happens when I run out of free credits?',
    a: 'Searches and cover letters pause until Pro launches or your daily limit resets. Everything you already found stays saved.',
  },
  {
    q: 'Why is Pro "coming soon"?',
    a: 'We are finishing local payment integration for Pakistan. Join the waitlist and you will get launch pricing the day it opens.',
  },
  {
    q: 'Do free cover letters use the job description?',
    a: 'Free letters are written from your profile and the role title. Pro letters read the full listing and reference specifics from it, plus suggestions for tailoring your CV.',
  },
  {
    q: 'Where do the listings come from?',
    a: 'A Solari stealth browser reads LinkedIn, Internshala, and Rozee.pk in real time. Results are cached for 6 hours so repeat searches are instant.',
  },
]

export default async function PricingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const me = user ? await serverFetch<Me>('/me') : null

  return (
    <div className="bg-aurora">
      <SiteNav signedIn={!!user} />
      <main className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
        <div className="mb-10 text-center">
          <div className="eyebrow">Pricing</div>
          <h1 className="mt-2 text-4xl font-bold sm:text-5xl">Simple, honest pricing.</h1>
          <p className="mx-auto mt-3 max-w-lg text-muted">Priced for students in Pakistan. Free covers a real job hunt; Pro removes every limit.</p>
        </div>
        <PricingSection currentPlan={me?.user.plan ?? null} />

        <section className="mt-20">
          <h2 className="text-2xl font-bold">Questions</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {FAQ.map((f) => (
              <div key={f.q} className="card p-5">
                <h3 className="text-sm font-semibold text-ink">{f.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
