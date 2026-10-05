// Jelzőhangok (Web Audio, a natív app rendszerhangjainak megfelelői) és böngészős értesítés.
export const SOUNDS = [
  ["glass", "Glass", [[1568, 0.18, "sine"], [2093, 0.5, "sine"]]],
  ["ping", "Ping", [[1319, 0.45, "sine"]]],
  ["hero", "Hero", [[523, 0.14, "triangle"], [659, 0.14, "triangle"], [784, 0.4, "triangle"]]],
  ["submarine", "Submarine", [[220, 0.5, "sine"], [220, 0.5, "sine"]]],
  ["funk", "Funk", [[392, 0.12, "square"], [330, 0.12, "square"], [392, 0.25, "square"]]],
  ["pop", "Pop", [[800, 0.08, "sine"]]],
  ["tink", "Tink", [[2400, 0.12, "sine"]]],
  ["bottle", "Bottle", [[330, 0.35, "sine"]]],
  ["blow", "Blow", [[196, 0.6, "triangle"]]],
  ["frog", "Frog", [[260, 0.1, "square"], [200, 0.16, "square"]]],
  ["morse", "Morse", [[880, 0.09, "sine"], [880, 0.09, "sine"], [880, 0.25, "sine"]]],
  ["purr", "Purr", [[110, 0.7, "sawtooth"]]],
  ["basso", "Basso", [[98, 0.55, "triangle"]]],
  ["sosumi", "Sosumi", [[698, 0.12, "sine"], [880, 0.12, "sine"], [1047, 0.3, "sine"]]],
];
export const NO_SOUND = "none";

let audio = null;
export function playSound(id) {
  const def = SOUNDS.find((s) => s[0] === id);
  if (!def) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    let t = audio.currentTime + 0.02;
    for (const [freq, dur, type] of def[2]) {
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = type; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.22, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(audio.destination);
      osc.start(t); osc.stop(t + dur + 0.03);
      t += dur * 0.9;
    }
  } catch { /* a hang nem kritikus */ }
}

/** Értesítés engedélyének kérése (felhasználói kattintásból). */
export async function askNotifications() {
  try { if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission(); } catch { /* nem baj */ }
}

export function notify(title, body) {
  try { if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body, icon: "icons/icon-192.png", tag: "ots-pomo" }); } catch { /* nem baj */ }
}
