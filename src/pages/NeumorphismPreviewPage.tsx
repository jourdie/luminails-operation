import { useState } from 'react'
import { BarChart3, Bell, CheckCircle2, ChevronDown, CircleAlert, Filter, LayoutDashboard, MoreHorizontal, Package, Search, Settings2, ShoppingBag, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { InView } from '../components/motion/InView'
import { TextEffect } from '../components/motion/TextEffect'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Orders', icon: ShoppingBag },
  { label: 'Inventory', icon: Package },
  { label: 'Supplier Deposit', icon: Wallet },
  { label: 'Finance', icon: BarChart3 },
  { label: 'Reports', icon: BarChart3 }
]

const inventoryRows = [
  { sku: 'LUM-OIL-10', name: 'Cuticle Oil 10 ml', stock: '39', status: 'Sehat', tone: 'ok' },
  { sku: 'GEL-BASE-15', name: 'Gel Base 15 ml', stock: '10', status: 'Perlu restock', tone: 'warning' },
  { sku: 'ACC-FILE-01', name: 'Nail File Premium', stock: '116', status: 'Sehat', tone: 'ok' }
]

export function NeumorphismPreviewPage() {
  const [activeItem, setActiveItem] = useState('Dashboard')
  return <div className="neo-canvas min-h-screen">
    <div className="mx-auto flex min-h-screen max-w-[1600px]">
      <aside className="neo-sidebar hidden w-72 shrink-0 flex-col px-6 py-7 lg:flex">
        <div className="flex items-start justify-between">
          <div><p className="font-display text-2xl font-bold tracking-tight text-[#383033]">Luminails</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#a5665b]">Ops workspace</p></div>
          <div className="neo-inset flex h-9 w-9 items-center justify-center rounded-xl text-[#9b665c]"><Settings2 className="h-4 w-4" /></div>
        </div>
        <div className="neo-inset mt-9 rounded-2xl px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#a89e98]">Workspace</p><div className="mt-2 flex items-center justify-between"><span className="text-sm font-semibold">Luminails Ops</span><ChevronDown className="h-4 w-4 text-[#a89e98]" /></div></div>
        <nav className="mt-9 flex-1 space-y-2" aria-label="Preview navigation">{navItems.map(({ label, icon: Icon }) => <button key={label} type="button" onClick={() => setActiveItem(label)} className={`neo-focus relative flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${activeItem === label ? 'neo-raised text-[#8f5e54]' : 'text-[#756c68] hover:text-[#4c4244]'}`}><Icon className="h-4 w-4" />{label}{label === 'Inventory' && <span className="ml-auto rounded-full bg-[#e4b4a7] px-2 py-0.5 text-[10px] text-[#6f4039]">2</span>}</button>)}</nav>
        <div className="neo-raised rounded-2xl p-4"><div className="flex items-center gap-3"><div className="neo-inset flex h-9 w-9 items-center justify-center rounded-full bg-[#e9b9ad] text-sm font-bold text-[#71453d]">L</div><div className="min-w-0"><p className="truncate text-sm font-bold">Luminails Ops</p><p className="text-xs text-[#9a8f89]">Owner account</p></div></div></div>
      </aside>

      <main className="min-w-0 flex-1 px-5 py-5 md:px-10 md:py-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 lg:hidden"><div className="neo-raised flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold">L</div><span className="font-display text-xl font-bold">Luminails</span></div>
          <div className="hidden items-center gap-3 text-sm text-[#887d77] lg:flex"><span className="h-2 w-2 rounded-full bg-[#63aa82]" /> Preview mode <span className="neo-chip">Neumorphism</span></div>
          <div className="ml-auto flex items-center gap-3"><button type="button" className="neo-focus neo-raised flex h-10 w-10 items-center justify-center rounded-xl text-[#796e69]" aria-label="Notifikasi"><Bell className="h-4 w-4" /></button><div className="neo-raised flex items-center gap-3 rounded-2xl px-3 py-2"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8b5aa] text-xs font-bold text-[#71453d]">L</div><div className="hidden text-left sm:block"><p className="text-xs font-bold">Owner Luminails</p><p className="text-[10px] text-[#9a8f89]">Local workspace</p></div></div></div>
        </header>

        <div className="mt-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div><p className="neo-eyebrow">Warm tactile operations</p><h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-[#383033] md:text-5xl"><TextEffect>Clarity with a softer touch.</TextEffect></h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#756c68]">Eksplorasi neumorphism untuk Luminails Ops: lebih lembut secara visual, tetap tegas untuk keputusan operasional.</p></div>
          <div className="neo-inset rounded-2xl px-4 py-3 text-sm text-[#756c68]"><span className="font-semibold text-[#4c4244]">1 - 7 Oktober 2026</span><span className="mx-2 text-[#b4aaa4]">·</span> local preview</div>
        </div>

        <section className="mt-8 grid gap-5 xl:grid-cols-3">
          <NeoMetric label="Operating Profit" value="Rp 18,4 jt" detail="vs periode sebelumnya" change="+12,8%" tone="blush" />
          <NeoMetric label="Business Position" value="Rp 246,8 jt" detail="assets dikurangi liabilities" change="+4,2%" tone="sage" />
          <NeoMetric label="Inventory Health" value="92%" detail="3 SKU dipantau" change="Stabil" tone="linen" />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <InView><div className="neo-raised rounded-[28px] p-6 md:p-7"><div className="flex items-start justify-between"><div><p className="neo-eyebrow">Operating profit</p><h2 className="mt-2 font-display text-2xl font-bold">Profit berjalan</h2></div><button type="button" className="neo-focus neo-button rounded-xl px-3 py-2 text-xs font-bold text-[#8f5e54]">Lihat detail</button></div><div className="mt-8 flex items-end justify-between gap-4"><div><p className="font-display text-4xl font-bold text-[#383033]">Rp 18,4 jt</p><p className="mt-2 text-sm text-[#8f837d]">Periode 1 - 7 Oktober 2026</p></div><div className="neo-inset rounded-2xl px-4 py-3 text-right"><p className="text-xs text-[#9a8f89]">Margin</p><p className="mt-1 text-lg font-bold text-[#5f9876]">24,8%</p></div></div><div className="mt-8 h-24 rounded-2xl bg-[#e9e4df] p-3 shadow-[inset_3px_3px_8px_#d8d1cb,inset_-3px_-3px_8px_#fff]"><div className="flex h-full items-end gap-2">{[32, 42, 35, 58, 48, 72, 84, 76, 92, 88, 100, 94].map((height, index) => <motion.div key={index} initial={{ height: 0 }} animate={{ height: `${height}%` }} transition={{ delay: index * 0.04, duration: 0.45 }} className="flex-1 rounded-t-lg bg-gradient-to-t from-[#c58b7d] to-[#e9b9ad]" />)}</div></div></div></InView>
          <InView><div className="neo-raised rounded-[28px] p-6 md:p-7"><div className="flex items-start justify-between"><div><p className="neo-eyebrow">Action alerts</p><h2 className="mt-2 font-display text-2xl font-bold">Perlu ditindaklanjuti</h2></div><CircleAlert className="h-5 w-5 text-[#b87366]" /></div><div className="mt-6 space-y-3"><AlertRow icon={CircleAlert} title="Deposit PARTY menipis" detail="Estimasi 5 hari lagi" tone="warning" /><AlertRow icon={Package} title="2 SKU perlu restock" detail="Inventory dan SKU" tone="danger" /><AlertRow icon={CheckCircle2} title="Rekonsiliasi siap ditinjau" detail="3 transaksi hari ini" tone="ok" /></div></div></InView>
        </section>

        <section className="neo-raised mt-6 rounded-[28px] p-6 md:p-7"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="neo-eyebrow">Inventory overview</p><h2 className="mt-2 font-display text-2xl font-bold">Stock yang perlu diperhatikan</h2></div><div className="flex gap-2"><button type="button" className="neo-focus neo-inset flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-[#756c68]"><Filter className="h-3.5 w-3.5" /> Filter</button><button type="button" className="neo-focus neo-button flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-[#8f5e54]"><Search className="h-3.5 w-3.5" /> Cari SKU</button></div></div><div className="mt-6 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-[#dcd5cf] text-xs text-[#9a8f89]"><th className="pb-3 font-semibold">SKU</th><th className="pb-3 font-semibold">Produk</th><th className="pb-3 font-semibold">Actual stock</th><th className="pb-3 font-semibold">Status</th><th className="pb-3 text-right font-semibold">Aksi</th></tr></thead><tbody>{inventoryRows.map((row) => <tr key={row.sku} className="border-b border-[#e1dbd6] last:border-0"><td className="py-4 font-bold text-[#5d5250]">{row.sku}</td><td className="py-4 text-[#756c68]">{row.name}</td><td className="py-4 font-display text-lg font-bold text-[#383033]">{row.stock}</td><td className="py-4"><span className={`neo-chip ${row.tone === 'warning' ? 'neo-chip-warning' : 'neo-chip-ok'}`}>{row.status}</span></td><td className="py-4 text-right"><button type="button" className="neo-focus neo-inset inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#8f837d]" aria-label={`Aksi ${row.sku}`}><MoreHorizontal className="h-4 w-4" /></button></td></tr>)}</tbody></table></div></section>

        <section className="mt-6 flex flex-col justify-between gap-4 rounded-[28px] border border-[#d9d1cb] bg-[#e9e4df] p-5 shadow-[inset_3px_3px_8px_#d8d1cb,inset_-3px_-3px_8px_#fff] md:flex-row md:items-center md:px-7"><div><p className="neo-eyebrow">Direction summary</p><p className="mt-2 text-sm text-[#756c68]">Neumorphism dipakai sebagai depth cue, bukan pengganti hierarchy data.</p></div><Link to="/" className="neo-focus neo-button inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-bold text-[#8f5e54]">Kembali ke UI utama</Link></section>
      </main>
    </div>
  </div>
}

function NeoMetric({ label, value, detail, change, tone }: { label: string; value: string; detail: string; change: string; tone: 'blush' | 'sage' | 'linen' }) {
  return <InView><motion.article whileHover={{ y: -3 }} transition={{ duration: 0.2 }} className={`neo-raised rounded-[24px] p-6 ${tone === 'blush' ? 'neo-tint-blush' : tone === 'sage' ? 'neo-tint-sage' : ''}`}><div className="flex items-start justify-between"><p className="text-sm font-semibold text-[#756c68]">{label}</p><span className="text-xs font-bold text-[#6d9d7d]">{change}</span></div><p className="mt-6 font-display text-3xl font-bold tracking-tight text-[#383033]">{value}</p><p className="mt-2 text-xs text-[#9a8f89]">{detail}</p></motion.article></InView>
}

function AlertRow({ icon: Icon, title, detail, tone }: { icon: typeof CircleAlert; title: string; detail: string; tone: 'warning' | 'danger' | 'ok' }) {
  return <button type="button" className="neo-focus flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:translate-x-0.5"><span className={`neo-inset flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone === 'ok' ? 'text-[#609476]' : tone === 'danger' ? 'text-[#b56b5e]' : 'text-[#b38348]'}`}><Icon className="h-4 w-4" /></span><span className="min-w-0"><span className="block text-sm font-bold text-[#514748]">{title}</span><span className="mt-1 block text-xs text-[#9a8f89]">{detail}</span></span></button>
}
