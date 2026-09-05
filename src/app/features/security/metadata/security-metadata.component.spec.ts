import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SecurityMetadataComponent } from './security-metadata.component';
import { PdfMetadataService, PdfMetadata } from '../../../core/services/pdf/pdf-metadata.service';
import { DownloadService } from '../../../core/services/download/download.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadedFile } from '../../../core/models/file.models';

describe('SecurityMetadataComponent', () => {
  let component: SecurityMetadataComponent;
  let fixture: ComponentFixture<SecurityMetadataComponent>;
  let mockMetaService: jasmine.SpyObj<PdfMetadataService>;
  let mockDownloadService: jasmine.SpyObj<DownloadService>;
  let mockToastService: jasmine.SpyObj<ToastService>;

  const sampleMeta: PdfMetadata = {
    title: 'Initial Title',
    author: 'Initial Author',
    subject: 'Initial Subject',
    keywords: 'test, pdf',
    creator: 'Initial Creator',
    producer: 'Initial Producer',
    creationDate: new Date(2025, 0, 1),
    modificationDate: new Date(2025, 0, 2),
    pageCount: 3,
    fileSizeBytes: 2048,
    pdfVersion: 'PDF 1.7',
  };

  beforeEach(async () => {
    mockMetaService = jasmine.createSpyObj('PdfMetadataService', [
      'readMetadata',
      'updateMetadata',
      'stripMetadata',
    ]);
    mockDownloadService = jasmine.createSpyObj('DownloadService', ['download']);
    mockToastService = jasmine.createSpyObj('ToastService', ['info', 'success', 'warning', 'error']);

    mockMetaService.readMetadata.and.returnValue(Promise.resolve(sampleMeta));

    await TestBed.configureTestingModule({
      imports: [SecurityMetadataComponent],
      providers: [
        provideRouter([]),
        { provide: PdfMetadataService, useValue: mockMetaService },
        { provide: DownloadService, useValue: mockDownloadService },
        { provide: ToastService, useValue: mockToastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SecurityMetadataComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function createMockLoadedFile(name = 'doc.pdf'): LoadedFile {
    const data = new ArrayBuffer(50);
    const file = new File([data], name, { type: 'application/pdf' });
    return {
      file,
      name,
      sizeBytes: data.byteLength,
      data,
      loadedAt: Date.now(),
    };
  }

  it('should create component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize history stack when file is loaded', async () => {
    const file = createMockLoadedFile('doc.pdf');
    await component.onFileLoaded([file]);

    expect(component.loadedFile()).toBe(file);
    expect(component.title()).toBe('Initial Title');
    expect(component.author()).toBe('Initial Author');
    expect(component.history().length).toBe(1);
    expect(component.historyIndex()).toBe(0);
    expect(component.canUndo()).toBeFalse();
    expect(component.canRedo()).toBeFalse();
    expect(component.isModifiedFromInitial()).toBeFalse();
  });

  it('should support undo and redo on field edits', async () => {
    const file = createMockLoadedFile('doc.pdf');
    await component.onFileLoaded([file]);

    // Edit title
    component.onFieldInput('title', 'Updated Title');
    component.onFieldBlur();

    expect(component.title()).toBe('Updated Title');
    expect(component.canUndo()).toBeTrue();
    expect(component.canRedo()).toBeFalse();
    expect(component.isModifiedFromInitial()).toBeTrue();

    // Perform Undo
    component.undo();
    expect(component.title()).toBe('Initial Title');
    expect(component.canUndo()).toBeFalse();
    expect(component.canRedo()).toBeTrue();
    expect(component.isModifiedFromInitial()).toBeFalse();

    // Perform Redo
    component.redo();
    expect(component.title()).toBe('Updated Title');
    expect(component.canUndo()).toBeTrue();
    expect(component.canRedo()).toBeFalse();
    expect(component.isModifiedFromInitial()).toBeTrue();
  });

  it('stripMetadata should clear all fields without triggering download', async () => {
    const file = createMockLoadedFile('doc.pdf');
    await component.onFileLoaded([file]);

    // Click Strip Metadata
    component.stripMetadata();

    // Fields should be cleared
    expect(component.title()).toBe('');
    expect(component.author()).toBe('');
    expect(component.subject()).toBe('');
    expect(component.keywords()).toBe('');
    expect(component.creator()).toBe('');
    expect(component.producer()).toBe('');
    expect(component.creationDate()).toBe('');
    expect(component.modificationDate()).toBe('');

    // Crucial: NO download should have occurred!
    expect(mockDownloadService.download).not.toHaveBeenCalled();

    // Undo should be available to recover previous state
    expect(component.canUndo()).toBeTrue();
    component.undo();
    expect(component.title()).toBe('Initial Title');
    expect(component.author()).toBe('Initial Author');
    expect(component.creationDate()).toBeTruthy();
  });

  it('revertToInitial should restore original metadata', async () => {
    const file = createMockLoadedFile('doc.pdf');
    await component.onFileLoaded([file]);

    // Make edits
    component.onFieldInput('title', 'Changed Title');
    component.onFieldInput('author', 'Changed Author');
    component.onFieldInput('creationDate', '2020-01-01T12:00');
    component.onFieldBlur();

    expect(component.isModifiedFromInitial()).toBeTrue();

    // Revert to initial
    component.revertToInitial();
    expect(component.title()).toBe('Initial Title');
    expect(component.author()).toBe('Initial Author');
    expect(component.creationDate()).toBe(component.toDateTimeLocalString(sampleMeta.creationDate));
    expect(component.isModifiedFromInitial()).toBeFalse();
  });

  it('saveMetadata should download the updated PDF file with preserved creationDate', async () => {
    const file = createMockLoadedFile('test.pdf');
    const dummyOutput = new Uint8Array([1, 2, 3, 4]);
    mockMetaService.updateMetadata.and.returnValue(Promise.resolve(dummyOutput));

    await component.onFileLoaded([file]);
    component.onFieldInput('title', 'Final Title');
    component.onFieldBlur();

    await component.saveMetadata();

    expect(mockMetaService.updateMetadata).toHaveBeenCalledWith(
      jasmine.any(Uint8Array),
      jasmine.objectContaining({
        title: 'Final Title',
        creationDate: jasmine.any(Date),
      }),
    );
    expect(mockDownloadService.download).toHaveBeenCalledWith(
      jasmine.any(Blob),
      'test-updated-metadata.pdf',
    );
  });

  it('saveMetadata should call stripMetadata if all fields are empty', async () => {
    const file = createMockLoadedFile('test.pdf');
    const dummyOutput = new Uint8Array([5, 6, 7]);
    mockMetaService.stripMetadata.and.returnValue(Promise.resolve(dummyOutput));

    await component.onFileLoaded([file]);
    component.stripMetadata();

    await component.saveMetadata();

    expect(mockMetaService.stripMetadata).toHaveBeenCalled();
    expect(mockDownloadService.download).toHaveBeenCalledWith(
      jasmine.any(Blob),
      'test-sanitized.pdf',
    );
  });
});
