import { siteDescription } from "@/lib/siteMetadata";
import { Sparkles, ChevronRight, Shield, Cpu, HardDrive, Github } from "lucide-react";

const SHELL_POINTS = [
  {
    icon: Shield,
    label: "Private by default",
    detail: "Prompts and responses stay on your device.",
  },
  {
    icon: Cpu,
    label: "WebGPU first",
    detail: "Automatic WASM fallback when acceleration is unavailable.",
  },
  {
    icon: HardDrive,
    label: "Zero backend",
    detail: "No Python. No CUDA. No server roundtrip.",
  },
];

export default function Home() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#212121] text-[#ececec]">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-6 py-8 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#10a37f]">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">llame</p>
              <p className="text-xs uppercase tracking-[0.18em] text-[#8e8e8e]">In-browser AI</p>
            </div>
          </div>
          <a
            href="https://github.com/tsilva/llame"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub repository"
            title="GitHub repository"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] text-[#b4b4b4] transition-colors hover:border-white/[0.16] hover:text-white"
          >
            <Github size={18} />
          </a>
        </header>

        <section className="flex flex-1 items-center py-12 sm:py-16">
          <div className="grid w-full gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:gap-12">
            <div className="max-w-2xl">
              <p className="mb-4 inline-flex rounded-full border border-[#10a37f]/25 bg-[#10a37f]/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[#7ee7c7]">
                Private inference in one URL
              </p>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Run private AI models directly in your browser.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[#b4b4b4] sm:text-lg">
                {siteDescription}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/chat"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#10a37f] px-5 py-3 text-sm font-medium text-[#081412] transition-transform hover:translate-y-[-1px] hover:bg-[#12b58b]"
                >
                  Launch app
                  <ChevronRight size={16} />
                </a>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/[0.08] bg-[#171717] p-5">
              <div className="rounded-2xl border border-white/[0.08] bg-[#212121] p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[#8e8e8e]">
                  Ready state
                </div>
                <div className="mt-4 rounded-2xl border border-white/[0.08] bg-[#171717] p-4">
                  <p className="text-sm text-[#8e8e8e]">Default model</p>
                  <p className="mt-1 text-lg font-medium text-white">Qwen3.5 0.8B</p>
                  <p className="mt-3 text-sm leading-6 text-[#b4b4b4]">
                    Open the full chat workspace only when you need it. This keeps the landing page fast on mobile while leaving the full local inference stack one tap away.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {SHELL_POINTS.map(({ icon: Icon, label, detail }) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-[#10a37f]">
                        <Icon size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{label}</p>
                        <p className="text-sm text-[#8e8e8e]">{detail}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
