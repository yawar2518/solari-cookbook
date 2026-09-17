import Link from 'next/link'
import { ArrowRight, BrainCircuit, Radar, ScrollText, ShieldCheck, Sparkles, Target } from 'lucide-react'
import { HeroDemo } from '@/components/landing/HeroDemo'
import { PricingSection } from '@/components/landing/PricingSection'
import { SiteFooter, SiteNav } from '@/components/landing/SiteNav'
import { createClient } from '@/lib/supabase/server'

export default async function LandingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const signedIn = !!user
  const cta = signedIn ? '/search' : '/auth?mode=signup'

  return (
    <div className="bg-aurora">
      <SiteNav signedIn={signedIn} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-grid">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:pb-28 lg:pt-24">
          <div className="fade-up">
            <div className="pill pill-primary mb-5">
              <Sparkles size={12} /> fyt · find your fit · live listings
            </div>
            <h1 className="text-4xl font-bold leading-[1.08] sm:text-5xl lg:text-[3.4rem]">
              Find opportunities that <span className="text-gradient">actually fit you.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-muted sm:text-lg">
              Tell fyt about yourself in plain English — your semester, your projects, what you&apos;re unsure about. It infers your real
              level, searches live listings, and ranks every one by fit with an honest reason why.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={cta} className="btn btn-primary h-11 px-6 text-sm">
                {signedIn ? 'Find my matches' : 'Sign up free — 10 searches included'} <ArrowRight size={16} />
              </Link>
              <Link href="#how" className="btn btn-ghost h-11 px-6 text-sm">
                See how it works
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-dim">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-accent" /> No filters to configure
              </span>
              <span className="flex items-center gap-1.5">
                <Radar size={14} className="text-accent" /> Listings from the last 24h
              </span>
              <span className="flex items-center gap-1.5">
                <Target size={14} className="text-accent" /> Scores you can argue with
              </span>
            </div>
          </div>
          <div className="fade-up" style={{ animationDelay: '0.15s' }}>
            <HeroDemo />
          </div>
        </div>
      </section>

      {/* Respect the spectrum */}
      <section className="border-y border-line-soft bg-surface/30">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-14 sm:px-8 md:grid-cols-3">
          {[
            {
              who: '2nd semester, no experience',
              gets: 'Entry-level internships that want curiosity and a couple of course projects — not a portfolio you don’t have yet.',
            },
            {
              who: '7th semester + freelance work',
              gets: 'Mid-level roles and paid internships where your shipped work counts. fyt won’t bury you under "junior" listings.',
            },
            {
              who: 'Switching careers',
              gets: 'Roles that value your transferable skills, with a clear read on what you still need to learn.',
            },
          ].map((c) => (
            <div key={c.who} className="card card-hover p-6">
              <div className="eyebrow text-accent">{c.who}</div>
              <p className="mt-3 text-sm leading-relaxed text-ink-2">{c.gets}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="mb-12 max-w-xl">
          <div className="eyebrow">How it works</div>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Three steps. About two minutes.</h2>
          <p className="mt-3 text-muted">No forms with forty checkboxes. fyt does the interpreting so you can do the applying.</p>
        </div>
        <ol className="relative grid gap-6 md:grid-cols-3">
          <div className="absolute left-[10%] right-[10%] top-8 hidden h-px bg-gradient-to-r from-transparent via-line to-transparent md:block" aria-hidden="true" />
          {[
            {
              n: '01',
              icon: ScrollText,
              title: 'Describe yourself',
              body: 'A paragraph in your own words. Semester, skills, projects, freelance gigs, what you want, what you’re unsure about.',
            },
            {
              n: '02',
              icon: BrainCircuit,
              title: 'fyt reads between the lines',
              body: 'Claude infers your real experience level, hidden skills (databases course → SQL), and the roles you could actually land. You confirm or edit.',
            },
            {
              n: '03',
              icon: Radar,
              title: 'Get ranked, honest matches',
              body: 'A stealth browser reads live listings. Each one gets a 0–100 fit score, why it fits, what you’d learn, and the biggest gap.',
            },
          ].map(({ n, icon: Icon, title, body }) => (
            <li key={n} className="card relative p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-sky">
                <Icon size={22} />
              </div>
              <div className="font-display text-xs font-semibold text-dim">{n}</div>
              <h3 className="mt-1 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-line-soft bg-surface/30">
        <div className="mx-auto max-w-5xl px-5 py-20 sm:px-8">
          <div className="mb-10 text-center">
            <div className="eyebrow">Pricing</div>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Free to start. Pro when you&apos;re serious.</h2>
            <p className="mx-auto mt-3 max-w-lg text-muted">Every account starts with 10 search credits and 3 cover letters. No card required.</p>
          </div>
          <PricingSection compact currentPlan={null} />
        </div>
      </section>

      {/* Testimonials placeholder */}
      <section id="stories" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="mb-10 max-w-xl">
          <div className="eyebrow">Stories</div>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Early users, in their words.</h2>
          <p className="mt-3 text-muted">We&apos;re collecting these now. If fyt helped you land something, tell us — your story goes here.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { name: 'A 3rd-semester CS student', role: 'Lahore', quote: 'It told me my databases course counted as SQL. I hadn’t even thought to write that on my CV.' },
            { name: 'A final-year SE student', role: 'Remote-first', quote: 'The “concern” line on each match is the most useful thing. It’s honest in a way job boards never are.' },
            { name: 'A career switcher', role: 'Marketing → Data', quote: 'Three searches and I had a shortlist I actually believed in. The cover letters didn’t sound like a robot.' },
          ].map((t) => (
            <figure key={t.name} className="card p-6">
              <blockquote className="text-sm leading-relaxed text-ink-2">“{t.quote}”</blockquote>
              <figcaption className="mt-4 text-xs text-muted">
                <span className="font-semibold text-ink">{t.name}</span> · {t.role}
              </figcaption>
              <div className="mt-3 pill pill-muted">Placeholder — real quotes coming</div>
            </figure>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-line-soft">
        <div className="mx-auto max-w-4xl px-5 py-20 text-center sm:px-8">
          <h2 className="text-3xl font-bold sm:text-4xl">Stop scrolling job boards that don&apos;t know you.</h2>
          <p className="mx-auto mt-3 max-w-lg text-muted">Two minutes to describe yourself. Sixty seconds to get ranked matches from live listings.</p>
          <Link href={cta} className="btn btn-primary mt-8 h-11 px-7 text-sm">
            {signedIn ? 'Go to search' : 'Sign up for free'} <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
