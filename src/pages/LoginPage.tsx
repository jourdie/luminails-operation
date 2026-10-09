import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'

export function LoginPage() {
  const { authError, isDemoMode, signInWithGoogle } = useAuth()

  return (
    <main className="min-h-screen bg-linen px-5 py-8 text-ink md:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blushDeep">Luminails Ops</p>
          <h1 className="mt-6 max-w-lg font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">Ruang kerja untuk operasi yang lebih tenang.</h1>
          <p className="mt-6 max-w-md text-lg leading-8 text-stone-600">Kelola pesanan, inventory, supplier deposit, rekonsiliasi, dan keuangan dari satu sumber data yang dapat ditelusuri.</p>
          <div className="mt-9 space-y-4 text-sm text-stone-700">
            {['Posting transaksi dengan kontrol yang jelas', 'Riwayat perubahan untuk setiap keputusan penting', 'Akses kerja berdasarkan membership dan permission'].map((item) => (
              <div key={item} className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-blushDeep" /><span>{item}</span></div>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[2rem] border border-stone-200 bg-shell p-8 shadow-panel md:p-10">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-blush/35 blur-2xl" />
          <div className="relative">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blush/45"><ShieldCheck className="h-6 w-6 text-blushDeep" /></div>
            <h2 className="mt-8 font-display text-2xl font-semibold">Masuk ke workspace</h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">Gunakan akun Google yang sudah terdaftar sebagai anggota aktif Luminails.</p>
            <button type="button" onClick={() => void signInWithGoogle()} className="mt-8 flex w-full items-center justify-between rounded-xl bg-ink px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-blushDeep focus:ring-offset-2">
              <span>Masuk dengan Google</span><ArrowRight className="h-4 w-4" />
            </button>
            {isDemoMode && <p className="mt-4 rounded-lg bg-sage/50 p-3 text-xs leading-5 text-emerald-950">Mode demo aktif. Data yang tampil adalah contoh lokal dan tidak terhubung ke Supabase.</p>}
            {authError && <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-800">{authError}</p>}
            <p className="mt-8 text-center text-xs leading-5 text-stone-500">Akun Google yang valid belum tentu memiliki akses aplikasi. Akses ditentukan oleh membership workspace.</p>
          </div>
        </section>
      </div>
    </main>
  )
}
