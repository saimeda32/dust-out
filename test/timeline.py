# When the demo's person visibly crumbles, is gone, starts coming back and is back, measured from
# the recorded frames. Usage: python3 test/timeline.py <frames dir> <seconds per frame>
import sys, glob, json
from PIL import Image, ImageChops

ims = [Image.open(f).convert('RGB').resize((160, 90)) for f in sorted(glob.glob(sys.argv[1] + '/f*.png'))]
step = float(sys.argv[2])
def diff(a, b, cut=28):
    d = ImageChops.difference(a, b).convert('L').point(lambda v: 255 if v > cut else 0)
    return sum(d.tobytes()) / 255 / (160 * 90)

# The empty room is the longest run of unchanging frames.
best, run = (0, 0), 0
for i in range(1, len(ims)):
    run = run + 1 if diff(ims[i], ims[i - 1], 8) < 0.001 else 0
    best = max(best, (run, i))
room = ims[best[1] - best[0] // 2]
cov = [diff(im, room) for im in ims]
full = sum(cov[:10]) / 10
gone = next(i for i, c in enumerate(cov) if c < 0.05 * full)
returning = next(i for i in range(gone, len(cov)) if cov[i] > 0.05 * full)
back = next(i for i in range(returning, len(cov)) if cov[i] > 0.9 * full)
# Crumbling shows once a frame starts to differ from the settled snap pose (hand already up).
settle = next(i for i in range(15, gone) if diff(ims[i], ims[i - 4], 40) < 0.002)
crumble = next(i for i in range(settle, gone) if diff(ims[i], ims[settle], 40) > 0.005)
t = lambda i: round(i * step, 1)
print(json.dumps({'crumble': t(crumble), 'gone': t(gone), 'return': t(returning), 'back': t(back), 'duration': t(len(ims))}))
