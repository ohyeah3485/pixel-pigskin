const QB_CALLS = [
  '/Blue%2042%20Omaha.wav',
  '/ElevenLabs_2026-11-14T15_58_08_Roger%20-%20L.wav',
  '/green%2018.wav',
];

let bag: number[] = [];
let lastPlayed = -1;

export function playRandomQbCall(muted = false) {
  if (muted || typeof Audio === 'undefined') return;
  if (bag.length === 0) {
    bag = [0, 1, 2];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    const last = bag.length - 1;
    if (bag[last] === lastPlayed) [bag[0], bag[last]] = [bag[last], bag[0]];
  }
  const index = bag.pop()!;
  lastPlayed = index;
  const voice = new Audio(QB_CALLS[index]);
  voice.volume = 0.75;
  void voice.play().catch(() => {});
}
