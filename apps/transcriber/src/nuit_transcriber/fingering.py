"""Where on the neck each note was played, and with which fingers.

A pitch can sound in up to five places on a guitar, so string/fret assignment is a sequence
problem. Notes are grouped into *events* (notes plucked together), every playable assignment of
an event is enumerated, and a beam search picks the path of least effort:

* moving the hand costs more the less time there is to move it;
* stretches cost more low on the neck, where frets are wide;
* re-using a string that is still ringing cuts that note short;
* moving the hand away from a fretted note that is still held releases it;
* string crossings in fast single-note runs cost a little;
* when the video shows where the hand is, distance from that position costs.

Notes that carry vibrato or a bend must be fretted. Left-hand fingers follow from the chosen hand
position (one finger per fret, barré with the index), right-hand fingers from classical practice
(p on the bass strings, i-m-a on the trebles, alternation in single-note runs).
"""

from __future__ import annotations

import math
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from functools import lru_cache
from itertools import product

from .instrument import Guitar

#: (position, confidence) observed at a time; position = fret under the index finger.
PositionPrior = Callable[[float], tuple[float | None, float]]

SPAN_COST = {0: 0.0, 1: 0.0, 2: 0.05, 3: 0.35, 4: 1.6, 5: 3.5}
W_SHIFT_BASE = 0.7  # each hand movement
W_SHIFT = 0.25  # per fret moved, scaled by how little time there is
W_HEIGHT = 0.07
W_OPEN_POSITION = 0.1  # reward for first position combined with open strings
W_FRETTED = 0.08
W_BASS_HIGH = 0.04
W_CUT = 1.2
W_RELEASE = 0.8
W_CROSS = 0.15
W_VIDEO = 1.2
W_LANDING = 0.15  # per finger above the index when a shift lands a single note
W_SLUR = 1.0  # a slur (hammer-on, pull-off, slide) played on a different string than its source


@dataclass
class FingerNote:
    """The solver's view of a note."""

    onset: float
    offset: float
    midi: int
    confidence: float = 1.0
    must_fret: bool = False  # vibrato/bend need a fretted string
    plucked: bool = True  # False for slides, hammer-ons and pull-offs (no right-hand stroke)
    harmonic_fret: int | None = None  # natural harmonic touched over this fret (12, 7, 5)
    slide: bool = False  # reached by sliding the finger along the string (the hand moves with it)
    slur_from: int | None = None  # index of the note this one is slurred from (must share its string)


@dataclass
class Event:
    index: int
    onset: float
    notes: list[int]  # indices into the note list, lowest pitch first


@dataclass
class Assignment:
    course: int | None = None
    fret: int | None = None
    string: int | None = None
    lh_finger: int | None = None
    rh_finger: str | None = None
    voice: int = 1
    event: int = 0
    barre: dict[str, int] | None = None
    flags: list[str] = field(default_factory=list)


@dataclass
class Solution:
    notes: list[Assignment]
    events: list[Event]
    positions: list[int | None]  # hand position per event (None = open strings only)
    cost: float


def group_events(
    notes: Sequence[FingerNote], tol: float = 0.035, step: float = 0.03, spread: float = 0.12
) -> list[Event]:
    """Group notes plucked together. A strum (onsets a few ms apart across strings) stays one event:
    a note joins the open event when it starts within ``tol`` of the event, or within ``step`` of the
    previous note while the event is still shorter than ``spread``."""
    order = sorted(range(len(notes)), key=lambda i: (notes[i].onset, notes[i].midi))
    events: list[Event] = []
    last_onset = -1.0
    for i in order:
        t = notes[i].onset
        if events and (
            t - events[-1].onset <= tol or (t - last_onset <= step and t - events[-1].onset <= spread)
        ):
            events[-1].notes.append(i)
        else:
            events.append(Event(index=len(events), onset=t, notes=[i]))
        last_onset = t
    for ev in events:
        ev.notes.sort(key=lambda i: notes[i].midi)
    return events


HARMONIC_INTERVAL = {12: 12, 7: 19, 5: 24}  # node fret -> semitones above the open string


@lru_cache(maxsize=4096)
def _assignments(
    midis: tuple[int, ...],
    open_midi: tuple[int, ...],
    max_fret: int,
    must_fret: tuple[bool, ...],
    harmonic: tuple[int | None, ...] | None = None,
) -> tuple[tuple[tuple[int, int], ...], ...]:
    """Every way to play ``midis`` together: distinct strings, fretted span ≤ 5. A natural harmonic
    is placed on a string whose open pitch plus the node's interval sounds the note."""
    per_note: list[list[tuple[int, int]]] = []
    harmonic = harmonic or tuple(None for _ in midis)
    for m, mf, hf in zip(midis, must_fret, harmonic, strict=True):
        if hf is not None:
            interval = HARMONIC_INTERVAL.get(hf)
            cands = [(c, hf) for c, o in enumerate(open_midi) if interval is not None and m - o == interval]
            if cands:
                per_note.append(cands)
                continue
        cands = [(c, m - o) for c, o in enumerate(open_midi) if 0 <= m - o <= max_fret]
        if mf:
            fretted = [x for x in cands if x[1] > 0]
            cands = fretted or cands
        per_note.append(cands)
    out = []
    for combo in product(*per_note):
        courses = [c for c, _ in combo]
        if len(set(courses)) != len(courses):
            continue
        frets = [f for (_, f), hf in zip(combo, harmonic, strict=True) if f > 0 and hf is None]
        if frets and max(frets) - min(frets) > 5:
            continue
        out.append(tuple(combo))
    return tuple(out)


def _pos_range(frets: list[int]) -> tuple[int, int, int] | None:
    """Feasible index-finger positions [lo, hi] for these fretted frets, and the stretch beyond 4."""
    if not frets:
        return None
    lo, hi = max(1, max(frets) - 3), min(frets)
    if lo <= hi:
        return lo, hi, 0
    return hi, hi, max(frets) - min(frets) - 3


@dataclass
class _Hyp:
    cost: float
    pos: int | None
    busy: tuple[tuple[float, int, int], ...]  # per course: (ringing until, fret, note index)
    last_single: tuple[int, float] | None  # (course, onset) of the previous single-note event
    back: _Hyp | None
    choice: tuple[tuple[int, int], ...] | None
    event_pos: int | None


def solve(
    notes: Sequence[FingerNote],
    guitar: Guitar,
    prior: PositionPrior | None = None,
    beam: int = 64,
) -> Solution:
    events = group_events(notes)
    open_midi = guitar.tuning.sounding_open_midi
    n_courses = len(open_midi)
    max_fret = guitar.geometry.fret_count - guitar.tuning.capo
    assign = [Assignment() for _ in notes]
    for ev in events:
        for i in ev.notes:
            assign[i].event = ev.index

    idle = tuple((-1.0, 0, -1) for _ in range(n_courses))
    hyps = [_Hyp(0.0, None, idle, None, None, None, None)]
    prev_onset: float | None = None
    for ev in events:
        idxs = list(ev.notes)
        # more simultaneous notes than strings: keep the most confident ones
        if len(idxs) > n_courses:
            keep = sorted(idxs, key=lambda i: -notes[i].confidence)[:n_courses]
            for i in idxs:
                if i not in keep:
                    assign[i].flags.append("unplayable-polyphony")
            idxs = sorted(keep, key=lambda i: notes[i].midi)
        options: tuple[tuple[tuple[int, int], ...], ...] = ()
        while idxs:
            options = _assignments(
                tuple(notes[i].midi for i in idxs),
                open_midi,
                max_fret,
                tuple(notes[i].must_fret for i in idxs),
                tuple(notes[i].harmonic_fret for i in idxs),
            )
            if options:
                break
            drop = min(idxs, key=lambda i: notes[i].confidence)
            assign[drop].flags.append("no-playable-position")
            idxs.remove(drop)
        ev.notes = idxs
        if not options:
            prev_onset = ev.onset
            continue
        dt = ev.onset - prev_onset if prev_onset is not None else 1.0
        speed = min(max(0.30 / max(dt, 0.04), 0.5), 4.0)
        p_video, p_conf = prior(ev.onset) if prior else (None, 0.0)
        single = len(idxs) == 1

        nxt: dict[tuple, _Hyp] = {}
        for h in hyps:
            for opt in options:
                frets = [
                    f for (_, f), i in zip(opt, idxs, strict=True) if f > 0 and notes[i].harmonic_fret is None
                ]
                rng = _pos_range(frets)
                # costs that do not depend on where the hand sits
                base = h.cost
                for (c, f), i in zip(opt, idxs, strict=True):
                    if c <= 2 and f > 7:
                        base += W_BASS_HIGH * (f - 7)
                    until, bfret, bnote = h.busy[c]
                    if bnote >= 0 and until > ev.onset + 0.06 and notes[bnote].midi != notes[i].midi:
                        base += W_CUT * min(1.0, (until - ev.onset) / 0.3)
                if single and h.last_single is not None and dt < 0.2:
                    base += W_CROSS * max(0, abs(opt[0][0] - h.last_single[0]) - 1)
                for (c, _f), i in zip(opt, idxs, strict=True):
                    src = notes[i].slur_from
                    if src is not None and not any(b[2] == src and bc == c for bc, b in enumerate(h.busy)):
                        base += W_SLUR
                if rng is not None:
                    lo, hi, stretch = rng
                    span = max(frets) - min(frets)
                    sc = SPAN_COST.get(span, 6.0)
                    if span >= 3:
                        sc *= 1.0 + 0.12 * max(0, 6 - min(frets))
                    base += sc + 1.5 * stretch + W_FRETTED * len(frets)
                    # where the hand goes is itself a decision: the smallest move, or either reach limit
                    stay = min(max(h.pos if h.pos is not None else lo, lo), hi)
                    choices: set[int | None] = {stay, lo, hi}
                else:
                    choices = {h.pos}
                busy = list(h.busy)
                for (c, f), i in zip(opt, idxs, strict=True):
                    busy[c] = (notes[i].offset, f, i)
                busy_t = tuple(busy)
                ringing = tuple((b[1] if b[0] > ev.onset + 0.1 else -1) for b in busy_t)
                last_single = (opt[0][0], ev.onset) if single else None
                used = {c for c, _ in opt}
                for pos in choices:
                    cost = base
                    if rng is not None and pos is not None:
                        if h.pos is not None and pos != h.pos:
                            if not (single and notes[idxs[0]].slide):
                                cost += W_SHIFT_BASE + W_SHIFT * abs(pos - h.pos) * speed
                            if len(frets) == 1:
                                cost += W_LANDING * (frets[0] - pos)
                        cost += W_HEIGHT * pos
                        if pos == 1 and any(f == 0 for _, f in opt):
                            cost -= W_OPEN_POSITION
                        if p_video is not None and p_conf > 0:
                            cost += min(W_VIDEO * p_conf * max(0.0, abs(pos - p_video) - 0.8) ** 2, 9.0)
                        for c, (until, bfret, bnote) in enumerate(h.busy):
                            if c in used or bnote < 0 or bfret == 0 or until <= ev.onset + 0.08:
                                continue
                            if bfret < pos or bfret > pos + 3:
                                cost += W_RELEASE * min(1.0, (until - ev.onset) / 0.3)
                    key = (pos, ringing, opt if single else None)
                    cand = _Hyp(cost, pos, busy_t, last_single, h, opt, pos if rng is not None else None)
                    if key not in nxt or cand.cost < nxt[key].cost:
                        nxt[key] = cand
        hyps = sorted(nxt.values(), key=lambda x: x.cost)[:beam]
        prev_onset = ev.onset

    best = hyps[0]
    chain: list[_Hyp] = []
    h: _Hyp | None = best
    while h is not None and h.choice is not None:
        chain.append(h)
        h = h.back
    chain.reverse()
    positions: list[int | None] = [None] * len(events)
    k = 0
    for ev in events:
        if not ev.notes:
            continue
        hyp = chain[k]
        k += 1
        positions[ev.index] = hyp.event_pos
        for (c, f), i in zip(hyp.choice or (), ev.notes, strict=True):
            assign[i].course = c
            assign[i].fret = f
            assign[i].string = guitar.string_number(c)
    _left_hand(notes, events, positions, assign)
    _right_hand(notes, events, assign, n_courses)
    return Solution(notes=assign, events=events, positions=positions, cost=best.cost)


def _left_hand(
    notes: Sequence[FingerNote],
    events: list[Event],
    positions: list[int | None],
    assign: list[Assignment],
) -> None:
    """One finger per fret from the hand position. Same-fret notes take consecutive fingers, the
    lower finger on the lower string (A, F shapes); a same-fret group at the position fret that
    other notes straddle is a barré with the index. Harmonics are touched, not pressed (finger 0)."""
    held: dict[int, tuple[float, int, int]] = {}  # course -> (until, fret, finger)
    last_finger_on: dict[int, int] = {}  # course -> finger of the latest fretted note there
    last_pos = 1
    for ev in events:
        pos = positions[ev.index] or last_pos
        if pos != last_pos:
            held = {c: h for c, h in held.items() if h[1] == 0}  # a shift releases fretted notes
        last_pos = pos
        for c in [c for c, (until, _, _) in held.items() if until <= ev.onset + 0.03]:
            del held[c]
        used = {fing for (_, _, fing) in held.values() if fing > 0}
        fretted = []
        for i in ev.notes:
            if assign[i].fret == 0 or notes[i].harmonic_fret is not None:
                assign[i].lh_finger = 0
            elif assign[i].fret is not None:
                fretted.append(i)
        by_fret: dict[int, list[int]] = {}
        for i in fretted:
            by_fret.setdefault(assign[i].fret or 0, []).append(i)
        barre = None
        low = min(by_fret) if by_fret else None
        if low is not None and len(by_fret[low]) >= 2 and low <= pos + 1:
            courses = sorted(assign[i].course or 0 for i in by_fret[low])
            higher = [assign[i].course or 0 for i in fretted if (assign[i].fret or 0) > low]
            if len(courses) >= 3 or any(courses[0] < c < courses[-1] for c in higher):
                strings = [assign[i].string or 0 for i in by_fret[low]]
                barre = {"fret": low, "fromString": max(strings), "toString": min(strings)}
        floor = 0
        for f in sorted(by_fret):
            group = sorted(by_fret[f], key=lambda i: assign[i].course or 0)
            if barre is not None and f == barre["fret"]:
                for i in group:
                    assign[i].lh_finger = 1
                    assign[i].barre = barre
                used.add(1)
                floor = 1
                continue
            for i in group:
                finger = max(min(max(f - pos + 1, 1), 4), floor + 1 if floor < 4 else 4)
                if notes[i].slide and (assign[i].course or 0) in last_finger_on:
                    finger = last_finger_on[assign[i].course or 0]  # a slide keeps its finger
                while finger in used and finger < 4:
                    finger += 1
                if finger in used:
                    assign[i].flags.append("finger-conflict")
                used.add(finger)
                assign[i].lh_finger = finger
                assign[i].barre = barre
                floor = finger
        for i in ev.notes:
            if assign[i].course is not None:
                held[assign[i].course] = (notes[i].offset, assign[i].fret or 0, assign[i].lh_finger or 0)
                if (assign[i].lh_finger or 0) > 0:
                    last_finger_on[assign[i].course] = assign[i].lh_finger or 0


def _right_hand(
    notes: Sequence[FingerNote], events: list[Event], assign: list[Assignment], n_courses: int
) -> None:
    """Classical p-i-m-a.

    * strums (4+ notes spread over 15 ms or more): one finger sweeps, ``i``;
    * the thumb takes the bass strings; in chords of 4+ notes it brushes adjacent bass strings;
    * treble strings map i/m/a upward (string 3, 2, 1), the arpeggio norm;
    * a single note on the same string as the previous plucked note alternates i/m (scales,
      repeated notes);
    * slurred notes (slides, hammer-ons, pull-offs) get no right-hand finger.
    """
    bass_courses = max(0, n_courses - 3)  # courses below this are bass strings (6, 5, 4 on six strings)
    string_finger = {n_courses - 3: "i", n_courses - 2: "m", n_courses - 1: "a"}
    last: tuple[int, str, float] | None = None  # (course, finger, onset) of the previous single plucked note
    for ev in events:
        idx = [i for i in ev.notes if assign[i].course is not None]
        for i in idx:
            if not notes[i].plucked:
                assign[i].rh_finger = None
        idx = [i for i in idx if notes[i].plucked]
        if not idx:
            continue
        idx.sort(key=lambda i: assign[i].course or 0)
        onsets = [notes[i].onset for i in idx]
        if len(idx) >= 4 and max(onsets) - min(onsets) >= 0.015:
            for i in idx:
                assign[i].rh_finger = "i"
            last = None
        else:
            courses = [assign[i].course or 0 for i in idx]
            bass = [i for i in idx if (assign[i].course or 0) < bass_courses]
            if len(idx) >= 4 and bass:
                c0 = assign[bass[0]].course or 0
                bass = [i for i in bass if (assign[i].course or 0) - c0 <= 1]
            elif bass:
                bass = bass[:1]
            for i in bass:
                assign[i].rh_finger = "p"
            treble = [i for i in idx if i not in bass]
            if len(idx) == 1 and treble:
                i = treble[0]
                c = assign[i].course or 0
                finger = string_finger.get(c, "i")
                if last is not None and last[0] == c and ev.onset - last[2] < 0.35 and last[1] in ("i", "m"):
                    finger = "m" if last[1] == "i" else "i"
                assign[i].rh_finger = finger
                last = (c, finger, ev.onset)
            else:
                pool = ["i", "m", "a", "c"]
                for i in sorted(treble, key=lambda j: assign[j].course or 0):
                    preferred = string_finger.get(assign[i].course or 0)
                    if len(treble) <= 3 and preferred is not None and preferred in pool:
                        assign[i].rh_finger = preferred
                        pool.remove(preferred)
                    else:
                        assign[i].rh_finger = pool.pop(0) if pool else "a"
                last = (courses[0], "p", ev.onset) if len(idx) == 1 else None
        for i in ev.notes:
            assign[i].voice = 2 if assign[i].rh_finger == "p" else 1


def accuracy(predicted: Sequence[Assignment], truth: Sequence[tuple[int, int]]) -> float:
    """Share of notes placed on the ground-truth (string, fret)."""
    hits = sum(1 for a, (s, f) in zip(predicted, truth, strict=True) if a.string == s and a.fret == f)
    return hits / max(len(truth), 1)


def as_positions(sol: Solution, notes: Sequence[FingerNote]) -> list[dict[str, float | int | str]]:
    """Merge consecutive events with the same hand position into position spans."""
    spans: list[dict[str, float | int | str]] = []
    for ev in sol.events:
        pos = sol.positions[ev.index]
        if pos is None or not ev.notes:
            continue
        end = max(notes[i].offset for i in ev.notes)
        if spans and spans[-1]["fret"] == pos and ev.onset - float(spans[-1]["end"]) < 1.0:
            spans[-1]["end"] = max(float(spans[-1]["end"]), end)
        else:
            spans.append(
                {"start": round(ev.onset, 4), "end": round(end, 4), "fret": int(pos), "source": "audio"}
            )
    for s in spans:
        s["end"] = round(float(s["end"]), 4)
    return spans


def _isfinite(x: float | None) -> bool:
    return x is not None and math.isfinite(x)
