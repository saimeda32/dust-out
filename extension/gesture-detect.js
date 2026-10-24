// Snap detector over MediaPipe hand landmarks: thumb and middle finger pinch, then the middle
// finger drops to the palm within ~0.5 s.
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function makeSnapDetector() {
  let readyAt = -1e9, lastSnap = -1e9;
  return (hand, t) => {
    if (!hand) return 'none';
    const size = d(hand[0], hand[9]);
    if (size < 0.02) return 'none';
    const pinch = d(hand[4], hand[12]) / size; // thumb tip to middle tip
    const reach = d(hand[12], hand[0]) / size; // middle tip to wrist: long when straight, short when folded
    if (pinch < 0.35) { readyAt = t; return 'ready'; }
    if (t - readyAt < 450 && pinch > 0.6 && reach < 1.45 && t - lastSnap > 1500) {
      lastSnap = t; readyAt = -1e9;
      return 'snap';
    }
    return 'hand';
  };
}
