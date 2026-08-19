const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

function playTone(freq, type, duration, vol = 0.1) {
  initAudio();
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
  
  gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
  
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + duration);
}

export const playPlaceSound = () => {
  playTone(600, 'sine', 0.1, 0.1);
  setTimeout(() => playTone(800, 'sine', 0.15, 0.1), 50);
};

export const playRemoveSound = () => {
  playTone(400, 'sine', 0.1, 0.1);
  setTimeout(() => playTone(300, 'sine', 0.15, 0.1), 50);
};

export const playErrorSound = () => {
  playTone(150, 'sawtooth', 0.3, 0.05);
};

export const playWinSound = () => {
  initAudio();
  // Bright A major arpeggio
  const notes = [440, 554.37, 659.25, 880]; 
  notes.forEach((freq, i) => {
    setTimeout(() => {
      playTone(freq, 'triangle', 0.3, 0.1);
    }, i * 100);
  });
};

export const playHintSound = () => {
  playTone(880, 'sine', 0.1, 0.1);
  setTimeout(() => playTone(1108.73, 'sine', 0.2, 0.1), 100);
};
