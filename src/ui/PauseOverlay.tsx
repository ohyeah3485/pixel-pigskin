import { Play, RotateCcw, Home, Volume2, VolumeX } from 'lucide-react';
import { useState } from 'react';
import { audio } from '../game/audio';

interface Props {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

export function PauseOverlay({ onResume, onRestart, onQuit }: Props) {
  const [muted, setMuted] = useState(audio.muted);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="pix-panel pop-in w-full max-w-[360px] bg-[#07220f] p-5">
        <h2 className="font-pixel text-center text-[16px] text-[#aaff3c]" style={{ textShadow: '0 3px 0 #04140b' }}>
          TIMEOUT
        </h2>
        <p className="font-pixel mt-1.5 text-center text-[7px] text-[#7aa383]">CATCH YOUR BREATH, COACH</p>
        <div className="mt-5 grid gap-2.5">
          <button
            onClick={() => { audio.ensure(); audio.uiClick(); onResume(); }}
            className="pix-btn flex items-center justify-center gap-2 bg-[#1d5c33] px-3 py-3 text-[10px] text-[#b6f5c9]"
          >
            <Play size={14} /> RESUME
          </button>
          <button
            onClick={() => { audio.uiClick(); onRestart(); }}
            className="pix-btn flex items-center justify-center gap-2 bg-[#123a4f] px-3 py-3 text-[10px] text-[#4dd8ff]"
          >
            <RotateCcw size={14} /> RESTART GAME
          </button>
          <button
            onClick={() => {
              const m = !muted;
              setMuted(m);
              audio.setMuted(m);
              if (!m) audio.uiClick();
            }}
            className="pix-btn flex items-center justify-center gap-2 bg-[#3f2d12] px-3 py-3 text-[10px] text-[#ffd94d]"
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />} {muted ? 'UNMUTE' : 'MUTE'}
          </button>
          <button
            onClick={() => { audio.uiClick(); onQuit(); }}
            className="pix-btn flex items-center justify-center gap-2 bg-[#3d1120] px-3 py-3 text-[10px] text-[#ff8b9b]"
          >
            <Home size={14} /> QUIT TO MENU
          </button>
        </div>
        <div className="font-pixel mt-4 border-3 border-[#123a1e] bg-[#05160b] p-2.5 text-center text-[7px] leading-relaxed text-[#6d9a76]" style={{ borderWidth: 3 }}>
          SPACE SNAP * WASD MOVE * 1-6 PASS
          <br />
          CLICK THROW * SHIFT SPRINT * SPACE JUKE
          <br />
          ENTER GO * P PUNT * F FIELD GOAL
        </div>
      </div>
    </div>
  );
}
