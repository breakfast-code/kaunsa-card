"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const scenes = [2200, 2800, 4800];
const routes = [
  { name: "Pay directly", result: "₹39+", progress: "42%", delay: 0.05 },
  { name: "Shopping portals", result: "No better match", progress: "29%", delay: 0.16 },
  { name: "Gift voucher", result: "₹195+", progress: "94%", delay: 0.27, winner: true },
];

export function LandingDemo({ onStart }: { onStart: () => void }) {
  const reduceMotion = useReducedMotion();
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(!reduceMotion);
  const isPlaying = playing && !reduceMotion;

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setTimeout(() => setScene((current) => (current + 1) % 3), scenes[scene]);
    return () => window.clearTimeout(timer);
  }, [isPlaying, scene]);

  const transition = reduceMotion ? { duration: 0 } : { duration: 0.32, ease: [0.23, 1, 0.32, 1] as const };

  return (
    <aside className="proof-demo" aria-label="Example comparing payment routes">
      <div className="proof-head">
        <div><small>SEE THE DIFFERENCE</small><strong>₹4,000 on Amazon</strong></div>
        <button className="sample-play" aria-label={isPlaying ? "Pause example" : "Play example"} onClick={() => setPlaying((current) => !current)}>{isPlaying ? "Pause" : "Play"}</button>
      </div>
      <div className="proof-progress" aria-hidden="true">
        {[0, 1, 2].map((step) => <span key={`${scene}-${step}`}><motion.i initial={{ scaleX: step < scene ? 1 : 0 }} animate={{ scaleX: step <= scene ? 1 : 0 }} transition={step === scene && isPlaying ? { duration: scenes[scene] / 1000, ease: "linear" } : { duration: 0.15 }} /></span>)}
      </div>
      <div className="proof-stage">
        <AnimatePresence mode="wait" initial={false}>
          {scene === 0 && <motion.div className="proof-scene proof-question" key="question" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={transition}><small>YOU ASK</small><strong>“I’m buying something for ₹4,000 on Amazon.”</strong></motion.div>}
          {scene === 1 && <motion.div className="proof-scene proof-race" key="race" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={transition}><small>THREE ROUTES, ONE WINNER</small><strong>Finding where your card earns more</strong><div className="route-race">{routes.map((route) => <motion.div className={`race-lane ${route.winner ? "winner" : ""}`} key={route.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ ...transition, delay: route.delay }}><div className="race-label"><span>{route.name}</span><motion.b initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: route.delay + 0.75 }}>{route.result}</motion.b></div><div className="race-track"><motion.i initial={{ width: 0 }} animate={{ width: route.progress }} transition={reduceMotion ? { duration: 0 } : { duration: 1.05, delay: route.delay + 0.15, ease: [0.23, 1, 0.32, 1] }}><span>{route.winner ? "✓" : ""}</span></motion.i></div></motion.div>)}</div></motion.div>}
          {scene === 2 && <motion.div className="proof-scene proof-answer" key="answer" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={transition}><small>BETTER WAY FOUND</small><strong>Buy an Amazon voucher through SmartBuy</strong><p>Use HDFC Infinia Metal. About three extra steps.</p><motion.div className="proof-gain" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...transition, delay: 0.12 }}><span>AT LEAST</span><b>₹156 more value</b><small>than paying directly</small></motion.div></motion.div>}
        </AnimatePresence>
      </div>
      <button className="primary proof-cta" onClick={onStart}><span>Check my cards</span><b aria-hidden="true">→</b></button>
    </aside>
  );
}
