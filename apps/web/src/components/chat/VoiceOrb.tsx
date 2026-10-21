import { useEffect, useRef } from "react";
import type { VoiceStatus } from "../../features/useVoiceSession";

export function VoiceOrb({ status }: { status: VoiceStatus }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let animation = 0;
    const particles = Array.from({ length: 180 }, (_, index) => ({
      angle: (index / 180) * Math.PI * 2,
      radius: 0.25 + ((index * 37) % 100) / 180,
      depth: ((index * 17) % 100) / 100,
    }));
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const size = Math.min(canvas.clientWidth, canvas.clientHeight);
      canvas.width = size * ratio;
      canvas.height = size * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const draw = () => {
      const size = Math.min(canvas.clientWidth, canvas.clientHeight);
      const center = size / 2;
      const motion = reduced ? 0 : status === "speaking" ? 1.6 : status === "processing" ? 1.1 : status === "listening" ? 0.8 : 0.3;
      context.clearRect(0, 0, size, size);
      const glow = context.createRadialGradient(center, center, size * 0.05, center, center, size * 0.47);
      glow.addColorStop(0, "rgba(47, 211, 238, .22)");
      glow.addColorStop(0.5, "rgba(50, 111, 255, .12)");
      glow.addColorStop(1, "rgba(124, 58, 237, 0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, size, size);
      particles.forEach((particle, index) => {
        const wave = Math.sin(particle.angle * 4 + frame * 0.018 * motion + particle.depth * 5) * 0.035;
        const radius = size * (particle.radius + wave);
        const x = center + Math.cos(particle.angle + frame * 0.002 * motion) * radius;
        const y = center + Math.sin(particle.angle + frame * 0.002 * motion) * radius * 0.72;
        const alpha = 0.28 + particle.depth * 0.62;
        context.fillStyle = index % 7 === 0 ? `rgba(168, 85, 247, ${alpha})` : `rgba(34, 211, 238, ${alpha})`;
        context.beginPath();
        context.arc(x, y, 0.8 + particle.depth * 1.8, 0, Math.PI * 2);
        context.fill();
      });
      frame += 1;
      animation = requestAnimationFrame(draw);
    };
    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animation);
      window.removeEventListener("resize", resize);
    };
  }, [status]);

  return <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />;
}
