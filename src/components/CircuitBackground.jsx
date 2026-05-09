import { useEffect, useRef } from 'react';

export function CircuitBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationId;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let filaments = [];
    let nodes = [];
    const GRID = 72;
    const GOLD = '212,169,65';

    function buildScene() {
      const span = Math.max(width, height);
      filaments = [
        { y: height * 0.18, amp: 28, speed: 0.00018, phase: 0.2, alpha: 0.26 },
        { y: height * 0.38, amp: 44, speed: 0.00014, phase: 1.7, alpha: 0.18 },
        { y: height * 0.66, amp: 36, speed: 0.00016, phase: 3.1, alpha: 0.2 },
      ];

      nodes = [];
      const points = [
        [0.18, 0.22], [0.34, 0.16], [0.62, 0.2], [0.82, 0.3],
        [0.22, 0.54], [0.48, 0.48], [0.72, 0.58], [0.88, 0.72],
        [0.14, 0.78], [0.38, 0.82], [0.66, 0.78],
      ];
      points.forEach(([x, y], index) => {
        nodes.push({
          x: x * width,
          y: y * height,
          radius: 1.4 + (index % 3) * 0.7,
          phase: index * 0.73,
          orbit: span * (0.006 + (index % 4) * 0.002),
        });
      });
    }

    function drawGrid(time) {
      ctx.save();
      ctx.lineWidth = 1;
      for (let x = 0; x <= width + GRID; x += GRID) {
        const alpha = x % (GRID * 3) === 0 ? 0.055 : 0.026;
        ctx.strokeStyle = `rgba(212,169,65,${alpha})`;
        ctx.beginPath();
        ctx.moveTo(x + Math.sin(time * 0.00012 + x * 0.01) * 3, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height + GRID; y += GRID) {
        const alpha = y % (GRID * 3) === 0 ? 0.05 : 0.024;
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y + Math.cos(time * 0.00012 + y * 0.01) * 3);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawLensMotifs(time) {
      const cx = width * 0.72;
      const cy = height * 0.42;
      const base = Math.min(width, height) * 0.26;
      ctx.save();
      ctx.lineWidth = 1;
      [0, 1, 2].forEach(i => {
        const r = base + i * 42;
        const start = time * 0.00008 + i * 0.7;
        ctx.strokeStyle = `rgba(${GOLD},${0.07 - i * 0.012})`;
        ctx.beginPath();
        ctx.arc(cx, cy, r, start, start + Math.PI * 0.72);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, r, start + Math.PI * 1.08, start + Math.PI * 1.58);
        ctx.stroke();
      });

      ctx.strokeStyle = `rgba(${GOLD},0.05)`;
      ctx.strokeRect(width * 0.08, height * 0.16, width * 0.24, height * 0.18);
      ctx.strokeRect(width * 0.68, height * 0.62, width * 0.2, height * 0.16);
      ctx.restore();
    }

    function drawFilaments(time) {
      filaments.forEach((line, index) => {
        ctx.save();
        ctx.lineWidth = index === 0 ? 1.4 : 1;
        ctx.strokeStyle = `rgba(${GOLD},${line.alpha})`;
        ctx.shadowColor = `rgba(${GOLD},0.28)`;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        for (let x = -40; x <= width + 40; x += 28) {
          const progress = x / Math.max(width, 1);
          const y =
            line.y +
            Math.sin(progress * Math.PI * 2.3 + line.phase + time * line.speed) * line.amp +
            Math.cos(progress * Math.PI * 5.1 + time * line.speed * 0.7) * (line.amp * 0.22);
          if (x === -40) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();

        const pulseX = ((time * (0.018 + index * 0.006)) % (width + 180)) - 90;
        const progress = pulseX / Math.max(width, 1);
        const pulseY =
          line.y +
          Math.sin(progress * Math.PI * 2.3 + line.phase + time * line.speed) * line.amp +
          Math.cos(progress * Math.PI * 5.1 + time * line.speed * 0.7) * (line.amp * 0.22);
        const gradient = ctx.createRadialGradient(pulseX, pulseY, 0, pulseX, pulseY, 34);
        gradient.addColorStop(0, `rgba(${GOLD},0.5)`);
        gradient.addColorStop(1, `rgba(${GOLD},0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(pulseX, pulseY, 34, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function drawNodes(time) {
      nodes.forEach((node, index) => {
        const x = node.x + Math.sin(time * 0.00025 + node.phase) * node.orbit;
        const y = node.y + Math.cos(time * 0.0002 + node.phase) * node.orbit;
        const alpha = 0.16 + Math.sin(time * 0.001 + node.phase) * 0.08;

        if (index > 0) {
          const prev = nodes[index - 1];
          ctx.strokeStyle = `rgba(${GOLD},0.045)`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(x, y);
          ctx.stroke();
        }

        ctx.fillStyle = `rgba(${GOLD},${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, node.radius, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function resize() {
      width = document.documentElement.clientWidth || window.innerWidth;
      height = document.documentElement.clientHeight || window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildScene();
    }

    function draw(time = 0) {
      ctx.clearRect(0, 0, width, height);
      drawGrid(time);
      drawLensMotifs(time);
      drawFilaments(time);
      drawNodes(time);
      animationId = requestAnimationFrame(draw);
    }

    // Use setTimeout to ensure DOM is fully laid out
    // before reading viewport dimensions
    const initTimer = setTimeout(() => {
      resize();
      draw();
    }, 100);

    window.addEventListener('resize', resize);

    return () => {
      clearTimeout(initTimer);
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

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
        opacity: 0.62,
        display: 'block',
      }}
    />
  );
}
