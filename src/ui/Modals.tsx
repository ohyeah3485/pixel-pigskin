import { useState } from 'react';
import { X, Rocket, Moon, Skull, Ghost, Crown, Gamepad2, Hand, Keyboard, Mouse, Swords } from 'lucide-react';
import { Mods } from '../game/types';
import { MODES } from '../game/types';
import { getScores } from '../game/highscores';
import { audio } from '../game/audio';

function Shell({ title, color, onClose, children }: { title: string; color: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020a05]/80 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="pix-panel pop-in w-full max-w-[520px] bg-[#07220f] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-pixel text-[13px]" style={{ color }}>{title}</h2>
          <button
            onClick={() => { audio.uiClick(); onClose(); }}
            className="pix-btn flex h-8 w-8 items-center justify-center bg-[#3d1120] text-[#ff8b9b]"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- MODS ---------------- */

const MOD_DEFS: { key: keyof Mods; name: string; icon: typeof Rocket; color: string; desc: string }[] = [
  { key: 'turbo', name: 'TURBO', icon: Rocket, color: '#aaff3c', desc: 'Your offense runs 18% faster. Vroom.' },
  { key: 'moonBall', name: 'MOON BALL', icon: Moon, color: '#4dd8ff', desc: 'Low gravity. Huge floaty bombs with giant hang time.' },
  { key: 'blitz', name: 'BLITZ', icon: Skull, color: '#ff4d5e', desc: 'Defense is 20% faster and sheds blocks quicker. For sadists.' },
  { key: 'bigHead', name: 'BIG HEAD', icon: Ghost, color: '#ffd94d', desc: 'Comically large helmets. Zero gameplay value, 100% style.' },
];

export function ModsModal({ mods, onChange, onClose }: { mods: Mods; onChange: (m: Mods) => void; onClose: () => void }) {
  return (
    <Shell title="GAME MODS" color="#ffd94d" onClose={onClose}>
      <div className="grid gap-2.5">
        {MOD_DEFS.map((d) => {
          const on = mods[d.key];
          const Icon = d.icon;
          return (
            <button
              key={d.key}
              onClick={() => { audio.ensure(); audio.uiClick(); onChange({ ...mods, [d.key]: !on }); }}
              className={`mode-card flex items-center gap-3 border-3 p-3 text-left transition-colors ${
                on ? 'border-transparent bg-[#0f3319]' : 'bg-[#05160b]'
              }`}
              style={{ border: `3px solid ${on ? d.color : '#123a1e'}` }}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-[#04140b]"
                style={{ background: on ? d.color : '#0d2414' }}
              >
                <Icon size={17} color={on ? '#07140c' : '#7aa383'} strokeWidth={2.6} />
              </div>
              <div className="min-w-0">
                <div className="font-pixel flex items-center gap-2 text-[9px]" style={{ color: on ? d.color : '#7aa383' }}>
                  {d.name} {on && <span className="blink-hard">ON</span>}
                </div>
                <div className="mt-0.5 text-[13px] leading-snug text-[#b8d8bd]">{d.desc}</div>
              </div>
            </button>
          );
        })}
      </div>
      <p className="font-pixel mt-4 text-[7px] leading-relaxed text-[#5f8a66]">
        SCORES EARNED WITH MODS ARE TAGGED ON THE RECORDS BOARD.
      </p>
    </Shell>
  );
}

/* ---------------- RECORDS ---------------- */

export function ScoresModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<string>('arcade');
  const rows = getScores(tab).slice(0, 10);
  return (
    <Shell title="LOCAL LEGENDS" color="#4dd8ff" onClose={onClose}>
      <div className="flex gap-1.5">
        {(Object.keys(MODES) as (keyof typeof MODES)[])
          .filter((k) => k !== 'practice')
          .map((k) => (
            <button
              key={k}
              onClick={() => { audio.uiClick(); setTab(MODES[k].key); }}
              className={`pix-btn flex-1 px-1 py-2 text-[7px] ${
                tab === MODES[k].key ? 'bg-[#123a4f] text-[#4dd8ff]' : 'bg-[#082011] text-[#6d9a76]'
              }`}
            >
              {MODES[k].tag}
            </button>
          ))}
      </div>
      <div className="score-scroll mt-3 max-h-[280px] overflow-y-auto border-3 border-[#123a1e] bg-[#05160b]" style={{ borderWidth: 3 }}>
        {rows.length === 0 ? (
          <div className="font-pixel p-6 text-center text-[9px] leading-relaxed text-[#5f8a66]">
            NO LEGENDS YET.
            <br />
            GO SCORE SOMETHING.
          </div>
        ) : (
          rows.map((r, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 border-b border-[#0c2a15] px-3 py-2.5 ${i === 0 ? 'bg-[#0d2a14]' : ''}`}
            >
              <span className={`font-pixel w-6 text-[10px] ${i === 0 ? 'text-[#ffd94d]' : 'text-[#6d9a76]'}`}>
                {i + 1}
              </span>
              {i === 0 && <Crown size={13} className="text-[#ffd94d]" />}
              <span className="font-pixel flex-1 text-[10px] text-[#eaffea]">{r.i}</span>
              {r.m && <span className="font-pixel border border-[#1d5c33] px-1 py-0.5 text-[7px] text-[#9fce9f]">{r.m}</span>}
              <span className="text-[10px] text-[#5f8a66]">
                {new Date(r.d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
              <span className={`font-pixel text-[11px] ${i === 0 ? 'text-[#ffd94d]' : 'text-[#aaff3c]'}`}>{r.s}</span>
            </div>
          ))
        )}
      </div>
    </Shell>
  );
}

/* ---------------- HELP ---------------- */

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-[#0c2a15] py-2">
      <span className="font-pixel w-32 shrink-0 text-[8px] leading-relaxed text-[#ffd94d]">{k}</span>
      <span className="text-[13px] leading-snug text-[#c9dec9]">{v}</span>
    </div>
  );
}

export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Shell title="PLAYBOOK" color="#b6f5c9" onClose={onClose}>
      <div className="score-scroll max-h-[70vh] overflow-y-auto pr-1">
        <div className="mb-3 flex items-center gap-2 text-[#9fce9f]">
          <Gamepad2 size={15} />
          <span className="font-pixel text-[8px]">BUILT FOR KEYBOARD + MOUSE</span>
        </div>
        <div className="mb-1 flex items-center gap-2 text-[#9fce9f]">
          <Mouse size={13} /> <span className="font-pixel text-[8px]">MOUSE (PASSING)</span>
        </div>
        <Row k="POINT" v="Aim in a receiver's direction — the game locks him and brackets him" />
        <Row k="REACH FURTHER" v="Push past him to lead him deep, pull back for a back-shoulder ball" />
        <Row k="LEFT CLICK" v="Throw. The pass is auto-led so he runs onto it in stride" />
        <Row k="RIGHT CLICK" v="Tuck it and scramble" />

        <div className="mb-1 mt-4 flex items-center gap-2 text-[#9fce9f]">
          <Keyboard size={13} /> <span className="font-pixel text-[8px]">KEYBOARD (SIDE VIEW)</span>
        </div>
        <Row k="SPACE" v="Snap the ball / kick" />
        <Row k="A / D" v="Move back and forward down the field" />
        <Row k="W / S" v="Move across the field (toward either sideline)" />
        <Row k="SHIFT" v="Sprint — burns gas but helps you break tackles" />
        <Row k="1 - 6" v="Instant bullet to that numbered receiver" />
        <Row k="ENTER / P / F" v="4th down: Go for it / Punt / Field goal" />
        <Row k="K / G" v="Extra point: Kick or Go for 2" />
        <Row k="ESC" v="Pause" />
        <Row k="M" v="Mute" />

        <div className="mb-1 mt-4 flex items-center gap-2 text-[#9fce9f]">
          <Swords size={13} /> <span className="font-pixel text-[8px]">1 V 1 DRILL</span>
        </div>
        <Row k="P1: WASD + F" v="Move. As the WR, F calls for the ball" />
        <Row k="P2: IJKL + P" v="Second player on the same keyboard. As the WR, P calls for the ball" />
        <Row k="A / D or J / L" v="Choose the WR's route before the snap" />
        <Row k="TACKLES" v="Contact-only now — if the defender runs into the carrier, the tackle happens" />

        <div className="mb-1 mt-4 flex items-center gap-2 text-[#9fce9f]">
          <Hand size={13} /> <span className="font-pixel text-[8px]">TOUCH</span>
        </div>
        <Row k="DRAG + RELEASE" v="Aim and throw" />
        <Row k="DRAG (RUNNING)" v="Virtual joystick steering" />

        <div className="mt-4 border-3 border-[#5c1d26] bg-[#1d0a0e] p-3" style={{ borderWidth: 3 }}>
          <div className="font-pixel text-[8px] leading-relaxed text-[#ff9f3c]">FATIGUE</div>
          <p className="mt-1.5 text-[13px] leading-snug text-[#e3c3c3]">
            Everybody has a <b className="text-[#aaff3c]">GAS</b> meter. Hard running drains it, sprinting drains it
            fast, and coasting refills it. Below half speed you start losing your legs. A clean dive tackle costs a
            little — <b className="text-[#ff4d5e]">whiffing one costs 38%</b> and leaves you face-down and off balance.
            Hit zero and you're <b className="text-[#ff4d5e]">BLOWN UP</b>: hands on knees, half speed, no tackling
            until you catch your breath. Gas also carries between drill reps.
          </p>
        </div>

        <div className="mt-3 border-3 border-[#3f2d12] bg-[#1a1205] p-3" style={{ borderWidth: 3 }}>
          <div className="font-pixel text-[8px] leading-relaxed text-[#ffd94d]">TACKLING</div>
          <p className="mt-1.5 text-[13px] leading-snug text-[#d8c9a8]">
            In the main game defenders bring you down on contact — sprint into a hit and you can
            <b className="text-[#ffd94d]"> break the first tackle</b>, but two or more defenders will wrap you up. In the
            1v1 drill the defender must <b className="text-[#ff4d5e]">commit to a dive</b>: get within range and you
            launch, wrap and drive the carrier backwards. Launch early and you sail past him, land on your face and burn
            a huge chunk of gas.
          </p>
        </div>

        <div className="mt-3 border-3 border-[#123a1e] bg-[#05160b] p-3" style={{ borderWidth: 3 }}>
          <div className="font-pixel text-[8px] leading-relaxed text-[#aaff3c]">READING THE COVERAGE</div>
          <p className="mt-1.5 text-[13px] leading-snug text-[#c9dec9]">
            The ring under each receiver and the colour of your reticle predict how open he'll be{' '}
            <b className="text-[#ffd94d]">when the ball actually arrives</b> — not where he is right now. Green means he
            wins the catch point, red means a defender beats him to it. Trust it:{' '}
            <b className="text-[#aaff3c]">open throws are caught ~97%</b> of the time, while forcing it into a red window
            gets batted down or picked more often than not.
          </p>
          <p className="mt-2 text-[13px] leading-snug text-[#c9dec9]">
            Corners play real technique — press jam, backpedal with a cushion, then flip their hips and run in trail
            once you threaten them. Beat a man cleanly and he <b className="text-[#ffd94d]">stays beaten</b>. Defenders
            also have to read the throw: one who breaks early and gets there can take it away, but one who's late can
            only chase you down after the catch. The shells (<b className="text-[#ffd94d]">Man Press, Cover 2, Cover 3,
            All-Out Blitz</b>) stay hidden until the snap.
          </p>
        </div>
      </div>
    </Shell>
  );
}
