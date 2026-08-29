import { TestBed } from '@angular/core/testing';
import { EditorStateService } from './editor-state.service';
import { EditorPagesService } from './editor-pages.service';
import {
  ShapeAnnotation,
  TextAnnotation,
  DrawingAnnotation,
} from '../../../core/models/pdf.models';

class EditorPagesStub {
  currentId(): string | null {
    return 'page-1';
  }
}

describe('EditorStateService', () => {
  let state: EditorStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        EditorStateService,
        { provide: EditorPagesService, useClass: EditorPagesStub },
      ],
    });
    state = TestBed.inject(EditorStateService);
  });

  function makeText(overrides: Partial<TextAnnotation> = {}): TextAnnotation {
    return {
      id: crypto.randomUUID(),
      type: 'text',
      pageIndex: 0,
      rect: { x: 10, y: 20, width: 100, height: 30 },
      rotation: 0,
      opacity: 1,
      createdAt: Date.now(),
      text: 'Hello',
      fontFamily: 'sans-serif',
      fontSize: 16,
      fontWeight: 400,
      italic: false,
      underline: false,
      align: 'left',
      color: '#111111',
      ...overrides,
    };
  }

  function makeShape(overrides: Partial<ShapeAnnotation> = {}): ShapeAnnotation {
    return {
      id: crypto.randomUUID(),
      type: 'shape',
      kind: 'rectangle',
      pageIndex: 0,
      rect: { x: 0, y: 0, width: 50, height: 50 },
      rotation: 0,
      opacity: 1,
      createdAt: Date.now(),
      strokeColor: '#000',
      fillColor: 'transparent',
      strokeWidth: 2,
      strokeStyle: 'solid',
      ...overrides,
    };
  }

  it('adds, selects, updates and removes annotations on a page', () => {
    const text = makeText();
    state.addAnnotation('page-1', text);
    expect(state.annotationsFor('page-1').length).toBe(1);
    expect(state.selectedId()).toBe(text.id);
    state.updateAnnotation(text.id, { text: 'Updated' });
    expect((state.annotationsFor('page-1')[0] as TextAnnotation).text).toBe('Updated');
    state.removeAnnotation(text.id);
    expect(state.annotationsFor('page-1').length).toBe(0);
    expect(state.selectedId()).toBeNull();
  });

  it('duplicates an annotation and selects the new copy', () => {
    const shape = makeShape();
    state.addAnnotation('page-1', shape);
    const newId = state.duplicateAnnotation(shape.id);
    expect(newId).not.toBeNull();
    expect(state.annotationsFor('page-1').length).toBe(2);
    expect(state.selectedId()).toBe(newId!);
    const copy = state.annotationsFor('page-1').find((a) => a.id === newId);
    expect(copy).toBeDefined();
    expect(copy!.rect.x).toBe(shape.rect.x + 12);
    expect(copy!.rect.y).toBe(shape.rect.y + 12);
  });

  it('reorders an annotation forward and backward', () => {
    const a = makeShape({ id: 'a' });
    const b = makeShape({ id: 'b' });
    const c = makeShape({ id: 'c' });
    state.addAnnotation('page-1', a);
    state.addAnnotation('page-1', b);
    state.addAnnotation('page-1', c);
    const orderBefore = state.annotationsFor('page-1').map((x) => x.id);
    expect(orderBefore).toEqual(['a', 'b', 'c']);
    state.reorderAnnotation('a', 1);
    const orderAfter1 = state.annotationsFor('page-1').map((x) => x.id);
    expect(orderAfter1).toEqual(['b', 'a', 'c']);
    state.reorderAnnotation('c', -1);
    const orderAfter2 = state.annotationsFor('page-1').map((x) => x.id);
    expect(orderAfter2).toEqual(['b', 'c', 'a']);
  });

  it('brings annotation to the front and sends to the back', () => {
    const a = makeShape({ id: 'a' });
    const b = makeShape({ id: 'b' });
    const c = makeShape({ id: 'c' });
    state.addAnnotation('page-1', a);
    state.addAnnotation('page-1', b);
    state.addAnnotation('page-1', c);
    state.bringToFront('a');
    expect(state.annotationsFor('page-1').map((x) => x.id)).toEqual(['b', 'c', 'a']);
    state.sendToBack('c');
    expect(state.annotationsFor('page-1').map((x) => x.id)).toEqual(['c', 'b', 'a']);
  });

  it('nudges an annotation by delta x and y', () => {
    const text = makeText({ rect: { x: 50, y: 50, width: 100, height: 30 } });
    state.addAnnotation('page-1', text);
    state.nudgeAnnotation(text.id, 5, -10);
    const updated = state.annotationsFor('page-1')[0];
    expect(updated.rect.x).toBe(55);
    expect(updated.rect.y).toBe(40);
  });

  it('scales annotation bounds with the rendered page viewport', () => {
    const text = makeText({ rect: { x: 10, y: 20, width: 100, height: 30 } });
    state.addAnnotation('page-1', text);

    state.scaleAnnotations('page-1', 1.5, 2);

    expect(state.annotationsFor('page-1')[0].rect).toEqual({
      x: 15,
      y: 40,
      width: 150,
      height: 60,
    });
  });

  it('scales text typography with the rendered page viewport', () => {
    const text = makeText({
      fontSize: 16,
      letterSpacing: 2,
      backgroundPadding: 6,
    });
    state.addAnnotation('page-1', text);

    state.scaleAnnotations('page-1', 1.5, 1.5);

    const scaled = state.annotationsFor('page-1')[0] as TextAnnotation;
    expect(scaled.fontSize).toBe(24);
    expect(scaled.letterSpacing).toBe(3);
    expect(scaled.backgroundPadding).toBe(9);
  });

  it('scales drawing points, strokeWidth, and shape properties with the rendered page viewport', () => {
    const drawing: DrawingAnnotation = {
      id: 'd1',
      type: 'drawing',
      kind: 'freehand',
      pageIndex: 0,
      rect: { x: 10, y: 20, width: 50, height: 50 },
      rotation: 0,
      opacity: 1,
      createdAt: Date.now(),
      color: '#dc2626',
      strokeWidth: 4,
      points: [
        { x: 10, y: 20 },
        { x: 60, y: 70 },
      ],
    };
    state.addAnnotation('page-2', drawing);
    state.scaleAnnotations('page-2', 2, 2);

    const scaled = state.annotationsFor('page-2')[0] as DrawingAnnotation;
    expect(scaled.rect).toEqual({ x: 20, y: 40, width: 100, height: 100 });
    expect(scaled.strokeWidth).toBe(8);
    expect(scaled.points).toEqual([
      { x: 20, y: 40 },
      { x: 120, y: 140 },
    ]);
  });

  it('locks an annotation against updates, nudges, and deletion', () => {
    const text = makeText({ id: 'locked-text' });
    state.addAnnotation('page-1', text);
    expect(state.toggleLock(text.id)).toBeTrue();

    state.updateAnnotation(text.id, { text: 'Changed' });
    state.nudgeAnnotation(text.id, 20, 20);
    state.removeAnnotation(text.id);

    const locked = state.annotationsFor('page-1')[0] as TextAnnotation;
    expect(locked.text).toBe('Hello');
    expect(locked.rect).toEqual(text.rect);
    expect(locked.locked).toBeTrue();

    expect(state.toggleLock(text.id)).toBeFalse();
    state.removeAnnotation(text.id);
    expect(state.annotationsFor('page-1')).toHaveSize(0);
  });

  it('adds and updates drawing annotations', () => {
    const drawing: DrawingAnnotation = {
      id: 'draw-1',
      type: 'drawing',
      kind: 'freehand',
      pageIndex: 0,
      rect: { x: 10, y: 10, width: 80, height: 80 },
      rotation: 0,
      opacity: 1,
      createdAt: Date.now(),
      color: '#dc2626',
      strokeWidth: 4,
      points: [
        { x: 10, y: 10 },
        { x: 50, y: 60 },
        { x: 90, y: 90 },
      ],
    };
    state.addAnnotation('page-1', drawing);
    expect(state.annotationsFor('page-1')).toHaveSize(1);
    expect(state.selectedId()).toBe('draw-1');

    state.updateAnnotation('draw-1', { color: '#2563eb', strokeWidth: 8 });
    const updated = state.annotationsFor('page-1')[0] as DrawingAnnotation;
    expect(updated.color).toBe('#2563eb');
    expect(updated.strokeWidth).toBe(8);
  });

  it('configures eraser settings and clears page marks while preserving locked objects', () => {
    state.setEraserMode('segment');
    expect(state.eraserMode()).toBe('segment');

    state.setEraserSize(5);
    expect(state.eraserSize()).toBe(8); // clamped to min 8

    state.setEraserSize(72.00);
    expect(state.eraserSize()).toBe(72);

    state.setEraserSize(24.5);
    expect(state.eraserSize()).toBe(24.5);

    state.setEraserTolerance(0.85);
    expect(state.eraserTolerance()).toBe(0.85);

    state.setEraserTarget('drawing');
    expect(state.eraserTarget()).toBe('drawing');

    const unlocked = makeText({ id: 'u1' });
    const locked = makeText({ id: 'l1', locked: true });
    state.addAnnotation('page-1', unlocked);
    state.addAnnotation('page-1', locked);
    expect(state.annotationsFor('page-1')).toHaveSize(2);

    state.clearPageAnnotations('page-1');
    const remaining = state.annotationsFor('page-1');
    expect(remaining).toHaveSize(1);
    expect(remaining[0].id).toBe('l1');
  });

  it('returns null from duplicate when the id is missing', () => {
    expect(state.duplicateAnnotation('missing')).toBeNull();
  });

  it('handles multi-selection, selectMode, batch duplication, alignment, and deletion', () => {
    state.setSelectMode('lasso');
    expect(state.selectMode()).toBe('lasso');
    state.setSelectMode('box');
    expect(state.selectMode()).toBe('box');

    const a = makeShape({ id: 's1', rect: { x: 10, y: 10, width: 40, height: 40 } });
    const b = makeShape({ id: 's2', rect: { x: 100, y: 80, width: 60, height: 60 } });
    const c = makeShape({ id: 's3', rect: { x: 200, y: 200, width: 30, height: 30 } });
    state.addAnnotation('page-1', a, false);
    state.addAnnotation('page-1', b, false);
    state.addAnnotation('page-1', c, false);

    state.selectAnnotations(['s1', 's2']);
    expect(state.selectedIds()).toEqual(['s1', 's2']);
    expect(state.selectedId()).toBe('s1');
    expect(state.getSelectedList('page-1')).toHaveSize(2);

    state.selectAnnotation('s3', true); // additive
    expect(state.selectedIds()).toEqual(['s1', 's2', 's3']);

    // Batch Align Left
    state.alignSelected('page-1', 'left');
    const updated = state.getSelectedList('page-1');
    expect(updated.every((item) => item.rect.x === 10)).toBeTrue();

    // Batch Opacity
    state.setBatchOpacity('page-1', 0.5);
    expect(state.getSelectedList('page-1').every((item) => item.opacity === 0.5)).toBeTrue();

    // Batch Duplication
    const newIds = state.duplicateSelected('page-1');
    expect(newIds).toHaveSize(3);
    expect(state.annotationsFor('page-1')).toHaveSize(6);

    // Batch Deletion
    state.deleteSelected('page-1');
    expect(state.annotationsFor('page-1')).toHaveSize(3);
    expect(state.selectedIds()).toHaveSize(0);
  });

  it('manages groups, ungroup, regroup, distribution, and z-ordering', () => {
    const a = makeShape({ id: 'g1', rect: { x: 0, y: 10, width: 20, height: 20 } });
    const b = makeShape({ id: 'g2', rect: { x: 50, y: 40, width: 20, height: 20 } });
    const c = makeShape({ id: 'g3', rect: { x: 120, y: 100, width: 20, height: 20 } });
    state.addAnnotation('page-1', a, false);
    state.addAnnotation('page-1', b, false);
    state.addAnnotation('page-1', c, false);

    // Grouping
    state.selectAnnotations(['g1', 'g2']);
    const groupId = state.groupSelected('page-1');
    expect(groupId).not.toBeNull();
    expect(state.hasGroupInSelection('page-1')).toBeTrue();

    // Selecting one group member selects whole group
    state.clearSelection();
    state.selectAnnotation('g1');
    expect(state.selectedIds()).toEqual(['g1', 'g2']);

    // Ungrouping
    const ungrouped = state.ungroupSelected('page-1');
    expect(ungrouped).toEqual(['g1', 'g2']);
    expect(state.hasGroupInSelection('page-1')).toBeFalse();
    expect(state.canRegroup('page-1')).toBeTrue();

    // Regrouping
    const regroupId = state.regroupSelected('page-1');
    expect(regroupId).not.toBeNull();
    expect(state.hasGroupInSelection('page-1')).toBeTrue();

    // Distribution
    state.selectAnnotations(['g1', 'g2', 'g3']);
    state.distributeSelected('page-1', 'horizontal');
    const distributed = state.getSelectedList('page-1');
    // First at 0, last at 120+20=140. Total widths = 60. Free space = 80. Gap = 40.
    // Positions: 0, 60, 120
    expect(distributed[0].rect.x).toBe(0);
    expect(distributed[1].rect.x).toBe(60);
    expect(distributed[2].rect.x).toBe(120);

    // Z-Ordering (group containing g1 & g2 moved together to front)
    state.selectAnnotation('g1');
    state.bringSelectedToFront('page-1');
    const orderAfterFront = state.annotationsFor('page-1').map((x) => x.id);
    expect(orderAfterFront).toEqual(['g3', 'g1', 'g2']);

    state.sendSelectedToBack('page-1');
    const orderAfterBack = state.annotationsFor('page-1').map((x) => x.id);
    expect(orderAfterBack).toEqual(['g1', 'g2', 'g3']);
  });

  it('supports undo and redo history', () => {
    expect(state.canUndo()).toBeFalse();
    expect(state.canRedo()).toBeFalse();

    const note1 = makeText({ id: 'undo-1', text: 'First' });
    state.addAnnotation('page-1', note1);
    expect(state.annotationsFor('page-1').length).toBe(1);
    expect(state.canUndo()).toBeTrue();
    expect(state.canRedo()).toBeFalse();

    // Add second annotation
    const note2 = makeText({ id: 'undo-2', text: 'Second' });
    state.addAnnotation('page-1', note2);
    expect(state.annotationsFor('page-1').length).toBe(2);

    // Undo second addition
    state.undo();
    expect(state.annotationsFor('page-1').length).toBe(1);
    expect(state.annotationsFor('page-1')[0].id).toBe('undo-1');
    expect(state.canUndo()).toBeTrue();
    expect(state.canRedo()).toBeTrue();

    // Redo second addition
    state.redo();
    expect(state.annotationsFor('page-1').length).toBe(2);
    expect(state.annotationsFor('page-1')[1].id).toBe('undo-2');
    expect(state.canRedo()).toBeFalse();

    // Undo back to start
    state.undo();
    state.undo();
    expect(state.annotationsFor('page-1').length).toBe(0);
    expect(state.canUndo()).toBeFalse();
    expect(state.canRedo()).toBeTrue();
  });
});
