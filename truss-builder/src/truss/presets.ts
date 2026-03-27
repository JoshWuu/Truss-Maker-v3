import type { Joint, Member, Truss } from './types'

export type PresetTag = 'beginner' | 'efficient' | 'example'

export type TrussPreset = {
  id: string
  name: string
  description: string
  tag: PresetTag
  build: () => Truss
}

function j(
  id: string,
  x: number,
  y: number,
  support: Joint['support'] = 'none',
  loadYkN = 0,
): Joint {
  return { id, label: '?', x, y, support, loadYkN }
}

function m(id: string, a: string, b: string): Member {
  return { id, a, b, multiplier: 1 }
}

export const PRESETS: TrussPreset[] = [
  // ── Simple Triangle ────────────────────────────────────────────────────────
  {
    id: 'simple-triangle',
    name: 'Simple Triangle',
    description: 'The simplest stable truss — 3 members, 3 joints',
    tag: 'beginner',
    build: () => ({
      pylonHeightM: 0,
      joints: [
        j('a',  0, 0, 'pinned'),
        j('b', 12, 0, 'roller'),
        j('c',  6, -4, 'none', 10),
      ],
      members: [
        m('ab', 'a', 'b'),
        m('ac', 'a', 'c'),
        m('bc', 'b', 'c'),
      ],
    }),
  },

  // ── Pratt Truss ────────────────────────────────────────────────────────────
  // Diagonals slope toward center (tension under gravity load)
  {
    id: 'pratt',
    name: 'Pratt Truss',
    description: 'Diagonals in tension — efficient for longer spans',
    tag: 'example',
    build: () => ({
      pylonHeightM: 0,
      joints: [
        j('a',  0, 0, 'pinned'),
        j('b',  3, 0),
        j('c',  6, 0, 'none', 10),
        j('d',  9, 0),
        j('e', 12, 0, 'roller'),
        j('f',  3, -3),
        j('g',  6, -3),
        j('h',  9, -3),
      ],
      members: [
        // bottom chord
        m('ab', 'a', 'b'), m('bc', 'b', 'c'), m('cd', 'c', 'd'), m('de', 'd', 'e'),
        // top chord
        m('fg', 'f', 'g'), m('gh', 'g', 'h'),
        // end posts
        m('af', 'a', 'f'), m('eh', 'e', 'h'),
        // verticals
        m('bf', 'b', 'f'), m('cg', 'c', 'g'), m('dh', 'd', 'h'),
        // Pratt diagonals: outer-top → inner-bottom (tension)
        m('fc', 'f', 'c'), m('hc', 'h', 'c'),
      ],
    }),
  },

  // ── Howe Truss ─────────────────────────────────────────────────────────────
  // Diagonals slope away from center (compression under gravity load)
  {
    id: 'howe',
    name: 'Howe Truss',
    description: 'Diagonals in compression, verticals in tension',
    tag: 'example',
    build: () => ({
      pylonHeightM: 0,
      joints: [
        j('a',  0, 0, 'pinned'),
        j('b',  3, 0),
        j('c',  6, 0, 'none', 10),
        j('d',  9, 0),
        j('e', 12, 0, 'roller'),
        j('f',  3, -3),
        j('g',  6, -3),
        j('h',  9, -3),
      ],
      members: [
        // bottom chord
        m('ab', 'a', 'b'), m('bc', 'b', 'c'), m('cd', 'c', 'd'), m('de', 'd', 'e'),
        // top chord
        m('fg', 'f', 'g'), m('gh', 'g', 'h'),
        // end posts
        m('af', 'a', 'f'), m('eh', 'e', 'h'),
        // verticals
        m('bf', 'b', 'f'), m('cg', 'c', 'g'), m('dh', 'd', 'h'),
        // Howe diagonals: inner-bottom → center-top (compression)
        m('bg', 'b', 'g'), m('dg', 'd', 'g'),
      ],
    }),
  },

  // ── Warren Truss ───────────────────────────────────────────────────────────
  // No verticals — pure alternating diagonal pattern
  {
    id: 'warren',
    name: 'Warren Truss',
    description: 'No verticals — alternating diagonal W pattern',
    tag: 'efficient',
    build: () => ({
      pylonHeightM: 0,
      joints: [
        j('a',  0,    0, 'pinned'),
        j('b',  4,    0),
        j('c',  8,    0),
        j('d', 12,    0, 'roller'),
        j('e',  2, -2.5),
        j('f',  6, -2.5, 'none', 10),
        j('g', 10, -2.5),
      ],
      members: [
        // bottom chord
        m('ab', 'a', 'b'), m('bc', 'b', 'c'), m('cd', 'c', 'd'),
        // top chord
        m('ef', 'e', 'f'), m('fg', 'f', 'g'),
        // alternating diagonals
        m('ae', 'a', 'e'), m('eb', 'e', 'b'), m('bf', 'b', 'f'),
        m('fc', 'f', 'c'), m('cg', 'c', 'g'), m('gd', 'g', 'd'),
      ],
    }),
  },

  // ── Fink Truss ─────────────────────────────────────────────────────────────
  // Classic W-web roof truss
  {
    id: 'fink',
    name: 'Fink Truss',
    description: 'Classic W-web roof truss for residential spans',
    tag: 'example',
    build: () => ({
      pylonHeightM: 0,
      joints: [
        j('a',  0, 0, 'pinned'),
        j('b', 12, 0, 'roller'),
        j('c',  6, -4, 'none', 15),
        j('d',  3, -2),
        j('e',  9, -2),
      ],
      members: [
        // top chord (4 rafter segments)
        m('ad', 'a', 'd'), m('dc', 'd', 'c'), m('ce', 'c', 'e'), m('eb', 'e', 'b'),
        // bottom tie
        m('ab', 'a', 'b'),
        // Fink web: cross-diagonals
        m('ae_w', 'a', 'e'), m('bd_w', 'b', 'd'),
      ],
    }),
  },
]
