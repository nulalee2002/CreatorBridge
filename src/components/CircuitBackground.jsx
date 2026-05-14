import { useEffect, useRef } from 'react';

export function CircuitBackground({ subdued = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationId;
    let width = 0;
    let height = 0;
    let dpr = 1;
    const GOLD = '212,169,65';
    const muted = subdued ? 0.58 : 1;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    function resize() {
      width = document.documentElement.clientWidth || window.innerWidth;
      height = document.documentElement.clientHeight || window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function fillBase() {
      const base = ctx.createLinearGradient(0, 0, width, height);
      base.addColorStop(0, 'rgba(8,8,13,0.96)');
      base.addColorStop(0.48, 'rgba(15,14,22,0.88)');
      base.addColorStop(1, 'rgba(7,7,11,0.98)');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, width, height);
    }

    function drawVignette() {
      const vignette = ctx.createRadialGradient(width * 0.5, height * 0.42, 0, width * 0.5, height * 0.42, Math.max(width, height) * 0.78);
      vignette.addColorStop(0, 'rgba(255,255,255,0)');
      vignette.addColorStop(0.62, 'rgba(0,0,0,0.12)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.74)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
    }

    function drawProductionFrames(time) {
      const drift = Math.sin(time * 0.00018) * 18;
      const frameAlpha = 0.045 * muted;
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(255,255,255,${frameAlpha})`;

      const columns = [
        { x: width * 0.06, w: width * 0.19, y: height * 0.12, h: height * 0.58 },
        { x: width * 0.72, w: width * 0.22, y: height * 0.1, h: height * 0.66 },
        { x: width * 0.34, w: width * 0.34, y: height * 0.72, h: height * 0.16 },
      ];

      columns.forEach((frame, index) => {
        const x = frame.x + drift * (index === 1 ? -0.45 : 0.28);
        const y = frame.y + Math.cos(time * 0.00016 + index) * 9;
        ctx.strokeRect(x, y, frame.w, frame.h);
        ctx.strokeStyle = `rgba(${GOLD},${0.035 * muted})`;
        ctx.beginPath();
        ctx.moveTo(x + frame.w * 0.08, y + frame.h * 0.12);
        ctx.lineTo(x + frame.w * 0.92, y + frame.h * 0.12);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${frameAlpha})`;
      });
      ctx.restore();
    }

    function drawApertureFields(time) {
      const centers = [
        { x: width * 0.22, y: height * 0.5, r: Math.min(width, height) * 0.42, spin: 1 },
        { x: width * 0.78, y: height * 0.44, r: Math.min(width, height) * 0.48, spin: -1 },
      ];

      ctx.save();
      ctx.lineWidth = 1;
      centers.forEach((center, index) => {
        for (let i = 0; i < 5; i += 1) {
          const radius = center.r + i * 58;
          const start = time * 0.00008 * center.spin + i * 0.72 + index * 0.42;
          const alpha = (0.06 - i * 0.008) * muted;
          ctx.strokeStyle = `rgba(${GOLD},${Math.max(alpha, 0.012)})`;
          ctx.beginPath();
          ctx.arc(center.x, center.y, radius, start, start + Math.PI * 0.62);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(center.x, center.y, radius, start + Math.PI * 1.08, start + Math.PI * 1.46);
          ctx.stroke();
        }
      });
      ctx.restore();
    }

    function drawLightWells(time) {
      const wells = [
        { x: width * 0.18, y: height * 0.24, size: 260, phase: 0.1 },
        { x: width * 0.52, y: height * 0.7, size: 320, phase: 1.9 },
        { x: width * 0.84, y: height * 0.32, size: 280, phase: 3.2 },
      ];

      wells.forEach(well => {
        const x = well.x + Math.sin(time * 0.00022 + well.phase) * 28;
        const y = well.y + Math.cos(time * 0.0002 + well.phase) * 20;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, well.size);
        glow.addColorStop(0, `rgba(${GOLD},${0.13 * muted})`);
        glow.addColorStop(0.26, `rgba(${GOLD},${0.045 * muted})`);
        glow.addColorStop(1, `rgba(${GOLD},0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, well.size, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function drawSignalGlass(time) {
      ctx.save();
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i += 1) {
        const y = height * (0.16 + i * 0.14);
        const control = Math.sin(time * 0.00012 + i) * 46;
        const alpha = (i % 2 === 0 ? 0.075 : 0.045) * muted;
        ctx.strokeStyle = `rgba(${GOLD},${alpha})`;
        ctx.beginPath();
        ctx.moveTo(-80, y + control * 0.3);
        ctx.bezierCurveTo(width * 0.26, y - 42 + control, width * 0.62, y + 58 - control, width + 80, y + control * 0.2);
        ctx.stroke();
      }

      const sweepX = reducedMotion ? width * 0.76 : ((time * 0.026) % (width + 460)) - 230;
      const sweep = ctx.createLinearGradient(sweepX - 160, 0, sweepX + 160, 0);
      sweep.addColorStop(0, 'rgba(255,255,255,0)');
      sweep.addColorStop(0.5, `rgba(${GOLD},${0.048 * muted})`);
      sweep.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sweep;
      ctx.fillRect(sweepX - 160, 0, 320, height);
      ctx.restore();
    }

    function drawTexture() {
      ctx.save();
      ctx.globalAlpha = 0.055 * muted;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let x = 0; x < width; x += 4) {
        for (let y = 0; y < height; y += 4) {
          if (((x * 17 + y * 31) % 23) === 0) {
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
      ctx.restore();
    }

    function draw(time = 0) {
      ctx.clearRect(0, 0, width, height);
      fillBase();
      drawLightWells(time);
      drawApertureFields(time);
      drawProductionFrames(time);
      drawSignalGlass(time);
      drawTexture();
      drawVignette();
      if (!reducedMotion) {
        animationId = requestAnimationFrame(draw);
      }
    }

    const initTimer = setTimeout(() => {
      resize();
      draw();
    }, 80);

    window.addEventListener('resize', resize);

    return () => {
      clearTimeout(initTimer);
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [subdued]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: subdued ? 0.36 : 0.78,
        filter: subdued ? 'saturate(0.68) contrast(0.9)' : 'saturate(1.04)',
        display: 'block',
      }}
    />
  );
}
