import { TestBed } from '@angular/core/testing';
import { EditorTextEditService } from './editor-text-edit.service';
import { ToastService } from '../../../core/services/toast.service';
import type { TextRun } from '../../../core/services/pdf/content-edit/text-run.model';

class ToastServiceStub {
  warning(): void {}
  error(): void {}
  success(): void {}
  info(): void {}
}

function makeMockRun(overrides: Partial<TextRun> = {}): TextRun {
  return {
    id: 'p0-r0',
    pageIndex: 0,
    text: 'Sample Document Heading',
    fontResource: 'F1',
    fontName: 'Helvetica-Bold',
    fontSize: 18,
    color: { type: 'rgb', r: 0, g: 0, b: 0 },
    transformMatrix: [18, 0, 0, 18, 50, 700],
    boundingBox: { x: 50, y: 700, width: 220, height: 22 },
    charSpacing: 0,
    wordSpacing: 0,
    ...overrides,
  };
}

describe('EditorTextEditService - Style Overrides', () => {
  let service: EditorTextEditService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        EditorTextEditService,
        { provide: ToastService, useClass: ToastServiceStub },
      ],
    });
    service = TestBed.inject(EditorTextEditService);
  });

  it('activates a run and computes activeRun correctly', () => {
    const run = makeMockRun();
    (service as any)._model.set({ pageIndex: 0, runs: [run] });

    expect(service.activeRunId()).toBeNull();
    expect(service.activeRun()).toBeNull();

    service.activateRun(run.id);

    expect(service.activeRunId()).toBe('p0-r0');
    expect(service.activeRun()?.text).toBe('Sample Document Heading');
  });

  it('updates active run font size, spacing, padding, margin, and colors', () => {
    const run = makeMockRun();
    (service as any)._model.set({ pageIndex: 0, runs: [run] });
    service.activateRun(run.id);

    service.updateActiveRunStyle({
      fontSize: 24,
      letterSpacing: 2.5,
      lineHeight: 1.5,
      paddingX: 10,
      paddingY: 6,
      marginX: 5,
      marginY: -8,
      backgroundColor: '#fef08a',
      backgroundEnabled: true,
      color: '#dc2626',
      fontWeight: 700,
      fontStyle: 'italic',
      underline: true,
      textAlign: 'center',
      textTransform: 'uppercase',
      opacity: 0.9,
    });

    const active = service.activeRun();
    expect(active).not.toBeNull();
    expect(active?.styleOverrides?.fontSize).toBe(24);
    expect(active?.styleOverrides?.letterSpacing).toBe(2.5);
    expect(active?.styleOverrides?.lineHeight).toBe(1.5);
    expect(active?.styleOverrides?.paddingX).toBe(10);
    expect(active?.styleOverrides?.paddingY).toBe(6);
    expect(active?.styleOverrides?.marginX).toBe(5);
    expect(active?.styleOverrides?.marginY).toBe(-8);
    expect(active?.styleOverrides?.backgroundColor).toBe('#fef08a');
    expect(active?.styleOverrides?.backgroundEnabled).toBeTrue();
    expect(active?.styleOverrides?.color).toBe('#dc2626');
    expect(active?.styleOverrides?.fontWeight).toBe(700);
    expect(active?.styleOverrides?.fontStyle).toBe('italic');
    expect(active?.styleOverrides?.underline).toBeTrue();
    expect(active?.styleOverrides?.textAlign).toBe('center');
    expect(active?.styleOverrides?.textTransform).toBe('uppercase');
    expect(active?.styleOverrides?.opacity).toBe(0.9);

    // Also verify it was recorded in editedRuns
    const edited = service.getEditedRunsForPage(0);
    expect(edited.length).toBe(1);
    expect(edited[0].id).toBe('p0-r0');
    expect(edited[0].styleOverrides?.fontSize).toBe(24);
  });

  it('resets style overrides back to original values', () => {
    const run = makeMockRun();
    (service as any)._model.set({ pageIndex: 0, runs: [run] });
    service.activateRun(run.id);

    service.updateActiveRunStyle({
      fontSize: 32,
      paddingX: 12,
      backgroundColor: '#bfdbfe',
      backgroundEnabled: true,
    });
    expect(service.activeRun()?.styleOverrides?.fontSize).toBe(32);

    service.resetActiveRunStyle();
    expect(service.activeRun()?.styleOverrides).toBeUndefined();
  });

  it('preserves distinct font names and metadata when switching between multiple text runs', () => {
    const run1 = makeMockRun({ id: 'p0-r0', text: 'First Text', fontName: 'TimesNewRomanPSMT' });
    const run2 = makeMockRun({ id: 'p0-r1', text: 'Second Text', fontName: 'Calibri-Bold' });
    (service as any)._model.set({ pageIndex: 0, runs: [run1, run2] });

    // Select first text
    service.activateRun(run1.id);
    expect(service.activeRun()?.id).toBe('p0-r0');
    expect(service.activeRun()?.fontName).toBe('TimesNewRomanPSMT');

    // Switch to second text
    service.activateRun(run2.id);
    expect(service.activeRun()?.id).toBe('p0-r1');
    expect(service.activeRun()?.fontName).toBe('Calibri-Bold');
  });

  it('updates background color and toggle state on active run', () => {
    const run = makeMockRun();
    (service as any)._model.set({ pageIndex: 0, runs: [run] });
    service.activateRun(run.id);

    // Apply custom background color
    service.updateActiveRunStyle({
      backgroundEnabled: true,
      backgroundColor: '#7dd3fc',
    });
    expect(service.activeRun()?.styleOverrides?.backgroundEnabled).toBeTrue();
    expect(service.activeRun()?.styleOverrides?.backgroundColor).toBe('#7dd3fc');

    // Disable background color
    service.updateActiveRunStyle({
      backgroundEnabled: false,
    });
    expect(service.activeRun()?.styleOverrides?.backgroundEnabled).toBeFalse();
  });

  it('supports decimal font sizes without loss of precision', () => {
    const run = makeMockRun({ fontSize: 10.5 });
    (service as any)._model.set({ pageIndex: 0, runs: [run] });
    service.activateRun(run.id);

    expect(service.activeRun()?.fontSize).toBe(10.5);

    service.updateActiveRunStyle({ fontSize: 11.25 });
    expect(service.activeRun()?.styleOverrides?.fontSize).toBe(11.25);
  });

  it('automatically initializes background color with detected background when activated', () => {
    const run = makeMockRun();
    (service as any)._model.set({ pageIndex: 0, runs: [run] });
    service.activateRun(run.id, '#f5f5dc');

    expect(service.activeRun()?.styleOverrides?.backgroundColor).toBe('#f5f5dc');
    expect(service.activeRun()?.styleOverrides?.backgroundEnabled).toBeTrue();

    // User can customize according to preference
    service.updateActiveRunStyle({ backgroundColor: '#bfdbfe' });
    expect(service.activeRun()?.styleOverrides?.backgroundColor).toBe('#bfdbfe');
  });

  it('constrains oversized bounding box heights to tight line heights for big fonts', () => {
    // Large 36pt font with an oversized 52pt font-box
    const run = makeMockRun({
      fontSize: 36,
      boundingBox: { x: 50, y: 100, width: 200, height: 52 },
    });

    const rect = EditorTextEditService.pdfRunToOverlayRect(run, 1.0);
    // Height should be constrained to ~1.08 * 36 = ~39px instead of 52px
    expect(rect.height).toBeLessThan(45);
    expect(rect.height).toBeGreaterThanOrEqual(36);
    // Y should be shifted down to center vertically so it doesn't overlap lines above
    expect(rect.top).toBeGreaterThan(100);
  });
});
