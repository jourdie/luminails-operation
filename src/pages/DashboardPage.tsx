import { ArrowRight, CircleAlert, Clock3, PackageCheck, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLocalDashboardData } from '../lib/localDb'
import { MetricCard } from '../components/ui/MetricCard'
import { StatusBadge } from '../components/ui/StatusBadge'
import { InView } from '../components/motion/InView'
import { TextEffect } from '../components/motion/TextEffect'

export function DashboardPage() {
  const navigate = useNavigate()
  const [data] = useState(getLocalDashboardData)
  const alertIcons = [CircleAlert, PackageCheck, Clock3]
  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-stone-500">Jumat, 9 Oktober 2026</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl"><TextEffect>Selamat datang kembali.</TextEffect></h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">Berikut ringkasan operasi Luminails sampai hari ini.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-shell px-3 py-2 text-sm text-stone-600"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {data.period}</div>
      </div>

      <section className="grid gap-4 xl:grid-cols-2">
        <InView><MetricCard label="Operating Profit" value={data.profit.value} detail={data.profit.comparison} change={data.profit.change} direction="up" tone="blush" onClick={() => navigate('/finance/profit-loss')} /></InView>
        <InView><MetricCard label="Business Position" value={data.position.value} detail={data.position.detail} change={data.position.change} direction="up" tone="sage" onClick={() => navigate('/finance/business-position')} /></InView>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-2xl border border-stone-200 bg-shell shadow-panel">
          <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4 md:px-6">
            <div><h2 className="font-display text-lg font-semibold">Arus operasi hari ini</h2><p className="mt-1 text-sm text-stone-500">Ringkasan aktivitas yang membutuhkan perhatian.</p></div>
            <Sparkles className="h-5 w-5 text-blushDeep" aria-hidden="true" />
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-3 md:p-6">
            {data.operations.map(({ label, value, detail }) => <div key={label} className="rounded-xl bg-linen p-4"><p className="text-sm text-stone-500">{label}</p><p className="mt-3 font-display text-3xl font-semibold">{value}</p><p className="mt-1 text-xs text-stone-500">{detail}</p></div>)}
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-shell shadow-panel">
          <div className="border-b border-stone-100 px-5 py-4 md:px-6"><h2 className="font-display text-lg font-semibold">Action alerts</h2><p className="mt-1 text-sm text-stone-500">Hanya item yang bisa ditindaklanjuti.</p></div>
          <div className="divide-y divide-stone-100">
            {data.alerts.length ? data.alerts.map((alert, index) => { const Icon = alertIcons[index] ?? CircleAlert; return <button type="button" key={alert.label} onClick={() => navigate(alert.route)} className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-linen md:px-6"><div className="mt-0.5 rounded-lg bg-linen p-2"><Icon className="h-4 w-4 text-stone-600" /></div><span className="min-w-0 flex-1"><span className="block text-sm font-medium leading-5 text-ink">{alert.label}</span><span className="mt-1 block text-xs text-stone-500">{alert.detail}</span></span><ArrowRight className="mt-1 h-4 w-4 shrink-0 text-stone-400" /></button> }) : <p className="px-5 py-6 text-sm text-stone-500 md:px-6">Tidak ada alert. Data operasional terlihat tenang.</p>}
          </div>
          <div className="border-t border-stone-100 px-5 py-4 md:px-6"><StatusBadge label={`${data.alerts.length} item membutuhkan tindakan`} tone={data.alerts.length ? 'warning' : 'positive'} /></div>
        </div>
      </section>
    </div>
  )
}
