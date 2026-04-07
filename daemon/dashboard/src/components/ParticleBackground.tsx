import { useState, useEffect, useMemo } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';

export function ParticleBackground() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => setIsReady(true));
  }, []);

  // WHY: 粒子數量少、移動慢、幾乎不可見，模擬廢棄太空站的漂浮塵埃
  const options = useMemo(() => ({
    fullScreen: false,
    fpsLimit: 30,
    particles: {
      number: { value: 40, density: { enable: true } },
      color: { value: ['#1a1a1a', '#2a2a2a', '#1a1410'] },
      opacity: {
        value: { min: 0.05, max: 0.2 },
        animation: {
          enable: true,
          speed: 0.3,
          minimumValue: 0.02,
          sync: false,
        },
      },
      size: { value: { min: 0.3, max: 1.5 } },
      move: {
        enable: true,
        speed: 0.15,
        direction: 'none' as const,
        outModes: { default: 'out' as const },
      },
      // WHY: 移除粒子之間的連線，廢棄站不應有乾淨的星座圖
      links: { enable: false },
    },
    // WHY: 偶爾出現一顆明亮粒子，像遠方垂死的恆星
    emitters: {
      rate: { quantity: 1, delay: 8 },
      life: { count: 0, duration: 0.3 },
      particles: {
        color: { value: '#c4956a' },
        opacity: { value: { min: 0.4, max: 0.8 } },
        size: { value: { min: 1, max: 2.5 } },
        move: { speed: 0.08 },
        life: { duration: { value: 4 }, count: 1 },
      },
    },
    detectRetina: true,
  }), []);

  if (!isReady) return null;

  return (
    <div className="fixed inset-0 z-0">
      <Particles id="tsparticles" options={options} />
    </div>
  );
}
