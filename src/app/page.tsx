import type { Metadata } from "next";
import Link from "next/link";
import { homePageJsonLd, homePageMetadata, siteDescription, siteTagline } from "@/lib/siteMetadata";
import { Sparkles, ChevronRight, Shield, Cpu, HardDrive, Github } from "lucide-react";
import styles from "./page.module.css";

export const metadata: Metadata = homePageMetadata;

const SHELL_POINTS = [
  {
    icon: Shield,
    label: "Private by default",
    detail: "Prompts and responses stay on your device.",
  },
  {
    icon: Cpu,
    label: "WebGPU required",
    detail: "GPU-accelerated inference in supported browsers.",
  },
  {
    icon: HardDrive,
    label: "Zero backend",
    detail: "No Python. No CUDA. No server roundtrip.",
  },
];

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homePageJsonLd) }}
      />
      <main className={styles.page}>
        <div className={styles.shell}>
          <header className={styles.header}>
            <div className={styles.brand}>
              <div className={styles.brandMark}>
                <Sparkles size={18} className={styles.brandMarkIcon} />
              </div>
              <div>
                <p className={styles.brandName}>llame</p>
                <p className={styles.brandKicker}>{siteTagline}</p>
              </div>
            </div>
            <a
              href="https://github.com/tsilva/llame"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub repository"
              title="GitHub repository"
              className={styles.repoLink}
            >
              <Github size={18} />
            </a>
          </header>

          <section className={styles.heroSection}>
            <div className={styles.heroGrid}>
              <div className={styles.copyColumn}>
                <p className={styles.eyebrow}>
                  On-device ONNX via WebGPU
                </p>
                <h1 className={styles.title}>
                  {siteTagline}
                </h1>
                <p className={styles.description}>
                  {siteDescription}
                </p>
                <div className={styles.ctaRow}>
                  <Link
                    href="/chat?new=1"
                    className={styles.primaryCta}
                  >
                    Launch app
                    <ChevronRight size={16} />
                  </Link>
                </div>
              </div>

              <div className={styles.panel}>
                <div className={styles.readinessCard}>
                  <div className={styles.readinessLabel}>
                    Ready state
                  </div>
                  <div className={styles.modelCard}>
                    <p className={styles.modelLabel}>Default model</p>
                    <p className={styles.modelName}>Qwen3.5 0.8B</p>
                    <p className={styles.modelDescription}>
                      Open the full chat workspace only when you need it. This keeps the landing page fast on mobile while leaving the full local inference stack one tap away.
                    </p>
                  </div>
                </div>

                <div className={styles.pointsGrid}>
                  {SHELL_POINTS.map(({ icon: Icon, label, detail }) => (
                    <div
                      key={label}
                      className={styles.pointCard}
                    >
                      <div className={styles.pointRow}>
                        <div className={styles.pointIconWrap}>
                          <Icon size={16} />
                        </div>
                        <div>
                          <p className={styles.pointLabel}>{label}</p>
                          <p className={styles.pointDetail}>{detail}</p>
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
    </>
  );
}
