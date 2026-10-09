import { LogOut, ShieldAlert } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'

export function AccessDeniedPage() {
  const { profile, signOut } = useAuth()
  return (
    <main className="flex min-h-screen items-center justify-center bg-linen px-5 text-center text-ink">
      <section className="max-w-md rounded-[2rem] border border-stone-200 bg-shell p-8 shadow-panel">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber/70 text-amber-950"><ShieldAlert className="h-7 w-7" /></div>
        <h1 className="mt-7 font-display text-2xl font-semibold">Akun belum memiliki akses</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">Akun Google {profile?.email ? `(${profile.email}) ` : ''}belum memiliki akses ke Luminails Ops.</p>
        <button type="button" onClick={() => void signOut()} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-stone-700"><LogOut className="h-4 w-4" /> Keluar</button>
      </section>
    </main>
  )
}
