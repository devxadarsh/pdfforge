import { ShapeKind } from '../models/pdf.models';

/**
 * Generates mathematically clean, responsive SVG Path strings (d attribute)
 * for all 150 shape kinds normalized to width (w) and height (h).
 */
export function generateShapeSvgPath(kind: ShapeKind, w: number, h: number): string {
  w = Math.max(1, w);
  h = Math.max(1, h);

  switch (kind) {
    // =========================================================================
    // 1. Basic Geometric & Polygons (20)
    // =========================================================================
    case 'rectangle':
    case 'square':
      return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;

    case 'rounded-rectangle': {
      const r = Math.min(16, Math.min(w, h) / 4);
      return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
    }

    case 'circle':
    case 'ellipse': {
      const rx = w / 2;
      const ry = h / 2;
      return `M ${rx} 0 A ${rx} ${ry} 0 1 0 ${rx} ${h} A ${rx} ${ry} 0 1 0 ${rx} 0 Z`;
    }

    case 'semi-circle':
      return `M 0 ${h} A ${w / 2} ${h} 0 0 1 ${w} ${h} Z`;

    case 'triangle':
      return `M ${w / 2} 0 L ${w} ${h} L 0 ${h} Z`;

    case 'triangle-right':
      return `M 0 0 L ${w} ${h} L 0 ${h} Z`;

    case 'diamond':
      return `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`;

    case 'parallelogram': {
      const offset = w * 0.22;
      return `M ${offset} 0 L ${w} 0 L ${w - offset} ${h} L 0 ${h} Z`;
    }

    case 'trapezoid': {
      const inset = w * 0.2;
      return `M ${inset} 0 L ${w - inset} 0 L ${w} ${h} L 0 ${h} Z`;
    }

    case 'pentagon':
      return `M ${w * 0.5} 0 L ${w} ${h * 0.38} L ${w * 0.81} ${h} L ${w * 0.19} ${h} L 0 ${h * 0.38} Z`;

    case 'hexagon':
      return `M ${w * 0.25} 0 L ${w * 0.75} 0 L ${w} ${h * 0.5} L ${w * 0.75} ${h} L ${w * 0.25} ${h} L 0 ${h * 0.5} Z`;

    case 'heptagon':
      return `M ${w * 0.5} 0 L ${w * 0.89} ${h * 0.19} L ${w} ${h * 0.63} L ${w * 0.72} ${h} L ${w * 0.28} ${h} L 0 ${h * 0.63} L ${w * 0.11} ${h * 0.19} Z`;

    case 'octagon':
      return `M ${w * 0.29} 0 L ${w * 0.71} 0 L ${w} ${h * 0.29} L ${w} ${h * 0.71} L ${w * 0.71} ${h} L ${w * 0.29} ${h} L 0 ${h * 0.71} L 0 ${h * 0.29} Z`;

    case 'decagon':
      return `M ${w * 0.5} 0 L ${w * 0.81} ${h * 0.1} L ${w * 0.98} ${h * 0.35} L ${w * 0.98} ${h * 0.65} L ${w * 0.81} ${h * 0.9} L ${w * 0.5} ${h} L ${w * 0.19} ${h * 0.9} L ${w * 0.02} ${h * 0.65} L ${w * 0.02} ${h * 0.35} L ${w * 0.19} ${h * 0.1} Z`;

    case 'cross-poly': {
      const x1 = w * 0.33;
      const x2 = w * 0.67;
      const y1 = h * 0.33;
      const y2 = h * 0.67;
      return `M ${x1} 0 L ${x2} 0 L ${x2} ${y1} L ${w} ${y1} L ${w} ${y2} L ${x2} ${y2} L ${x2} ${h} L ${x1} ${h} L ${x1} ${y2} L 0 ${y2} L 0 ${y1} L ${x1} ${y1} Z`;
    }

    case 'ring-donut': {
      const rx = w / 2;
      const ry = h / 2;
      const irx = rx * 0.55;
      const iry = ry * 0.55;
      return `M ${rx} 0 A ${rx} ${ry} 0 1 0 ${rx} ${h} A ${rx} ${ry} 0 1 0 ${rx} 0 Z M ${rx} ${ry - iry} A ${irx} ${iry} 0 1 1 ${rx} ${ry + iry} A ${irx} ${iry} 0 1 1 ${rx} ${ry - iry} Z`;
    }

    case 'teardrop':
      return `M ${w * 0.5} 0 C ${w} ${h * 0.45} ${w} ${h} ${w * 0.5} ${h} C 0 ${h} 0 ${h * 0.45} ${w * 0.5} 0 Z`;

    case 'corner-cut-rect': {
      const c = Math.min(24, Math.min(w, h) / 3);
      return `M 0 0 L ${w - c} 0 L ${w} ${c} L ${w} ${h} L 0 ${h} Z`;
    }

    // =========================================================================
    // 2. Arrows & Directions (18)
    // =========================================================================
    case 'arrow':
    case 'arrow-right': {
      const ah = h * 0.3;
      const aw = Math.min(w * 0.35, 40);
      return `M 0 ${ah} L ${w - aw} ${ah} L ${w - aw} 0 L ${w} ${h / 2} L ${w - aw} ${h} L ${w - aw} ${h - ah} L 0 ${h - ah} Z`;
    }

    case 'line':
      return `M 0 ${h / 2} L ${w} ${h / 2}`;

    case 'arrow-left': {
      const ah = h * 0.3;
      const aw = Math.min(w * 0.35, 40);
      return `M ${w} ${ah} L ${aw} ${ah} L ${aw} 0 L 0 ${h / 2} L ${aw} ${h} L ${aw} ${h - ah} L ${w} ${h - ah} Z`;
    }

    case 'arrow-up': {
      const aw = w * 0.3;
      const ah = Math.min(h * 0.35, 40);
      return `M ${aw} ${h} L ${aw} ${ah} L 0 ${ah} L ${w / 2} 0 L ${w} ${ah} L ${w - aw} ${ah} L ${w - aw} ${h} Z`;
    }

    case 'arrow-down': {
      const aw = w * 0.3;
      const ah = Math.min(h * 0.35, 40);
      return `M ${aw} 0 L ${aw} ${h - ah} L 0 ${h - ah} L ${w / 2} ${h} L ${w} ${h - ah} L ${w - aw} ${h - ah} L ${w - aw} 0 Z`;
    }

    case 'arrow-up-down': {
      const aw = w * 0.3;
      const ah = Math.min(h * 0.25, 30);
      return `M ${w / 2} 0 L ${w} ${ah} L ${w - aw} ${ah} L ${w - aw} ${h - ah} L ${w} ${h - ah} L ${w / 2} ${h} L 0 ${h - ah} L ${aw} ${h - ah} L ${aw} ${ah} L 0 ${ah} Z`;
    }

    case 'arrow-left-right': {
      const ah = h * 0.3;
      const aw = Math.min(w * 0.25, 30);
      return `M 0 ${h / 2} L ${aw} 0 L ${aw} ${ah} L ${w - aw} ${ah} L ${w - aw} 0 L ${w} ${h / 2} L ${w - aw} ${h} L ${w - aw} ${h - ah} L ${aw} ${h - ah} L ${aw} ${h} Z`;
    }

    case 'arrow-double': {
      const step = w * 0.45;
      const aw = w * 0.3;
      return `M 0 0 L ${step} ${h / 2} L 0 ${h} L ${aw} ${h} L ${step + aw} ${h / 2} L ${aw} 0 Z M ${step} 0 L ${w} ${h / 2} L ${step} ${h} L ${step + aw} ${h} L ${w} ${h / 2} L ${step + aw} 0 Z`;
    }

    case 'arrow-curved':
      return `M 0 0 C ${w * 0.75} 0 ${w} ${h * 0.25} ${w} ${h * 0.65} L ${w * 1.15} ${h * 0.6} L ${w * 0.85} ${h} L ${w * 0.55} ${h * 0.6} L ${w * 0.75} ${h * 0.65} C ${w * 0.75} ${h * 0.4} ${w * 0.55} ${h * 0.22} 0 ${h * 0.22} Z`;

    case 'arrow-circular': {
      const r = Math.min(w, h) / 2;
      return `M ${r} 0 A ${r} ${r} 0 1 1 0 ${r} L 0 ${r * 0.65} A ${r * 0.65} ${r * 0.65} 0 1 0 ${r} ${r * 0.35} L ${r * 1.3} ${r * 0.35} L ${r} 0 Z`;
    }

    case 'arrow-uturn':
      return `M ${w * 0.3} ${h} L ${w * 0.3} ${h * 0.45} C ${w * 0.3} ${h * 0.15} ${w * 0.7} ${h * 0.15} ${w * 0.7} ${h * 0.45} L ${w * 0.7} ${h * 0.7} L ${w * 0.55} ${h * 0.7} L ${w * 0.8} ${h} L ${w * 1.05} ${h * 0.7} L ${w * 0.9} ${h * 0.7} L ${w * 0.9} ${h * 0.45} C ${w * 0.9} 0 ${w * 0.1} 0 ${w * 0.1} ${h * 0.45} L ${w * 0.1} ${h} Z`;

    case 'arrow-split':
      return `M 0 ${h * 0.35} L ${w * 0.4} ${h * 0.35} L ${w * 0.4} 0 L ${w * 0.8} ${h * 0.25} L ${w * 0.4} ${h * 0.5} L ${w * 0.4} ${h * 0.45} L ${w * 0.2} ${h * 0.45} L ${w * 0.2} ${h * 0.65} L ${w * 0.4} ${h * 0.65} L ${w * 0.4} ${h * 0.5} L ${w * 0.8} ${h * 0.75} L ${w * 0.4} ${h} L ${w * 0.4} ${h * 0.8} L 0 ${h * 0.8} Z`;

    case 'arrow-fork':
      return `M 0 0 L ${w * 0.4} ${h * 0.25} L 0 ${h * 0.5} L 0 ${h * 0.35} L ${w * 0.5} ${h * 0.35} L ${w * 0.5} ${h * 0.65} L 0 ${h * 0.65} L 0 ${h * 0.5} L ${w * 0.4} ${h * 0.75} L 0 ${h} L 0 ${h * 0.8} L ${w * 0.65} ${h * 0.8} L ${w * 0.65} ${h} L ${w} ${h * 0.5} L ${w * 0.65} 0 L ${w * 0.65} ${h * 0.2} L 0 ${h * 0.2} Z`;

    case 'arrow-quad': {
      const c = w / 2;
      const ch = h / 2;
      const aw = w * 0.18;
      const ah = h * 0.18;
      return `M ${c} 0 L ${c + aw} ${ah} L ${c + aw * 0.4} ${ah} L ${c + aw * 0.4} ${ch - ah * 0.4} L ${w - aw} ${ch - ah * 0.4} L ${w - aw} ${ch - ah} L ${w} ${ch} L ${w - aw} ${ch + ah} L ${w - aw} ${ch + ah * 0.4} L ${c + aw * 0.4} ${ch + ah * 0.4} L ${c + aw * 0.4} ${h - ah} L ${c + aw} ${h - ah} L ${c} ${h} L ${c - aw} ${h - ah} L ${c - aw * 0.4} ${h - ah} L ${c - aw * 0.4} ${ch + ah * 0.4} L ${aw} ${ch + ah * 0.4} L ${aw} ${ch + ah} L 0 ${ch} L ${aw} ${ch - ah} L ${aw} ${ch - ah * 0.4} L ${c - aw * 0.4} ${ch - ah * 0.4} L ${c - aw * 0.4} ${ah} L ${c - aw} ${ah} Z`;
    }

    case 'chevron': {
      const cut = w * 0.35;
      return `M 0 0 L ${w - cut} 0 L ${w} ${h / 2} L ${w - cut} ${h} L 0 ${h} L ${cut} ${h / 2} Z`;
    }

    case 'chevron-double': {
      const step = w * 0.4;
      const cut = w * 0.25;
      return `M 0 0 L ${step - cut} 0 L ${step} ${h / 2} L ${step - cut} ${h} L 0 ${h} L ${cut} ${h / 2} Z M ${step} 0 L ${w - cut} 0 L ${w} ${h / 2} L ${w - cut} ${h} L ${step} ${h} L ${step + cut} ${h / 2} Z`;
    }

    case 'arrow-bent':
      return `M 0 ${h * 0.75} L ${w * 0.55} ${h * 0.75} L ${w * 0.55} ${h * 0.35} L ${w * 0.4} ${h * 0.35} L ${w * 0.7} 0 L ${w} ${h * 0.35} L ${w * 0.8} ${h * 0.35} L ${w * 0.8} ${h} L 0 ${h} Z`;

    case 'arrow-step':
      return `M 0 ${h * 0.5} L ${w * 0.35} ${h * 0.5} L ${w * 0.35} 0 L ${w * 0.65} 0 L ${w * 0.65} ${h * 0.2} L ${w} ${h * 0.4} L ${w * 0.65} ${h * 0.6} L ${w * 0.65} ${h * 0.4} L ${w * 0.2} ${h * 0.4} L ${w * 0.2} ${h} L 0 ${h} Z`;

    case 'arrow-callout':
      return `M 0 0 L ${w * 0.75} 0 L ${w * 0.75} ${h * 0.25} L ${w} ${h * 0.5} L ${w * 0.75} ${h * 0.75} L ${w * 0.75} ${h} L 0 ${h} Z`;

    // =========================================================================
    // 3. Diagram & Flowchart (18)
    // =========================================================================
    case 'flow-process':
      return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;

    case 'flow-decision':
      return `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`;

    case 'flow-terminator': {
      const r = Math.min(w, h) / 2;
      return `M ${r} 0 L ${w - r} 0 A ${r} ${r} 0 0 1 ${w - r} ${h} L ${r} ${h} A ${r} ${r} 0 0 1 ${r} 0 Z`;
    }

    case 'flow-data': {
      const offset = w * 0.2;
      return `M ${offset} 0 L ${w} 0 L ${w - offset} ${h} L 0 ${h} Z`;
    }

    case 'flow-document':
      return `M 0 0 L ${w} 0 L ${w} ${h * 0.85} Q ${w * 0.75} ${h * 0.7} ${w * 0.5} ${h * 0.85} T 0 ${h * 0.85} Z`;

    case 'flow-multi-document': {
      const d = 8;
      return `M ${d * 2} 0 L ${w} 0 L ${w} ${h * 0.75} L ${d * 2} ${h * 0.75} Z M ${d} ${d} L ${w - d} ${d} L ${w - d} ${h * 0.85} L ${d} ${h * 0.85} Z M 0 ${d * 2} L ${w - d * 2} ${d * 2} L ${w - d * 2} ${h * 0.85} Q ${(w - d * 2) * 0.75} ${h * 0.7} ${(w - d * 2) * 0.5} ${h * 0.85} T 0 ${h * 0.85} Z`;
    }

    case 'flow-database':
    case 'ui-cylinder':
    case 'math-cylinder': {
      const ry = h * 0.15;
      return `M 0 ${ry} A ${w / 2} ${ry} 0 0 1 ${w} ${ry} L ${w} ${h - ry} A ${w / 2} ${ry} 0 0 1 0 ${h - ry} Z M 0 ${ry} A ${w / 2} ${ry} 0 0 0 ${w} ${ry}`;
    }

    case 'flow-predefined': {
      const bar = Math.min(16, w * 0.14);
      return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z M ${bar} 0 L ${bar} ${h} M ${w - bar} 0 L ${w - bar} ${h}`;
    }

    case 'flow-manual-input':
      return `M 0 ${h * 0.22} L ${w} 0 L ${w} ${h} L 0 ${h} Z`;

    case 'flow-manual-operation':
      return `M 0 0 L ${w} 0 L ${w * 0.8} ${h} L ${w * 0.2} ${h} Z`;

    case 'flow-delay': {
      const r = h / 2;
      return `M 0 0 L ${w - r} 0 A ${r} ${r} 0 0 1 ${w - r} ${h} L 0 ${h} Z`;
    }

    case 'flow-connector':
      return `M ${w / 2} 0 A ${w / 2} ${h / 2} 0 1 0 ${w / 2} ${h} A ${w / 2} ${h / 2} 0 1 0 ${w / 2} 0 Z`;

    case 'flow-off-page':
      return `M 0 0 L ${w} 0 L ${w} ${h * 0.65} L ${w / 2} ${h} L 0 ${h * 0.65} Z`;

    case 'flow-preparation':
      return `M ${w * 0.2} 0 L ${w * 0.8} 0 L ${w} ${h * 0.5} L ${w * 0.8} ${h} L ${w * 0.2} ${h} L 0 ${h * 0.5} Z`;

    case 'flow-internal-storage': {
      const barX = w * 0.2;
      const barY = h * 0.2;
      return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z M ${barX} 0 L ${barX} ${h} M 0 ${barY} L ${w} ${barY}`;
    }

    case 'flow-summing': {
      const r = Math.min(w, h) / 2;
      return `M ${r} 0 A ${r} ${r} 0 1 0 ${r} ${h} A ${r} ${r} 0 1 0 ${r} 0 Z M ${w * 0.15} ${h * 0.15} L ${w * 0.85} ${h * 0.85} M ${w * 0.85} ${h * 0.15} L ${w * 0.15} ${h * 0.85}`;
    }

    case 'flow-collate':
      return `M 0 0 L ${w} 0 L 0 ${h} L ${w} ${h} Z`;

    case 'flow-display':
      return `M ${w * 0.2} 0 L ${w * 0.8} 0 Q ${w} ${h * 0.5} ${w * 0.8} ${h} L ${w * 0.2} ${h} L 0 ${h * 0.5} Z`;

    // =========================================================================
    // 4. Callouts & Speech (16)
    // =========================================================================
    case 'callout-speech':
      return `M 0 0 L ${w} 0 L ${w} ${h * 0.75} L ${w * 0.45} ${h * 0.75} L ${w * 0.25} ${h} L ${w * 0.28} ${h * 0.75} L 0 ${h * 0.75} Z`;

    case 'callout-thought': {
      const rx = w / 2;
      const ry = h * 0.38;
      return `M ${rx} 0 A ${rx} ${ry} 0 1 0 ${rx} ${ry * 2} A ${rx} ${ry} 0 1 0 ${rx} 0 Z M ${w * 0.25} ${h * 0.85} A 6 6 0 1 0 ${w * 0.25} ${h * 0.85 + 0.1} M ${w * 0.18} ${h * 0.96} A 3.5 3.5 0 1 0 ${w * 0.18} ${h * 0.96 + 0.1}`;
    }

    case 'callout-cloud': {
      const ch = h * 0.75;
      return `M ${w * 0.2} ${ch * 0.7} Q 0 ${ch * 0.6} 0 ${ch * 0.4} Q 0 ${ch * 0.15} ${w * 0.22} ${ch * 0.1} Q ${w * 0.35} 0 ${w * 0.55} ${ch * 0.08} Q ${w * 0.75} 0 ${w * 0.85} ${ch * 0.2} Q ${w} ${ch * 0.25} ${w} ${ch * 0.5} Q ${w} ${ch * 0.8} ${w * 0.75} ${ch * 0.85} L ${w * 0.45} ${ch * 0.85} L ${w * 0.25} ${h} L ${w * 0.3} ${ch * 0.85} Z`;
    }

    case 'callout-rect':
      return `M 0 0 L ${w} 0 L ${w} ${h * 0.75} L ${w * 0.5} ${h * 0.75} L ${w * 0.3} ${h} L ${w * 0.35} ${h * 0.75} L 0 ${h * 0.75} Z`;

    case 'callout-rounded': {
      const r = 10;
      const ch = h * 0.75;
      return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${ch - r} Q ${w} ${ch} ${w - r} ${ch} L ${w * 0.45} ${ch} L ${w * 0.25} ${h} L ${w * 0.3} ${ch} L ${r} ${ch} Q 0 ${ch} 0 ${ch - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
    }

    case 'callout-oval': {
      const rx = w / 2;
      const ry = h * 0.38;
      return `M ${rx} 0 A ${rx} ${ry} 0 0 1 ${w * 0.75} ${ry * 1.8} L ${w * 0.5} ${h} L ${w * 0.4} ${ry * 1.95} A ${rx} ${ry} 0 0 1 0 ${ry} A ${rx} ${ry} 0 0 1 ${rx} 0 Z`;
    }

    case 'callout-left': {
      const ch = h * 0.75;
      return `M 0 0 L ${w} 0 L ${w} ${ch} L ${w * 0.2} ${ch} L 0 ${h} L ${w * 0.08} ${ch} L 0 ${ch} Z`;
    }

    case 'callout-right': {
      const ch = h * 0.75;
      return `M 0 0 L ${w} 0 L ${w} ${ch} L ${w * 0.92} ${ch} L ${w} ${h} L ${w * 0.8} ${ch} L 0 ${ch} Z`;
    }

    case 'callout-shout': {
      return `M ${w * 0.5} 0 L ${w * 0.65} ${h * 0.15} L ${w * 0.85} 0 L ${w * 0.85} ${h * 0.25} L ${w} ${h * 0.25} L ${w * 0.9} ${h * 0.45} L ${w} ${h * 0.65} L ${w * 0.85} ${h * 0.7} L ${w * 0.95} ${h * 0.9} L ${w * 0.75} ${h * 0.85} L ${w * 0.65} ${h} L ${w * 0.45} ${h * 0.85} L ${w * 0.25} ${h} L ${w * 0.3} ${h * 0.8} L ${w * 0.1} ${h * 0.9} L ${w * 0.15} ${h * 0.65} L 0 ${h * 0.55} L ${w * 0.15} ${h * 0.4} L 0 ${h * 0.2} L ${w * 0.2} ${h * 0.25} L ${w * 0.25} 0 L ${w * 0.4} ${h * 0.15} Z`;
    }

    case 'callout-caption':
      return `M 0 0 L ${w} 0 L ${w} ${h} L ${w * 0.45} ${h} L ${w * 0.3} ${h * 1.25} L ${w * 0.35} ${h} L 0 ${h} Z`;

    case 'callout-label': {
      const cut = h * 0.5;
      return `M ${cut} 0 L ${w} 0 L ${w} ${h} L ${cut} ${h} L 0 ${h / 2} Z M ${cut * 0.6} ${h / 2} A 3 3 0 1 0 ${cut * 0.6} ${h / 2 + 0.1}`;
    }

    case 'callout-price-tag': {
      const cut = h * 0.4;
      return `M 0 0 L ${w - cut} 0 L ${w} ${cut} L ${w} ${h} L 0 ${h} Z M ${w - cut * 0.7} ${cut * 0.7} A 3.5 3.5 0 1 0 ${w - cut * 0.7} ${cut * 0.7 + 0.1}`;
    }

    case 'callout-bracket':
      return `M ${w * 0.2} 0 L 0 0 L 0 ${h} L ${w * 0.2} ${h} M ${w * 0.8} 0 L ${w} 0 L ${w} ${h} L ${w * 0.8} ${h}`;

    case 'callout-curly-left':
      return `M ${w} 0 C ${w * 0.4} 0 ${w * 0.4} ${h * 0.35} ${w * 0.4} ${h * 0.45} C ${w * 0.4} ${h * 0.48} 0 ${h * 0.5} 0 ${h * 0.5} C 0 ${h * 0.5} ${w * 0.4} ${h * 0.52} ${w * 0.4} ${h * 0.55} C ${w * 0.4} ${h * 0.65} ${w * 0.4} ${h} ${w} ${h}`;

    case 'callout-curly-right':
      return `M 0 0 C ${w * 0.6} 0 ${w * 0.6} ${h * 0.35} ${w * 0.6} ${h * 0.45} C ${w * 0.6} ${h * 0.48} ${w} ${h * 0.5} ${w} ${h * 0.5} C ${w} ${h * 0.5} ${w * 0.6} ${h * 0.52} ${w * 0.6} ${h * 0.55} C ${w * 0.6} ${h * 0.65} ${w * 0.6} ${h} 0 ${h}`;

    // =========================================================================
    // 5. Symbols & Decorative (20)
    // =========================================================================
    case 'symbol-star': {
      const cx = w / 2;
      const cy = h / 2;
      const outerR = Math.min(cx, cy);
      const innerR = outerR * 0.38;
      let d = '';
      for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI) / 5 - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        const px = cx + r * Math.cos(angle);
        const py = cy + r * Math.sin(angle);
        d += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
      }
      return d + ' Z';
    }

    case 'symbol-star-4': {
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(cx, cy);
      const inR = r * 0.22;
      return `M ${cx} ${cy - r} Q ${cx} ${cy - inR} ${cx + inR} ${cy} Q ${cx} ${cy + inR} ${cx} ${cy + r} Q ${cx} ${cy + inR} ${cx - inR} ${cy} Q ${cx} ${cy - inR} ${cx} ${cy - r} Z`;
    }

    case 'symbol-star-6': {
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(cx, cy);
      const inR = r * 0.58;
      let d = '';
      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI) / 6 - Math.PI / 2;
        const radius = i % 2 === 0 ? r : inR;
        const px = cx + radius * Math.cos(angle);
        const py = cy + radius * Math.sin(angle);
        d += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
      }
      return d + ' Z';
    }

    case 'symbol-star-8': {
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(cx, cy);
      const inR = r * 0.5;
      let d = '';
      for (let i = 0; i < 16; i++) {
        const angle = (i * Math.PI) / 8 - Math.PI / 2;
        const radius = i % 2 === 0 ? r : inR;
        const px = cx + radius * Math.cos(angle);
        const py = cy + radius * Math.sin(angle);
        d += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
      }
      return d + ' Z';
    }

    case 'symbol-heart':
      return `M ${w * 0.5} ${h * 0.85} C ${w * 0.15} ${h * 0.55} 0 ${h * 0.35} 0 ${h * 0.22} C 0 ${h * 0.08} ${w * 0.22} 0 ${w * 0.5} ${h * 0.25} C ${w * 0.78} 0 ${w} ${h * 0.08} ${w} ${h * 0.22} C ${w} ${h * 0.35} ${w * 0.85} ${h * 0.55} ${w * 0.5} ${h * 0.85} Z`;

    case 'symbol-cross': {
      const stroke = Math.min(w, h) * 0.22;
      return `M 0 ${stroke} L ${w * 0.5 - stroke / 2} ${h * 0.5} L 0 ${h - stroke} L ${stroke} ${h} L ${w * 0.5} ${h * 0.5 + stroke / 2} L ${w - stroke} ${h} L ${w} ${h - stroke} L ${w * 0.5 + stroke / 2} ${h * 0.5} L ${w} ${stroke} L ${w - stroke} 0 L ${w * 0.5} ${h * 0.5 - stroke / 2} L ${stroke} 0 Z`;
    }

    case 'symbol-plus': {
      const th = Math.min(w, h) * 0.24;
      const cx = (w - th) / 2;
      const cy = (h - th) / 2;
      return `M ${cx} 0 L ${cx + th} 0 L ${cx + th} ${cy} L ${w} ${cy} L ${w} ${cy + th} L ${cx + th} ${cy + th} L ${cx + th} ${h} L ${cx} ${h} L ${cx} ${cy + th} L 0 ${cy + th} L 0 ${cy} L ${cx} ${cy} Z`;
    }

    case 'symbol-minus':
      return `M 0 ${h * 0.35} L ${w} ${h * 0.35} L ${w} ${h * 0.65} L 0 ${h * 0.65} Z`;

    case 'symbol-lightning':
      return `M ${w * 0.55} 0 L ${w * 0.15} ${h * 0.55} L ${w * 0.48} ${h * 0.55} L ${w * 0.35} ${h} L ${w * 0.85} ${h * 0.42} L ${w * 0.52} ${h * 0.42} Z`;

    case 'symbol-cloud':
      return `M ${w * 0.2} ${h * 0.8} Q 0 ${h * 0.7} 0 ${h * 0.5} Q 0 ${h * 0.25} ${w * 0.25} ${h * 0.2} Q ${w * 0.35} 0 ${w * 0.6} ${h * 0.1} Q ${w * 0.8} 0 ${w * 0.9} ${h * 0.3} Q ${w} ${h * 0.4} ${w} ${h * 0.6} Q ${w} ${h * 0.85} ${w * 0.75} ${h * 0.85} L ${w * 0.2} ${h * 0.85} Z`;

    case 'symbol-sun': {
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(cx, cy) * 0.45;
      const ray = Math.min(cx, cy);
      return `M ${cx} ${cy - r} A ${r} ${r} 0 1 0 ${cx} ${cy + r} A ${r} ${r} 0 1 0 ${cx} ${cy - r} Z M ${cx} 0 L ${cx} ${cy - r * 1.25} M ${cx} ${cy + r * 1.25} L ${cx} ${h} M 0 ${cy} L ${cx - r * 1.25} ${cy} M ${cx + r * 1.25} ${cy} L ${w} ${cy} M ${cx - ray * 0.6} ${cy - ray * 0.6} L ${cx - r * 0.8} ${cy - r * 0.8} M ${cx + r * 0.8} ${cy + r * 0.8} L ${cx + ray * 0.6} ${cy + ray * 0.6} M ${cx + ray * 0.6} ${cy - ray * 0.6} L ${cx + r * 0.8} ${cy - r * 0.8} M ${cx - r * 0.8} ${cy + r * 0.8} L ${cx - ray * 0.6} ${cy + ray * 0.6}`;
    }

    case 'symbol-moon': {
      const r = Math.min(w, h) / 2;
      return `M ${w * 0.5} 0 A ${r} ${r} 0 0 1 ${w * 0.5} ${h} A ${r * 0.8} ${r * 0.8} 0 0 0 ${w * 0.5} 0 Z`;
    }

    case 'symbol-checkmark':
      return `M ${w * 0.1} ${h * 0.55} L ${w * 0.38} ${h * 0.85} L ${w * 0.9} ${h * 0.15} L ${w * 0.78} ${h * 0.05} L ${w * 0.38} ${h * 0.65} L ${w * 0.22} ${h * 0.45} Z`;

    case 'symbol-warning':
      return `M ${w / 2} 0 L ${w} ${h} L 0 ${h} Z M ${w / 2} ${h * 0.35} L ${w / 2} ${h * 0.65} M ${w / 2} ${h * 0.8} A 2 2 0 1 0 ${w / 2} ${h * 0.8 + 0.1}`;

    case 'symbol-prohibited': {
      const rx = w / 2;
      const ry = h / 2;
      return `M ${rx} 0 A ${rx} ${ry} 0 1 0 ${rx} ${h} A ${rx} ${ry} 0 1 0 ${rx} 0 Z M ${w * 0.2} ${h * 0.2} L ${w * 0.8} ${h * 0.8}`;
    }

    case 'symbol-info': {
      const rx = w / 2;
      const ry = h / 2;
      return `M ${rx} 0 A ${rx} ${ry} 0 1 0 ${rx} ${h} A ${rx} ${ry} 0 1 0 ${rx} 0 Z M ${rx} ${h * 0.3} A 2 2 0 1 0 ${rx} ${h * 0.3 + 0.1} M ${rx} ${h * 0.45} L ${rx} ${h * 0.75}`;
    }

    case 'symbol-help': {
      const rx = w / 2;
      const ry = h / 2;
      return `M ${rx} 0 A ${rx} ${ry} 0 1 0 ${rx} ${h} A ${rx} ${ry} 0 1 0 ${rx} 0 Z M ${w * 0.35} ${h * 0.35} Q ${w * 0.35} ${h * 0.2} ${w * 0.5} ${h * 0.2} Q ${w * 0.65} ${h * 0.2} ${w * 0.65} ${h * 0.35} Q ${w * 0.65} ${h * 0.48} ${w * 0.5} ${h * 0.55} L ${w * 0.5} ${h * 0.65} M ${w * 0.5} ${h * 0.78} A 2 2 0 1 0 ${w * 0.5} ${h * 0.78 + 0.1}`;
    }

    case 'symbol-location': {
      const rx = w / 2;
      const ry = h * 0.38;
      return `M ${rx} 0 A ${rx} ${ry} 0 0 0 0 ${ry} C 0 ${h * 0.65} ${rx} ${h} ${rx} ${h} C ${rx} ${h} ${w} ${h * 0.65} ${w} ${ry} A ${rx} ${ry} 0 0 0 ${rx} 0 Z M ${rx} ${ry * 0.6} A ${rx * 0.35} ${ry * 0.35} 0 1 1 ${rx} ${ry * 1.4} A ${rx * 0.35} ${ry * 0.35} 0 1 1 ${rx} ${ry * 0.6} Z`;
    }

    case 'symbol-flame':
      return `M ${w * 0.5} 0 C ${w * 0.65} ${h * 0.25} ${w * 0.9} ${h * 0.45} ${w * 0.9} ${h * 0.7} C ${w * 0.9} ${h} ${w * 0.1} ${h} ${w * 0.1} ${h * 0.7} C ${w * 0.1} ${h * 0.45} ${w * 0.4} ${h * 0.3} ${w * 0.3} ${h * 0.15} C ${w * 0.4} ${h * 0.25} ${w * 0.5} ${h * 0.3} ${w * 0.5} 0 Z`;

    case 'symbol-droplet':
      return `M ${w * 0.5} 0 C ${w} ${h * 0.5} ${w} ${h} ${w * 0.5} ${h} C 0 ${h} 0 ${h * 0.5} ${w * 0.5} 0 Z`;

    // =========================================================================
    // 6. Banners, Ribbons & Badges (14)
    // =========================================================================
    case 'banner-classic':
    case 'ui-ribbon': {
      const cut = w * 0.15;
      const fold = h * 0.25;
      return `M ${cut} ${fold} L ${w - cut} ${fold} L ${w} ${h / 2} L ${w - cut} ${h - fold} L ${cut} ${h - fold} L 0 ${h / 2} Z M ${cut} ${fold} L ${cut} ${h} L ${cut * 1.8} ${h - fold} M ${w - cut} ${fold} L ${w - cut} ${h} L ${w - cut * 1.8} ${h - fold}`;
    }

    case 'banner-curved-up':
      return `M 0 ${h * 0.4} Q ${w / 2} 0 ${w} ${h * 0.4} L ${w} ${h * 0.8} Q ${w / 2} ${h * 0.4} 0 ${h * 0.8} Z`;

    case 'banner-curved-down':
      return `M 0 ${h * 0.2} Q ${w / 2} ${h * 0.6} ${w} ${h * 0.2} L ${w} ${h * 0.6} Q ${w / 2} ${h} 0 ${h * 0.6} Z`;

    case 'banner-swallowtail':
      return `M 0 0 L ${w} 0 L ${w * 0.8} ${h / 2} L ${w} ${h} L 0 ${h} Z`;

    case 'banner-ribbon-folded': {
      const fold = w * 0.2;
      return `M ${fold} 0 L ${w - fold} 0 L ${w - fold} ${h * 0.7} L ${w} ${h} L ${w - fold} ${h * 0.85} L ${fold} ${h * 0.85} L 0 ${h} L ${fold} ${h * 0.7} Z`;
    }

    case 'badge-starburst':
    case 'ui-badge': {
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(cx, cy);
      const inR = r * 0.82;
      let d = '';
      for (let i = 0; i < 24; i++) {
        const angle = (i * Math.PI) / 12 - Math.PI / 2;
        const radius = i % 2 === 0 ? r : inR;
        const px = cx + radius * Math.cos(angle);
        const py = cy + radius * Math.sin(angle);
        d += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
      }
      return d + ' Z';
    }

    case 'badge-rosette': {
      const cx = w / 2;
      const cy = h * 0.4;
      const r = Math.min(cx, cy);
      return `M ${cx} ${cy - r} A ${r} ${r} 0 1 0 ${cx} ${cy + r} A ${r} ${r} 0 1 0 ${cx} ${cy - r} Z M ${w * 0.35} ${cy + r * 0.8} L ${w * 0.2} ${h} L ${w * 0.38} ${h * 0.85} L ${w * 0.5} ${h} L ${w * 0.65} ${cy + r * 0.8}`;
    }

    case 'badge-shield':
    case 'ui-shield':
      return `M 0 0 L ${w} 0 L ${w} ${h * 0.55} Q ${w} ${h} ${w / 2} ${h} Q 0 ${h} 0 ${h * 0.55} Z`;

    case 'badge-seal': {
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(cx, cy);
      return `M ${cx} 0 A ${r} ${r} 0 1 0 ${cx} ${h} A ${r} ${r} 0 1 0 ${cx} 0 Z M ${cx} ${r * 0.25} A ${r * 0.75} ${r * 0.75} 0 1 1 ${cx} ${h - r * 0.25} A ${r * 0.75} ${r * 0.75} 0 1 1 ${cx} ${r * 0.25} Z`;
    }

    case 'badge-award': {
      const cx = w / 2;
      const r = w * 0.35;
      return `M ${cx} 0 A ${r} ${r} 0 1 0 ${cx} ${r * 2} A ${r} ${r} 0 1 0 ${cx} 0 Z M ${w * 0.3} ${r * 1.8} L ${w * 0.15} ${h} L ${w * 0.35} ${h * 0.82} L ${w * 0.5} ${h} L ${w * 0.65} ${h * 0.82} L ${w * 0.85} ${h} L ${w * 0.7} ${r * 1.8}`;
    }

    case 'ribbon-bookmark':
    case 'ui-bookmark':
      return `M 0 0 L ${w} 0 L ${w} ${h} L ${w / 2} ${h * 0.78} L 0 ${h} Z`;

    case 'ribbon-vertical':
      return `M 0 0 L ${w} 0 L ${w} ${h * 0.8} L ${w / 2} ${h} L 0 ${h * 0.8} Z`;

    case 'tag-discount': {
      const cut = h * 0.45;
      return `M ${cut} 0 L ${w} 0 L ${w} ${h} L ${cut} ${h} L 0 ${h / 2} Z M ${cut * 0.6} ${h / 2} A 3 3 0 1 0 ${cut * 0.6} ${h / 2 + 0.1}`;
    }

    case 'ticket-voucher':
    case 'ui-ticket': {
      const r = h * 0.18;
      return `M 0 0 L ${w} 0 L ${w} ${h * 0.5 - r} A ${r} ${r} 0 0 0 ${w} ${h * 0.5 + r} L ${w} ${h} L 0 ${h} L 0 ${h * 0.5 + r} A ${r} ${r} 0 0 0 0 ${h * 0.5 - r} Z`;
    }

    // =========================================================================
    // 7. UI & Wireframe Elements (16)
    // =========================================================================
    case 'ui-browser': {
      const barH = Math.min(22, h * 0.22);
      return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z M 0 ${barH} L ${w} ${barH} M 8 ${barH / 2} A 2.5 2.5 0 1 0 8 ${barH / 2 + 0.1} M 16 ${barH / 2} A 2.5 2.5 0 1 0 16 ${barH / 2 + 0.1} M 24 ${barH / 2} A 2.5 2.5 0 1 0 24 ${barH / 2 + 0.1}`;
    }

    case 'ui-mobile': {
      const r = 12;
      return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z M ${w * 0.4} 8 L ${w * 0.6} 8 M ${w / 2} ${h - 10} A 3.5 3.5 0 1 0 ${w / 2} ${h - 9.9}`;
    }

    case 'ui-tablet': {
      const r = 12;
      return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z M ${w / 2} 8 A 2 2 0 1 0 ${w / 2} 8.1`;
    }

    case 'ui-card': {
      const r = 8;
      return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z M 0 ${h * 0.45} L ${w} ${h * 0.45}`;
    }

    case 'ui-modal': {
      const r = 8;
      const barH = 20;
      return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z M 0 ${barH} L ${w} ${barH} M ${w - 14} 10 L ${w - 6} 10`;
    }

    case 'ui-button': {
      const r = Math.min(h / 2, 8);
      return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
    }

    case 'ui-pill': {
      const r = h / 2;
      return `M ${r} 0 L ${w - r} 0 A ${r} ${r} 0 0 1 ${w - r} ${h} L ${r} ${h} A ${r} ${r} 0 0 1 ${r} 0 Z`;
    }

    case 'ui-input':
      return `M 4 0 L ${w - 4} 0 Q ${w} 0 ${w} 4 L ${w} ${h - 4} Q ${w} ${h} ${w - 4} ${h} L 4 ${h} Q 0 ${h} 0 ${h - 4} L 0 4 Q 0 0 4 0 Z M 10 ${h * 0.25} L 10 ${h * 0.75}`;

    case 'ui-toggle-on': {
      const r = h / 2;
      return `M ${r} 0 L ${w - r} 0 A ${r} ${r} 0 0 1 ${w - r} ${h} L ${r} ${h} A ${r} ${r} 0 0 1 ${r} 0 Z M ${w - r} ${r * 0.3} A ${r * 0.7} ${r * 0.7} 0 1 1 ${w - r} ${r * 1.7} A ${r * 0.7} ${r * 0.7} 0 1 1 ${w - r} ${r * 0.3} Z`;
    }

    case 'ui-toggle-off': {
      const r = h / 2;
      return `M ${r} 0 L ${w - r} 0 A ${r} ${r} 0 0 1 ${w - r} ${h} L ${r} ${h} A ${r} ${r} 0 0 1 ${r} 0 Z M ${r} ${r * 0.3} A ${r * 0.7} ${r * 0.7} 0 1 1 ${r} ${r * 1.7} A ${r * 0.7} ${r * 0.7} 0 1 1 ${r} ${r * 0.3} Z`;
    }

    case 'ui-progress': {
      const r = h / 2;
      return `M ${r} 0 L ${w - r} 0 A ${r} ${r} 0 0 1 ${w - r} ${h} L ${r} ${h} A ${r} ${r} 0 0 1 ${r} 0 Z M ${r} 0 L ${w * 0.6} 0 L ${w * 0.6} ${h} L ${r} ${h} A ${r} ${r} 0 0 1 ${r} 0 Z`;
    }

    case 'ui-tab': {
      const cut = 12;
      return `M 0 ${cut} L ${cut} 0 L ${w * 0.45 - cut} 0 L ${w * 0.45} ${cut} L ${w} ${cut} L ${w} ${h} L 0 ${h} Z`;
    }

    case 'ui-tooltip': {
      const th = h * 0.75;
      return `M 6 0 L ${w - 6} 0 Q ${w} 0 ${w} 6 L ${w} ${th - 6} Q ${w} ${th} ${w - 6} ${th} L ${w * 0.55} ${th} L ${w * 0.5} ${h} L ${w * 0.45} ${th} L 6 ${th} Q 0 ${th} 0 ${th - 6} L 0 6 Q 0 0 6 0 Z`;
    }

    case 'ui-flag':
      return `M 0 0 L ${w} 0 L ${w * 0.8} ${h * 0.5} L ${w} ${h} L 0 ${h} Z M 0 0 L 0 ${h * 1.3}`;

    case 'ui-gear': {
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(cx, cy);
      const inR = r * 0.82;
      let d = '';
      for (let i = 0; i < 16; i++) {
        const angle = (i * Math.PI) / 8 - Math.PI / 2;
        const radius = i % 2 === 0 ? r : inR;
        const px = cx + radius * Math.cos(angle);
        const py = cy + radius * Math.sin(angle);
        d += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
      }
      return `${d} Z M ${cx} ${cy - r * 0.4} A ${r * 0.4} ${r * 0.4} 0 1 0 ${cx} ${cy + r * 0.4} A ${r * 0.4} ${r * 0.4} 0 1 0 ${cx} ${cy - r * 0.4} Z`;
    }

    // =========================================================================
    // 8. Math, Science & 3D (14)
    // =========================================================================
    case 'math-infinity': {
      const cx = w / 2;
      const cy = h / 2;
      const r = h * 0.4;
      return `M ${cx} ${cy} C ${cx - r * 0.5} ${cy - r} ${cx - r * 1.5} ${cy - r} ${cx - r * 1.5} ${cy} C ${cx - r * 1.5} ${cy + r} ${cx - r * 0.5} ${cy + r} ${cx} ${cy} C ${cx + r * 0.5} ${cy - r} ${cx + r * 1.5} ${cy - r} ${cx + r * 1.5} ${cy} C ${cx + r * 1.5} ${cy + r} ${cx + r * 0.5} ${cy + r} ${cx} ${cy} Z`;
    }

    case 'math-pi':
      return `M 0 ${h * 0.2} L ${w} ${h * 0.2} M ${w * 0.3} ${h * 0.2} L ${w * 0.25} ${h} M ${w * 0.7} ${h * 0.2} L ${w * 0.7} ${h * 0.85} Q ${w * 0.7} ${h} ${w * 0.85} ${h}`;

    case 'math-delta':
      return `M ${w / 2} 0 L ${w} ${h} L 0 ${h} Z`;

    case 'math-sqrt':
      return `M 0 ${h * 0.55} L ${w * 0.15} ${h * 0.55} L ${w * 0.28} ${h} L ${w * 0.45} 0 L ${w} 0`;

    case 'math-integral':
      return `M ${w * 0.75} 0 C ${w * 0.45} 0 ${w * 0.35} ${h * 0.15} ${w * 0.35} ${h * 0.35} L ${w * 0.35} ${h * 0.65} C ${w * 0.35} ${h * 0.85} ${w * 0.25} ${h} 0 ${h}`;

    case 'math-angle':
      return `M 0 0 L 0 ${h} L ${w} ${h} M 0 ${h * 0.65} A ${h * 0.35} ${h * 0.35} 0 0 1 ${h * 0.35} ${h}`;

    case 'math-venn': {
      const r = Math.min(w * 0.38, h * 0.5);
      return `M ${w * 0.38} ${h / 2 - r} A ${r} ${r} 0 1 0 ${w * 0.38} ${h / 2 + r} A ${r} ${r} 0 1 0 ${w * 0.38} ${h / 2 - r} Z M ${w * 0.62} ${h / 2 - r} A ${r} ${r} 0 1 0 ${w * 0.62} ${h / 2 + r} A ${r} ${r} 0 1 0 ${w * 0.62} ${h / 2 - r} Z`;
    }

    case 'math-grid':
      return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z M ${w / 3} 0 L ${w / 3} ${h} M ${(w * 2) / 3} 0 L ${(w * 2) / 3} ${h} M 0 ${h / 3} L ${w} ${h / 3} M 0 ${(h * 2) / 3} L ${w} ${(h * 2) / 3}`;

    case 'math-cube': {
      const cx = w / 2;
      const cy = h * 0.5;
      const topY = h * 0.2;
      return `M ${cx} 0 L ${w} ${topY} L ${w} ${h * 0.8} L ${cx} ${h} L 0 ${h * 0.8} L 0 ${topY} Z M ${cx} 0 L ${w} ${topY} L ${cx} ${cy} L 0 ${topY} Z M ${cx} ${cy} L ${cx} ${h}`;
    }

    case 'math-cone': {
      const ry = h * 0.15;
      return `M ${w / 2} 0 L ${w} ${h - ry} A ${w / 2} ${ry} 0 0 1 0 ${h - ry} Z`;
    }

    case 'math-pyramid':
      return `M ${w / 2} 0 L ${w} ${h * 0.85} L ${w * 0.35} ${h} L 0 ${h * 0.85} Z M ${w / 2} 0 L ${w * 0.35} ${h}`;

    case 'math-sphere': {
      const rx = w / 2;
      const ry = h / 2;
      return `M ${rx} 0 A ${rx} ${ry} 0 1 0 ${rx} ${h} A ${rx} ${ry} 0 1 0 ${rx} 0 Z M 0 ${ry} A ${rx} ${ry * 0.35} 0 0 0 ${w} ${ry} A ${rx} ${ry * 0.35} 0 0 0 0 ${ry} Z`;
    }

    case 'math-coordinate':
      return `M ${w * 0.1} 0 L ${w * 0.1} ${h * 0.9} L ${w} ${h * 0.9} M ${w * 0.05} ${h * 0.1} L ${w * 0.1} 0 L ${w * 0.15} ${h * 0.1} M ${w * 0.9} ${h * 0.85} L ${w} ${h * 0.9} L ${w * 0.9} ${h * 0.95}`;

    // =========================================================================
    // 9. Tech & Cloud Architecture (14)
    // =========================================================================
    case 'tech-cloud-cluster': {
      const ch = h * 0.85;
      return `M ${w * 0.2} ${ch * 0.8} Q 0 ${ch * 0.7} 0 ${ch * 0.5} Q 0 ${ch * 0.25} ${w * 0.25} ${ch * 0.2} Q ${w * 0.35} 0 ${w * 0.6} ${ch * 0.1} Q ${w * 0.8} 0 ${w * 0.9} ${ch * 0.3} Q ${w} ${ch * 0.4} ${w} ${ch * 0.6} Q ${w} ${ch * 0.85} ${w * 0.75} ${ch * 0.85} L ${w * 0.2} ${ch * 0.85} Z M ${w * 0.3} ${ch * 0.4} L ${w * 0.7} ${ch * 0.4}`;
    }

    case 'tech-server-rack': {
      const step = h / 3;
      return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z M 0 ${step} L ${w} ${step} M 0 ${step * 2} L ${w} ${step * 2} M 10 ${step * 0.5} A 2 2 0 1 0 10 ${step * 0.5 + 0.1} M 10 ${step * 1.5} A 2 2 0 1 0 10 ${step * 1.5 + 0.1} M 10 ${step * 2.5} A 2 2 0 1 0 10 ${step * 2.5 + 0.1}`;
    }

    case 'tech-database-cluster': {
      const ry = h * 0.1;
      return `M 0 ${ry} A ${w / 2} ${ry} 0 0 1 ${w} ${ry} L ${w} ${h * 0.45} A ${w / 2} ${ry} 0 0 1 0 ${h * 0.45} Z M 0 ${h * 0.5} A ${w / 2} ${ry} 0 0 1 ${w} ${h * 0.5} L ${w} ${h - ry} A ${w / 2} ${ry} 0 0 1 0 ${h - ry} Z`;
    }

    case 'tech-firewall': {
      const stepX = w / 4;
      const stepY = h / 3;
      return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z M 0 ${stepY} L ${w} ${stepY} M 0 ${stepY * 2} L ${w} ${stepY * 2} M ${stepX} 0 L ${stepX} ${stepY} M ${stepX * 3} 0 L ${stepX * 3} ${stepY} M ${stepX * 2} ${stepY} L ${stepX * 2} ${stepY * 2} M ${stepX} ${stepY * 2} L ${stepX} ${h} M ${stepX * 3} ${stepY * 2} L ${stepX * 3} ${h}`;
    }

    case 'tech-router': {
      const r = Math.min(w, h) / 2;
      return `M ${w / 2} 0 A ${r} ${r} 0 1 0 ${w / 2} ${h} A ${r} ${r} 0 1 0 ${w / 2} 0 Z M ${w * 0.3} ${h * 0.5} L ${w * 0.7} ${h * 0.5} M ${w * 0.5} ${h * 0.3} L ${w * 0.5} ${h * 0.7} M ${w * 0.65} ${h * 0.45} L ${w * 0.7} ${h * 0.5} L ${w * 0.65} ${h * 0.55} M ${w * 0.45} ${h * 0.35} L ${w * 0.5} ${h * 0.3} L ${w * 0.55} ${h * 0.35}`;
    }

    case 'tech-switch':
      return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z M ${w * 0.2} ${h * 0.3} L ${w * 0.8} ${h * 0.3} M ${w * 0.75} ${h * 0.25} L ${w * 0.8} ${h * 0.3} L ${w * 0.75} ${h * 0.35} M ${w * 0.8} ${h * 0.7} L ${w * 0.2} ${h * 0.7} M ${w * 0.25} ${h * 0.65} L ${w * 0.2} ${h * 0.7} L ${w * 0.25} ${h * 0.75}`;

    case 'tech-desktop': {
      const scrH = h * 0.75;
      return `M 0 0 L ${w} 0 L ${w} ${scrH} L 0 ${scrH} Z M ${w * 0.4} ${scrH} L ${w * 0.35} ${h} L ${w * 0.65} ${h} L ${w * 0.6} ${scrH}`;
    }

    case 'tech-laptop': {
      const scrH = h * 0.8;
      return `M ${w * 0.1} 0 L ${w * 0.9} 0 L ${w * 0.9} ${scrH} L ${w * 0.1} ${scrH} Z M 0 ${scrH} L ${w} ${scrH} L ${w * 0.9} ${h} L ${w * 0.1} ${h} Z`;
    }

    case 'tech-mobile-device': {
      const r = 8;
      return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z M ${w * 0.35} 6 L ${w * 0.65} 6 M ${w / 2} ${h - 8} A 2.5 2.5 0 1 0 ${w / 2} ${h - 7.9}`;
    }

    case 'tech-key-auth': {
      const r = h * 0.45;
      return `M ${r} 0 A ${r} ${r} 0 1 0 ${r} ${h} A ${r} ${r} 0 1 0 ${r} 0 Z M ${r} ${r * 0.5} A ${r * 0.5} ${r * 0.5} 0 1 1 ${r} ${r * 1.5} A ${r * 0.5} ${r * 0.5} 0 1 1 ${r} ${r * 0.5} Z M ${r * 2} ${h * 0.4} L ${w} ${h * 0.4} L ${w} ${h * 0.6} L ${r * 2} ${h * 0.6} Z M ${w * 0.7} ${h * 0.6} L ${w * 0.7} ${h * 0.85} L ${w * 0.8} ${h * 0.85} L ${w * 0.8} ${h * 0.6} M ${w * 0.88} ${h * 0.6} L ${w * 0.88} ${h * 0.85} L ${w * 0.98} ${h * 0.85} L ${w * 0.98} ${h * 0.6}`;
    }

    case 'tech-lock-secure': {
      const sh = h * 0.55;
      const r = w * 0.35;
      return `M 0 ${sh} L ${w} ${sh} L ${w} ${h} L 0 ${h} Z M ${w * 0.2} ${sh} L ${w * 0.2} ${r} A ${r} ${r} 0 0 1 ${w * 0.8} ${r} L ${w * 0.8} ${sh} M ${w / 2} ${h * 0.7} A 3.5 3.5 0 1 0 ${w / 2} ${h * 0.7 + 0.1} M ${w / 2} ${h * 0.7} L ${w / 2} ${h * 0.85}`;
    }

    case 'tech-user-node': {
      const cx = w / 2;
      const headR = Math.min(w, h) * 0.25;
      return `M ${cx} 0 A ${headR} ${headR} 0 1 0 ${cx} ${headR * 2} A ${headR} ${headR} 0 1 0 ${cx} 0 Z M ${w * 0.1} ${h} C ${w * 0.1} ${h * 0.6} ${w * 0.9} ${h * 0.6} ${w * 0.9} ${h} Z`;
    }

    case 'tech-group-nodes': {
      const headR = Math.min(w, h) * 0.18;
      return `M ${w * 0.5} 0 A ${headR} ${headR} 0 1 0 ${w * 0.5} ${headR * 2} A ${headR} ${headR} 0 1 0 ${w * 0.5} 0 Z M ${w * 0.25} ${h} C ${w * 0.25} ${h * 0.62} ${w * 0.75} ${h * 0.62} ${w * 0.75} ${h} Z M ${w * 0.2} ${h * 0.2} A ${headR * 0.8} ${headR * 0.8} 0 1 0 ${w * 0.2} ${h * 0.2 + headR * 1.6} A ${headR * 0.8} ${headR * 0.8} 0 1 0 ${w * 0.2} ${h * 0.2} Z M 0 ${h} C 0 ${h * 0.7} ${w * 0.35} ${h * 0.7} ${w * 0.35} ${h} Z M ${w * 0.8} ${h * 0.2} A ${headR * 0.8} ${headR * 0.8} 0 1 0 ${w * 0.8} ${h * 0.2 + headR * 1.6} A ${headR * 0.8} ${headR * 0.8} 0 1 0 ${w * 0.8} ${h * 0.2} Z M ${w * 0.65} ${h} C ${w * 0.65} ${h * 0.7} ${w} ${h * 0.7} ${w} ${h} Z`;
    }

    case 'tech-message-queue': {
      const step = w / 4;
      return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z M ${step} 0 L ${step} ${h} M ${step * 2} 0 L ${step * 2} ${h} M ${step * 3} 0 L ${step * 3} ${h}`;
    }

    default:
      return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
  }
}
