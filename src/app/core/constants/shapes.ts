import { ShapeCategory, ShapeDefinition } from '../models/pdf.models';

export interface ShapeCategoryInfo {
  readonly id: ShapeCategory;
  readonly label: string;
  readonly icon: string;
  readonly count: number;
}

export const SHAPE_CATEGORIES: ShapeCategoryInfo[] = [
  { id: 'basic', label: 'Basic Geometric', icon: 'fa-solid fa-shapes', count: 20 },
  { id: 'arrows', label: 'Arrows & Directions', icon: 'fa-solid fa-arrows-up-down-left-right', count: 18 },
  { id: 'flowchart', label: 'Flowchart & Diagrams', icon: 'fa-solid fa-diagram-project', count: 18 },
  { id: 'callouts', label: 'Callouts & Speech', icon: 'fa-solid fa-comment-dots', count: 16 },
  { id: 'symbols', label: 'Symbols & Decorative', icon: 'fa-solid fa-star', count: 20 },
  { id: 'banners', label: 'Banners & Badges', icon: 'fa-solid fa-ribbon', count: 14 },
  { id: 'ui', label: 'UI & Wireframes', icon: 'fa-solid fa-desktop', count: 16 },
  { id: 'math', label: 'Math, Science & 3D', icon: 'fa-solid fa-square-root-variable', count: 14 },
  { id: 'tech', label: 'Tech & Cloud Nodes', icon: 'fa-solid fa-server', count: 14 },
];

export const SHAPE_DEFINITIONS: ShapeDefinition[] = [
  // =========================================================================
  // 1. Basic Geometric & Polygons (20)
  // =========================================================================
  { id: 'rectangle', label: 'Rectangle', category: 'basic', icon: 'fa-regular fa-square', defaultWidth: 140, defaultHeight: 90 },
  { id: 'square', label: 'Square', category: 'basic', icon: 'fa-regular fa-square', defaultWidth: 100, defaultHeight: 100 },
  { id: 'rounded-rectangle', label: 'Rounded Rect', category: 'basic', icon: 'fa-solid fa-square', defaultWidth: 140, defaultHeight: 90 },
  { id: 'circle', label: 'Circle', category: 'basic', icon: 'fa-regular fa-circle', defaultWidth: 100, defaultHeight: 100 },
  { id: 'ellipse', label: 'Ellipse / Oval', category: 'basic', icon: 'fa-regular fa-circle', defaultWidth: 140, defaultHeight: 90 },
  { id: 'semi-circle', label: 'Semicircle', category: 'basic', icon: 'fa-solid fa-circle-half-stroke', defaultWidth: 140, defaultHeight: 70 },
  { id: 'triangle', label: 'Triangle', category: 'basic', icon: 'fa-solid fa-play fa-rotate-270', defaultWidth: 110, defaultHeight: 95 },
  { id: 'triangle-right', label: 'Right Triangle', category: 'basic', icon: 'fa-solid fa-play', defaultWidth: 110, defaultHeight: 95 },
  { id: 'diamond', label: 'Diamond', category: 'basic', icon: 'fa-solid fa-diamond', defaultWidth: 110, defaultHeight: 110 },
  { id: 'parallelogram', label: 'Parallelogram', category: 'basic', icon: 'fa-solid fa-vector-square', defaultWidth: 140, defaultHeight: 85 },
  { id: 'trapezoid', label: 'Trapezoid', category: 'basic', icon: 'fa-solid fa-draw-polygon', defaultWidth: 140, defaultHeight: 85 },
  { id: 'pentagon', label: 'Pentagon', category: 'basic', icon: 'fa-solid fa-shapes', defaultWidth: 110, defaultHeight: 105 },
  { id: 'hexagon', label: 'Hexagon', category: 'basic', icon: 'fa-solid fa-certificate', defaultWidth: 120, defaultHeight: 105 },
  { id: 'heptagon', label: 'Heptagon (7)', category: 'basic', icon: 'fa-solid fa-circle-notch', defaultWidth: 115, defaultHeight: 110 },
  { id: 'octagon', label: 'Octagon (8)', category: 'basic', icon: 'fa-solid fa-stop', defaultWidth: 110, defaultHeight: 110 },
  { id: 'decagon', label: 'Decagon (10)', category: 'basic', icon: 'fa-solid fa-gear', defaultWidth: 115, defaultHeight: 115 },
  { id: 'cross-poly', label: 'Cross Poly', category: 'basic', icon: 'fa-solid fa-plus', defaultWidth: 110, defaultHeight: 110 },
  { id: 'ring-donut', label: 'Donut / Ring', category: 'basic', icon: 'fa-regular fa-circle-dot', defaultWidth: 110, defaultHeight: 110 },
  { id: 'teardrop', label: 'Teardrop', category: 'basic', icon: 'fa-solid fa-droplet', defaultWidth: 90, defaultHeight: 120 },
  { id: 'corner-cut-rect', label: 'Snip Corner Rect', category: 'basic', icon: 'fa-solid fa-file', defaultWidth: 140, defaultHeight: 90 },

  // =========================================================================
  // 2. Arrows & Directions (18)
  // =========================================================================
  { id: 'arrow-right', label: 'Right Arrow', category: 'arrows', icon: 'fa-solid fa-arrow-right', defaultWidth: 140, defaultHeight: 60 },
  { id: 'arrow-left', label: 'Left Arrow', category: 'arrows', icon: 'fa-solid fa-arrow-left', defaultWidth: 140, defaultHeight: 60 },
  { id: 'arrow-up', label: 'Up Arrow', category: 'arrows', icon: 'fa-solid fa-arrow-up', defaultWidth: 60, defaultHeight: 140 },
  { id: 'arrow-down', label: 'Down Arrow', category: 'arrows', icon: 'fa-solid fa-arrow-down', defaultWidth: 60, defaultHeight: 140 },
  { id: 'arrow-up-down', label: 'Up-Down Arrow', category: 'arrows', icon: 'fa-solid fa-arrows-up-down', defaultWidth: 60, defaultHeight: 140 },
  { id: 'arrow-left-right', label: 'Left-Right Arrow', category: 'arrows', icon: 'fa-solid fa-arrows-left-right', defaultWidth: 140, defaultHeight: 60 },
  { id: 'arrow-double', label: 'Double Arrow', category: 'arrows', icon: 'fa-solid fa-angles-right', defaultWidth: 140, defaultHeight: 60 },
  { id: 'arrow-curved', label: 'Curved Turn', category: 'arrows', icon: 'fa-solid fa-arrow-turn-down', defaultWidth: 110, defaultHeight: 110 },
  { id: 'arrow-circular', label: 'Circular Refresh', category: 'arrows', icon: 'fa-solid fa-arrow-rotate-right', defaultWidth: 110, defaultHeight: 110 },
  { id: 'arrow-uturn', label: 'U-Turn Arrow', category: 'arrows', icon: 'fa-solid fa-reply-all', defaultWidth: 100, defaultHeight: 130 },
  { id: 'arrow-split', label: 'Split Arrow', category: 'arrows', icon: 'fa-solid fa-code-fork', defaultWidth: 130, defaultHeight: 100 },
  { id: 'arrow-fork', label: 'Fork / Merge Arrow', category: 'arrows', icon: 'fa-solid fa-code-merge', defaultWidth: 130, defaultHeight: 100 },
  { id: 'arrow-quad', label: '4-Way Quad Arrow', category: 'arrows', icon: 'fa-solid fa-arrows-up-down-left-right', defaultWidth: 120, defaultHeight: 120 },
  { id: 'chevron', label: 'Chevron', category: 'arrows', icon: 'fa-solid fa-chevron-right', defaultWidth: 120, defaultHeight: 80 },
  { id: 'chevron-double', label: 'Double Chevron', category: 'arrows', icon: 'fa-solid fa-angles-right', defaultWidth: 130, defaultHeight: 80 },
  { id: 'arrow-bent', label: '90° Bent Arrow', category: 'arrows', icon: 'fa-solid fa-share', defaultWidth: 110, defaultHeight: 110 },
  { id: 'arrow-step', label: 'Step Arrow', category: 'arrows', icon: 'fa-solid fa-stairs', defaultWidth: 130, defaultHeight: 80 },
  { id: 'arrow-callout', label: 'Callout Arrow', category: 'arrows', icon: 'fa-solid fa-arrow-pointer', defaultWidth: 140, defaultHeight: 80 },

  // =========================================================================
  // 3. Diagram & Flowchart (18)
  // =========================================================================
  { id: 'flow-process', label: 'Process / Action', category: 'flowchart', icon: 'fa-regular fa-square', defaultWidth: 140, defaultHeight: 80 },
  { id: 'flow-decision', label: 'Decision / Branch', category: 'flowchart', icon: 'fa-solid fa-diamond', defaultWidth: 130, defaultHeight: 90 },
  { id: 'flow-terminator', label: 'Start / End', category: 'flowchart', icon: 'fa-solid fa-capsules', defaultWidth: 140, defaultHeight: 65 },
  { id: 'flow-data', label: 'Data / I-O', category: 'flowchart', icon: 'fa-solid fa-vector-square', defaultWidth: 140, defaultHeight: 80 },
  { id: 'flow-document', label: 'Document', category: 'flowchart', icon: 'fa-regular fa-file', defaultWidth: 130, defaultHeight: 95 },
  { id: 'flow-multi-document', label: 'Multi-Document', category: 'flowchart', icon: 'fa-solid fa-copy', defaultWidth: 135, defaultHeight: 100 },
  { id: 'flow-database', label: 'Database Storage', category: 'flowchart', icon: 'fa-solid fa-database', defaultWidth: 110, defaultHeight: 120 },
  { id: 'flow-predefined', label: 'Predefined Process', category: 'flowchart', icon: 'fa-solid fa-table-columns', defaultWidth: 140, defaultHeight: 80 },
  { id: 'flow-manual-input', label: 'Manual Input', category: 'flowchart', icon: 'fa-solid fa-keyboard', defaultWidth: 140, defaultHeight: 80 },
  { id: 'flow-manual-operation', label: 'Manual Operation', category: 'flowchart', icon: 'fa-solid fa-hand-pointer', defaultWidth: 140, defaultHeight: 80 },
  { id: 'flow-delay', label: 'Delay', category: 'flowchart', icon: 'fa-solid fa-clock', defaultWidth: 130, defaultHeight: 80 },
  { id: 'flow-connector', label: 'Connector (On-Page)', category: 'flowchart', icon: 'fa-regular fa-circle-dot', defaultWidth: 70, defaultHeight: 70 },
  { id: 'flow-off-page', label: 'Off-Page Connector', category: 'flowchart', icon: 'fa-solid fa-tag', defaultWidth: 85, defaultHeight: 95 },
  { id: 'flow-preparation', label: 'Preparation', category: 'flowchart', icon: 'fa-solid fa-certificate', defaultWidth: 140, defaultHeight: 75 },
  { id: 'flow-internal-storage', label: 'Internal Storage', category: 'flowchart', icon: 'fa-solid fa-table-cells-large', defaultWidth: 120, defaultHeight: 90 },
  { id: 'flow-summing', label: 'Summing Junction', category: 'flowchart', icon: 'fa-solid fa-circle-nodes', defaultWidth: 90, defaultHeight: 90 },
  { id: 'flow-collate', label: 'Collate Operation', category: 'flowchart', icon: 'fa-solid fa-hourglass-half', defaultWidth: 110, defaultHeight: 110 },
  { id: 'flow-display', label: 'Display Output', category: 'flowchart', icon: 'fa-solid fa-tv', defaultWidth: 140, defaultHeight: 80 },

  // =========================================================================
  // 4. Callouts & Speech (16)
  // =========================================================================
  { id: 'callout-speech', label: 'Speech Bubble', category: 'callouts', icon: 'fa-solid fa-comment', defaultWidth: 140, defaultHeight: 110 },
  { id: 'callout-thought', label: 'Thought Bubble', category: 'callouts', icon: 'fa-solid fa-cloud', defaultWidth: 140, defaultHeight: 110 },
  { id: 'callout-cloud', label: 'Cloud Callout', category: 'callouts', icon: 'fa-solid fa-cloud-arrow-up', defaultWidth: 140, defaultHeight: 110 },
  { id: 'callout-rect', label: 'Rectangular Callout', category: 'callouts', icon: 'fa-regular fa-comment', defaultWidth: 140, defaultHeight: 100 },
  { id: 'callout-rounded', label: 'Rounded Callout', category: 'callouts', icon: 'fa-solid fa-message', defaultWidth: 140, defaultHeight: 100 },
  { id: 'callout-oval', label: 'Oval Callout', category: 'callouts', icon: 'fa-regular fa-comment-dots', defaultWidth: 140, defaultHeight: 100 },
  { id: 'callout-left', label: 'Left Speech Bubble', category: 'callouts', icon: 'fa-solid fa-comment-sms', defaultWidth: 140, defaultHeight: 100 },
  { id: 'callout-right', label: 'Right Speech Bubble', category: 'callouts', icon: 'fa-solid fa-comments', defaultWidth: 140, defaultHeight: 100 },
  { id: 'callout-arrow', label: 'Arrow Callout', category: 'callouts', icon: 'fa-solid fa-arrow-pointer', defaultWidth: 140, defaultHeight: 90 },
  { id: 'callout-shout', label: 'Shout / Burst Callout', category: 'callouts', icon: 'fa-solid fa-burst', defaultWidth: 150, defaultHeight: 120 },
  { id: 'callout-caption', label: 'Caption Box', category: 'callouts', icon: 'fa-solid fa-closed-captioning', defaultWidth: 140, defaultHeight: 70 },
  { id: 'callout-label', label: 'Label Tag', category: 'callouts', icon: 'fa-solid fa-tag', defaultWidth: 130, defaultHeight: 75 },
  { id: 'callout-price-tag', label: 'Price Tag', category: 'callouts', icon: 'fa-solid fa-tags', defaultWidth: 130, defaultHeight: 75 },
  { id: 'callout-bracket', label: 'Bracket Box', category: 'callouts', icon: 'fa-solid fa-code', defaultWidth: 130, defaultHeight: 90 },
  { id: 'callout-curly-left', label: 'Left Curly Bracket', category: 'callouts', icon: 'fa-solid fa-bracket-curly', defaultWidth: 60, defaultHeight: 140 },
  { id: 'callout-curly-right', label: 'Right Curly Bracket', category: 'callouts', icon: 'fa-solid fa-bracket-curly-right', defaultWidth: 60, defaultHeight: 140 },

  // =========================================================================
  // 5. Symbols & Decorative (20)
  // =========================================================================
  { id: 'symbol-star', label: '5-Point Star', category: 'symbols', icon: 'fa-solid fa-star', defaultWidth: 110, defaultHeight: 110 },
  { id: 'symbol-star-4', label: '4-Point Star', category: 'symbols', icon: 'fa-solid fa-star-of-life', defaultWidth: 110, defaultHeight: 110 },
  { id: 'symbol-star-6', label: '6-Point Star', category: 'symbols', icon: 'fa-solid fa-star-of-david', defaultWidth: 110, defaultHeight: 110 },
  { id: 'symbol-star-8', label: '8-Point Star', category: 'symbols', icon: 'fa-solid fa-sun', defaultWidth: 110, defaultHeight: 110 },
  { id: 'symbol-heart', label: 'Heart', category: 'symbols', icon: 'fa-solid fa-heart', defaultWidth: 110, defaultHeight: 100 },
  { id: 'symbol-cross', label: 'Cross / X Mark', category: 'symbols', icon: 'fa-solid fa-xmark', defaultWidth: 100, defaultHeight: 100 },
  { id: 'symbol-plus', label: 'Plus', category: 'symbols', icon: 'fa-solid fa-plus', defaultWidth: 100, defaultHeight: 100 },
  { id: 'symbol-minus', label: 'Minus', category: 'symbols', icon: 'fa-solid fa-minus', defaultWidth: 120, defaultHeight: 50 },
  { id: 'symbol-lightning', label: 'Lightning Bolt', category: 'symbols', icon: 'fa-solid fa-bolt', defaultWidth: 90, defaultHeight: 130 },
  { id: 'symbol-cloud', label: 'Weather Cloud', category: 'symbols', icon: 'fa-solid fa-cloud', defaultWidth: 140, defaultHeight: 90 },
  { id: 'symbol-sun', label: 'Sun', category: 'symbols', icon: 'fa-solid fa-sun', defaultWidth: 110, defaultHeight: 110 },
  { id: 'symbol-moon', label: 'Crescent Moon', category: 'symbols', icon: 'fa-solid fa-moon', defaultWidth: 95, defaultHeight: 110 },
  { id: 'symbol-checkmark', label: 'Checkmark', category: 'symbols', icon: 'fa-solid fa-check', defaultWidth: 110, defaultHeight: 90 },
  { id: 'symbol-warning', label: 'Warning Alert', category: 'symbols', icon: 'fa-solid fa-triangle-exclamation', defaultWidth: 110, defaultHeight: 100 },
  { id: 'symbol-prohibited', label: 'Prohibited / Ban', category: 'symbols', icon: 'fa-solid fa-ban', defaultWidth: 105, defaultHeight: 105 },
  { id: 'symbol-info', label: 'Info Circle', category: 'symbols', icon: 'fa-solid fa-circle-info', defaultWidth: 105, defaultHeight: 105 },
  { id: 'symbol-help', label: 'Question Mark', category: 'symbols', icon: 'fa-solid fa-circle-question', defaultWidth: 105, defaultHeight: 105 },
  { id: 'symbol-location', label: 'Map Pin', category: 'symbols', icon: 'fa-solid fa-location-dot', defaultWidth: 95, defaultHeight: 130 },
  { id: 'symbol-flame', label: 'Fire / Flame', category: 'symbols', icon: 'fa-solid fa-fire', defaultWidth: 95, defaultHeight: 130 },
  { id: 'symbol-droplet', label: 'Water Drop', category: 'symbols', icon: 'fa-solid fa-droplet', defaultWidth: 95, defaultHeight: 130 },

  // =========================================================================
  // 6. Banners, Ribbons & Badges (14)
  // =========================================================================
  { id: 'banner-classic', label: 'Classic Banner', category: 'banners', icon: 'fa-solid fa-ribbon', defaultWidth: 150, defaultHeight: 65 },
  { id: 'banner-curved-up', label: 'Arch Banner', category: 'banners', icon: 'fa-solid fa-scroll', defaultWidth: 150, defaultHeight: 70 },
  { id: 'banner-curved-down', label: 'Smile Banner', category: 'banners', icon: 'fa-solid fa-scroll', defaultWidth: 150, defaultHeight: 70 },
  { id: 'banner-swallowtail', label: 'Swallowtail Banner', category: 'banners', icon: 'fa-solid fa-flag', defaultWidth: 150, defaultHeight: 65 },
  { id: 'banner-ribbon-folded', label: 'Folded Ribbon', category: 'banners', icon: 'fa-solid fa-ribbon', defaultWidth: 150, defaultHeight: 75 },
  { id: 'badge-starburst', label: 'Starburst Badge', category: 'banners', icon: 'fa-solid fa-certificate', defaultWidth: 110, defaultHeight: 110 },
  { id: 'badge-rosette', label: 'Rosette Badge', category: 'banners', icon: 'fa-solid fa-medal', defaultWidth: 110, defaultHeight: 130 },
  { id: 'badge-shield', label: 'Shield Badge', category: 'banners', icon: 'fa-solid fa-shield-halved', defaultWidth: 105, defaultHeight: 120 },
  { id: 'badge-seal', label: 'Wax Seal Stamp', category: 'banners', icon: 'fa-solid fa-stamp', defaultWidth: 110, defaultHeight: 110 },
  { id: 'badge-award', label: 'Award Medal', category: 'banners', icon: 'fa-solid fa-award', defaultWidth: 100, defaultHeight: 140 },
  { id: 'ribbon-bookmark', label: 'Bookmark Ribbon', category: 'banners', icon: 'fa-solid fa-bookmark', defaultWidth: 80, defaultHeight: 130 },
  { id: 'ribbon-vertical', label: 'Hanging Banner', category: 'banners', icon: 'fa-solid fa-flag-checkered', defaultWidth: 90, defaultHeight: 140 },
  { id: 'tag-discount', label: 'Discount Tag', category: 'banners', icon: 'fa-solid fa-percent', defaultWidth: 130, defaultHeight: 75 },
  { id: 'ticket-voucher', label: 'Perforated Ticket', category: 'banners', icon: 'fa-solid fa-ticket', defaultWidth: 140, defaultHeight: 80 },

  // =========================================================================
  // 7. UI & Wireframe Elements (16)
  // =========================================================================
  { id: 'ui-browser', label: 'Browser Window', category: 'ui', icon: 'fa-solid fa-window-maximize', defaultWidth: 150, defaultHeight: 110 },
  { id: 'ui-mobile', label: 'Smartphone Frame', category: 'ui', icon: 'fa-solid fa-mobile-screen', defaultWidth: 85, defaultHeight: 150 },
  { id: 'ui-tablet', label: 'Tablet Frame', category: 'ui', icon: 'fa-solid fa-tablet-screen-button', defaultWidth: 130, defaultHeight: 160 },
  { id: 'ui-card', label: 'Card Container', category: 'ui', icon: 'fa-solid fa-id-card', defaultWidth: 140, defaultHeight: 100 },
  { id: 'ui-modal', label: 'Modal Dialog', category: 'ui', icon: 'fa-solid fa-window-restore', defaultWidth: 140, defaultHeight: 100 },
  { id: 'ui-button', label: 'Button Element', category: 'ui', icon: 'fa-solid fa-toggle-on', defaultWidth: 120, defaultHeight: 45 },
  { id: 'ui-pill', label: 'Pill / Capsule', category: 'ui', icon: 'fa-solid fa-capsules', defaultWidth: 140, defaultHeight: 60 },
  { id: 'ui-input', label: 'Text Input Field', category: 'ui', icon: 'fa-solid fa-i-cursor', defaultWidth: 140, defaultHeight: 45 },
  { id: 'ui-toggle-on', label: 'Toggle Switch (On)', category: 'ui', icon: 'fa-solid fa-toggle-on', defaultWidth: 90, defaultHeight: 45 },
  { id: 'ui-toggle-off', label: 'Toggle Switch (Off)', category: 'ui', icon: 'fa-solid fa-toggle-off', defaultWidth: 90, defaultHeight: 45 },
  { id: 'ui-progress', label: 'Progress Bar', category: 'ui', icon: 'fa-solid fa-bars-progress', defaultWidth: 140, defaultHeight: 35 },
  { id: 'ui-tab', label: 'Folder Tab', category: 'ui', icon: 'fa-solid fa-folder', defaultWidth: 140, defaultHeight: 85 },
  { id: 'ui-tooltip', label: 'Tooltip Box', category: 'ui', icon: 'fa-solid fa-message', defaultWidth: 120, defaultHeight: 60 },
  { id: 'ui-flag', label: 'Notification Flag', category: 'ui', icon: 'fa-solid fa-flag', defaultWidth: 130, defaultHeight: 90 },
  { id: 'ui-shield', label: 'Security Shield', category: 'ui', icon: 'fa-solid fa-shield', defaultWidth: 105, defaultHeight: 120 },
  { id: 'ui-gear', label: 'Settings Gear', category: 'ui', icon: 'fa-solid fa-gear', defaultWidth: 110, defaultHeight: 110 },

  // =========================================================================
  // 8. Math, Science & 3D (14)
  // =========================================================================
  { id: 'math-infinity', label: 'Infinity (∞)', category: 'math', icon: 'fa-solid fa-infinity', defaultWidth: 130, defaultHeight: 65 },
  { id: 'math-pi', label: 'Pi Symbol (π)', category: 'math', icon: 'fa-solid fa-square-root-variable', defaultWidth: 110, defaultHeight: 100 },
  { id: 'math-delta', label: 'Delta Triangle (Δ)', category: 'math', icon: 'fa-solid fa-play fa-rotate-270', defaultWidth: 110, defaultHeight: 100 },
  { id: 'math-sqrt', label: 'Square Root (√)', category: 'math', icon: 'fa-solid fa-square-root-variable', defaultWidth: 120, defaultHeight: 85 },
  { id: 'math-integral', label: 'Integral Sign (∫)', category: 'math', icon: 'fa-solid fa-italic', defaultWidth: 60, defaultHeight: 140 },
  { id: 'math-angle', label: 'Geometric Angle (∠)', category: 'math', icon: 'fa-solid fa-ruler-combined', defaultWidth: 110, defaultHeight: 90 },
  { id: 'math-venn', label: '2-Set Venn Diagram', category: 'math', icon: 'fa-solid fa-circle-nodes', defaultWidth: 140, defaultHeight: 90 },
  { id: 'math-grid', label: '3x3 Matrix Grid', category: 'math', icon: 'fa-solid fa-table-cells', defaultWidth: 110, defaultHeight: 110 },
  { id: 'math-cube', label: '3D Isometric Cube', category: 'math', icon: 'fa-solid fa-cube', defaultWidth: 110, defaultHeight: 120 },
  { id: 'math-cylinder', label: '3D Cylinder', category: 'math', icon: 'fa-solid fa-database', defaultWidth: 100, defaultHeight: 130 },
  { id: 'math-cone', label: '3D Cone', category: 'math', icon: 'fa-solid fa-ice-cream', defaultWidth: 100, defaultHeight: 130 },
  { id: 'math-pyramid', label: '3D Pyramid', category: 'math', icon: 'fa-solid fa-mountain', defaultWidth: 120, defaultHeight: 110 },
  { id: 'math-sphere', label: '3D Sphere', category: 'math', icon: 'fa-solid fa-globe', defaultWidth: 110, defaultHeight: 110 },
  { id: 'math-coordinate', label: 'Coordinate Axes', category: 'math', icon: 'fa-solid fa-chart-line', defaultWidth: 120, defaultHeight: 120 },

  // =========================================================================
  // 9. Tech & Cloud Architecture (14)
  // =========================================================================
  { id: 'tech-cloud-cluster', label: 'Cloud Infra', category: 'tech', icon: 'fa-solid fa-cloud', defaultWidth: 140, defaultHeight: 90 },
  { id: 'tech-server-rack', label: 'Server Blade', category: 'tech', icon: 'fa-solid fa-server', defaultWidth: 120, defaultHeight: 100 },
  { id: 'tech-database-cluster', label: 'Database Cluster', category: 'tech', icon: 'fa-solid fa-database', defaultWidth: 110, defaultHeight: 130 },
  { id: 'tech-firewall', label: 'Security Firewall', category: 'tech', icon: 'fa-solid fa-shield-virus', defaultWidth: 120, defaultHeight: 100 },
  { id: 'tech-router', label: 'Router Node', category: 'tech', icon: 'fa-solid fa-route', defaultWidth: 110, defaultHeight: 90 },
  { id: 'tech-switch', label: 'Switch Hub', category: 'tech', icon: 'fa-solid fa-network-wired', defaultWidth: 130, defaultHeight: 75 },
  { id: 'tech-desktop', label: 'Desktop Workstation', category: 'tech', icon: 'fa-solid fa-desktop', defaultWidth: 130, defaultHeight: 110 },
  { id: 'tech-laptop', label: 'Laptop Client', category: 'tech', icon: 'fa-solid fa-laptop', defaultWidth: 135, defaultHeight: 95 },
  { id: 'tech-mobile-device', label: 'Mobile Client', category: 'tech', icon: 'fa-solid fa-mobile-screen', defaultWidth: 80, defaultHeight: 140 },
  { id: 'tech-key-auth', label: 'Auth Key', category: 'tech', icon: 'fa-solid fa-key', defaultWidth: 130, defaultHeight: 65 },
  { id: 'tech-lock-secure', label: 'Security Padlock', category: 'tech', icon: 'fa-solid fa-lock', defaultWidth: 100, defaultHeight: 130 },
  { id: 'tech-user-node', label: 'User Node', category: 'tech', icon: 'fa-solid fa-user', defaultWidth: 100, defaultHeight: 110 },
  { id: 'tech-group-nodes', label: 'User Cluster', category: 'tech', icon: 'fa-solid fa-users', defaultWidth: 130, defaultHeight: 100 },
  { id: 'tech-message-queue', label: 'Message Queue', category: 'tech', icon: 'fa-solid fa-bars-staggered', defaultWidth: 140, defaultHeight: 70 },
];
