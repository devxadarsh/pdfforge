PDFForge — Angular PDF Editor Agent Instructions

1. Role

You are the senior frontend architect and Angular engineer responsible for implementing PDFForge, a professional, free, privacy-first PDF editor and PDF utility platform.

The UI/UX has already been designed in Google Stitch. Treat that design as the visual source of truth and implement it as a production-quality Angular application.

The application must be frontend-only. There must be no backend, API server, database server, authentication system, cloud storage, or server-side PDF processing.

2. Product Requirements

PDFForge must:

Run entirely in the browser.

Process PDF files locally on the user's device.

Require no account.

Require no login/signup.

Require no server upload.

Be free to use.

Be responsive across desktop, tablet, and mobile.

Be accessible.

Be performant with large PDFs.

Provide clear privacy messaging.

The product should communicate:

Your files never leave your device.

PDF processing happens locally in your browser.

Do not introduce functionality that silently uploads PDF data to a remote service.

3. Non-Negotiable Engineering Rules

Do not create a backend.

Do not create REST/GraphQL endpoints for PDF processing.

Do not add authentication.

Do not use a cloud PDF-processing API.

Do not upload user PDF contents for analytics.

Do not log PDF contents, passwords, or sensitive document data.

Do not use any unless there is a documented technical reason.

Do not duplicate functionality that already exists in the codebase.

Do not rewrite working architecture without a clear reason.

Do not implement fake functionality.

Do not claim a PDF feature is supported if the selected browser library cannot actually perform it.

Do not sacrifice accessibility or responsiveness for visual effects.

Do not hard-code dimensions that break smaller screens.

Do not put PDF-processing business logic directly inside presentational components.

Keep UI, document state, PDF rendering, and PDF export concerns separated.

4. Technology Stack

Use Angular and TypeScript as the primary application platform.

Preferred technologies:

Angular

TypeScript

RxJS

Angular Signals for local/reactive state where appropriate

Angular Router

SCSS

Bootstrap

Font Awesome

ngx-extended-pdf-viewer

pdf-lib

IndexedDB

Web Workers

Browser File APIs

Canvas/SVG where appropriate

Use the latest stable versions compatible with the existing Angular version.

Do not blindly upgrade Angular or major dependencies. Inspect the existing project first and make compatibility-preserving choices.

5. UI Framework and Styling

Bootstrap

Use Bootstrap for:

Grid

Responsive breakpoints

Layout utilities

Flex utilities

Spacing utilities

Forms

Buttons

Modals where appropriate

Responsive containers

Accessibility-friendly basic UI patterns

Prefer Bootstrap utility classes for common layout concerns instead of writing duplicate CSS.

Do not allow Bootstrap defaults to override the Stitch visual language blindly.

Customize the design through a centralized theme.

Font Awesome

Use Font Awesome consistently for interface icons.

Prefer:

Semantic icon choices

Consistent icon sizing

Tooltips for unfamiliar actions

Accessible labels

Icon-only buttons only when the meaning is obvious and/or a tooltip is provided

Do not mix several unrelated icon libraries unless there is a strong reason.

Additional UI Libraries

Use additional libraries only when they materially improve functionality and are compatible with the project.

Prefer mature, well-maintained Angular/browser libraries.

Good candidates include:

@ng-bootstrap/ng-bootstrap when Bootstrap-native Angular behavior is useful

ngx-toastr or an equivalent lightweight notification library if a custom notification system is not already present

idb or an equivalent IndexedDB helper when native IndexedDB abstraction becomes cumbersome

file-saver only when native browser downloads are insufficient

JSZip only when multiple generated PDF files need to be packaged client-side

Do not add a library simply because it exists. Minimize dependency count and bundle size.

Before adding a package:

Check whether the project already has an equivalent.

Check Angular compatibility.

Check whether the feature can be implemented cleanly with platform APIs.

Prefer the smallest dependency that solves the problem.

Document why the dependency was introduced.

6. PDF Technology

ngx-extended-pdf-viewer

Use ngx-extended-pdf-viewer primarily for:

Rendering PDF pages

Page thumbnails

Text-layer/search support where appropriate

PDF viewing

Page-level inspection

Keep ngx-extended-pdf-viewer rendering concerns isolated from application UI components.

pdf-lib

Use pdf-lib primarily for client-side:

PDF creation

Merging

Page copying

Page insertion/deletion

Page reordering

Page rotation

Images

Text additions

Drawing

Exporting modified documents

Metadata operations where supported

Do not assume pdf-lib supports every advanced PDF feature.

Web Workers

Use Web Workers for operations that can block the UI thread, especially:

Large PDF processing

Thumbnail generation

Batch page processing

Heavy export operations

Large document transformations

Keep worker boundaries clean and serializable.

Do not send DOM elements or Angular component instances into workers.

7. Browser-Only Architecture

Use this conceptual architecture:

Angular UI
    |
    +-- Feature Components
    |
    +-- Application State
    |
    +-- Document Services
    |
    +-- PDF Rendering Layer
    |
    +-- PDF Processing Layer
    |
    +-- Web Workers
    |
    +-- Browser Storage
    |
    +-- Browser Download

No server layer exists.

8. Recommended Project Structure

Adapt this structure to the existing repository rather than forcing a complete rewrite.

src/
  app/
    core/
      constants/
      models/
      services/
        pdf/
        storage/
        file/
        download/
        worker/
        settings/
      utilities/
      guards/
      interceptors/

    layout/
      app-shell/
      header/
      footer/
      sidebar/

    shared/
      components/
        button/
        icon-button/
        file-dropzone/
        dialog/
        toast/
        loading/
        empty-state/
        error-state/
        confirmation/
      directives/
      pipes/
      utilities/

    features/
      home/
      tools/
      editor/
        components/
          editor-shell/
          editor-toolbar/
          page-sidebar/
          page-thumbnail/
          pdf-canvas/
          properties-panel/
          zoom-controls/
          search-panel/
        services/
        state/
        models/

      merge/
      split/
      compress/
      convert/
      security/
      recent/
      settings/
      help/

    workers/
      pdf/
      thumbnails/
      compression/

    app.routes.ts

Use standalone Angular components if the project uses modern standalone architecture.

9. Architecture Principles

Follow these principles:

Feature-based architecture.

Single Responsibility Principle.

Dependency inversion where it improves testability.

Prefer composition over inheritance.

Keep components focused on presentation and orchestration.

Keep domain logic in services/state.

Keep PDF processing independent of UI.

Keep storage implementation independent of UI.

Avoid god services.

Avoid god components.

Avoid circular dependencies.

Avoid static mutable state.

Prefer immutable state updates where practical.

Prefer typed interfaces/models.

Centralize shared constants.

10. State Management

Do not introduce NgRx automatically.

Use:

Angular Signals

Signal Stores or equivalent lightweight patterns when useful

RxJS for asynchronous streams

Feature-level services

Separate state into logical areas:

Document State
Editor State
Viewport State
Selection State
History State
UI State
Settings State
Recent Documents State
Processing State

Do not create one giant global store.

11. Core Domain Models

Create strongly typed models for concepts such as:

PdfDocument
PdfPage
PdfAnnotation
TextAnnotation
HighlightAnnotation
ShapeAnnotation
DrawingAnnotation
ImageAnnotation
SignatureAnnotation
StampAnnotation
PageSelection
EditorTool
EditorState
ViewportState
ProcessingJob
ProcessingResult
RecentDocument
PdfMetadata

Use discriminated unions for annotation types where appropriate.

Example conceptual approach:

type PdfAnnotation =
  | TextAnnotation
  | HighlightAnnotation
  | ShapeAnnotation
  | DrawingAnnotation
  | ImageAnnotation
  | SignatureAnnotation;

Avoid stringly typed objects and excessive Record<string, unknown> structures.

12. Design System

The Stitch design is the source of truth.

Preserve:

Typography

Spacing

Color

Border radius

Shadows

Grid

Toolbars

Sidebar dimensions

Properties panel

Empty states

Dialogs

Mobile layouts

Hover states

Focus states

Disabled states

Loading states

Create centralized SCSS theme variables/tokens.

Do not scatter arbitrary color values throughout components.

Use CSS custom properties or SCSS variables for:

Brand color

Surface colors

Text colors

Border colors

Focus colors

Success

Warning

Error

Spacing

Radii

Shadows

Editor canvas colors

13. Responsive Design

Responsive behavior is mandatory.

Target:

320px

360px

375px

390px

414px

768px

820px

1024px

1280px

1440px

Large desktop screens

Use Bootstrap breakpoints consistently.

Desktop

Editor layout:

Header
Toolbar
------------------------------------------------
| Pages |      PDF Workspace      | Properties |
|       |                          |            |
------------------------------------------------
Footer controls

Tablet

Collapsible properties panel.

Collapsible page sidebar.

Reduced toolbar density.

Larger touch targets.

Mobile

Use a purpose-built mobile layout:

Full-width PDF canvas.

Bottom toolbar.

Bottom sheets for properties.

Collapsible page list.

Touch-friendly controls.

Avoid horizontal overflow.

Avoid tiny icon buttons.

Preserve document visibility.

Do not simply shrink the desktop interface.

14. Accessibility

Follow modern accessibility practices.

Required:

Semantic HTML.

Keyboard navigation.

Visible focus state.

ARIA labels where appropriate.

Tooltip for unfamiliar icon-only controls.

Accessible dialog focus management.

Sufficient color contrast.

Reduced motion support.

Keyboard shortcuts that do not break browser accessibility.

Minimum touch target sizes.

Do not communicate state with color alone.

Test keyboard-only navigation.

15. Application Shell

Implement:

Header

Navigation

Search

Theme switch

Open PDF

Privacy indicator

Footer

The site must not expose:

Login

Sign up

Pricing that implies paid plans

Account management

The product is free and accountless.

16. Main Routes

Create a route structure similar to:

/
  Home

/tools
  All Tools

/editor
  PDF Editor

/merge
  Merge PDF

/split
  Split PDF

/compress
  Compress PDF

/convert
  Convert PDF

/security/protect
  Protect PDF

/security/unlock
  Unlock PDF

/signature
  Signature

/recent
  Recent Documents

/settings
  Settings

/help
  Help

Use lazy loading for major feature areas.

17. File Handling

Implement local file handling through browser APIs.

Requirements:

Drag and drop.

File picker.

File validation.

PDF MIME/type validation.

Empty file handling.

Large file handling.

Unsupported file handling.

Safe filenames.

Download handling.

Never upload user files.

Do not log file content.

18. PDF Editor

Build the editor in incremental milestones.

Core layout:

Editor Shell
  ├── App Header
  ├── Toolbar
  ├── Page Sidebar
  ├── PDF Workspace
  ├── Properties Panel
  └── Bottom Controls

The editor should support:

Page navigation.

Zoom.

Pan.

Fit page.

Fit width.

Selection.

Annotations.

Page manipulation.

Search.

Undo/redo.

Export.

19. Editor Toolbar

Implement tools in this order:

Select

Hand

Text

Highlight

Underline

Strikethrough

Pen

Eraser

Rectangle

Circle

Arrow

Image

Signature

Stamp

Comment

Each tool must have:

Active state.

Disabled state.

Hover state.

Focus state.

Tooltip.

Keyboard shortcut where sensible.

20. Page Management

Implement:

Page thumbnails.

Current page.

Select one/multiple pages.

Select all.

Reorder by drag and drop.

Delete.

Duplicate.

Rotate.

Extract.

For large documents, do not eagerly render every thumbnail at maximum resolution.

21. PDF Search

Implement:

Search field.

Match count.

Highlight results.

Next/previous.

Page navigation.

Keyboard shortcut:

Ctrl/Cmd + F

Prefer ngx-extended-pdf-viewer text extraction/text layer capabilities where appropriate.

22. Text and Annotation Model

Treat editor objects as a separate overlay/model layer from the PDF rendering layer.

For example:

ngx-extended-pdf-viewer Rendered Page
       +
Annotation Overlay
       +
Interaction Layer
       =
Editor Page

This separation will make selection, movement, resizing, and undo/redo easier to manage.

Do not directly modify ngx-extended-pdf-viewer internal rendering DOM as the primary state model.

23. Text Tool

Support:

Add text.

Move.

Resize where appropriate.

Delete.

Font family.

Font size.

Weight.

Italic.

Underline.

Alignment.

Color.

Opacity.

Do not claim to edit arbitrary original PDF text if the underlying PDF technology cannot safely do so.

Distinguish between:

Adding editable overlay text.

Modifying embedded PDF content.

24. Annotation Tools

Implement:

Highlight.

Underline.

Strikethrough.

Sticky note/comment.

Text box.

Selected annotations must expose their properties through the Stitch-designed properties panel.

25. Drawing and Shapes

Support:

Freehand.

Pen.

Line.

Arrow.

Rectangle.

Circle.

Eraser.

Properties:

Stroke color.

Fill color.

Stroke width.

Opacity.

Position.

Size.

Rotation.

Use Pointer Events so mouse, pen, and touch can share the same interaction model.

26. Image Tool

Support:

Upload image.

Place image.

Move.

Resize.

Rotate.

Delete.

Opacity.

Crop if practical.

Support at least:

PNG

JPEG

WebP

Convert images into PDF-compatible content during export.

27. Signature

Support:

Draw signature.

Type signature.

Upload signature.

Support:

Resize.

Move.

Rotate.

Delete.

Use pointer events for drawing.

Do not send signatures anywhere.

28. Undo / Redo

Use an explicit editor history/command model.

Actions should be undoable where practical:

Add annotation.

Delete annotation.

Move.

Resize.

Change properties.

Page delete.

Page duplicate.

Page rotation.

Page reorder.

Image insertion.

Signature insertion.

Keyboard:

Ctrl/Cmd + Z
Ctrl/Cmd + Shift + Z

Do not use browser navigation as editor undo/redo.

29. PDF Export

The export pipeline should:

Read current document state.

Apply page operations.

Apply annotations and overlays.

Apply inserted images.

Apply signatures.

Apply supported text/shapes.

Generate final PDF.

Create a browser Blob.

Trigger download.

Never send the PDF to a server.

Use descriptive filenames:

document-edited.pdf
document-merged.pdf
document-compressed.pdf

30. Merge

Implement:

Multiple PDF selection.

Preview.

Page counts.

Reordering.

Remove files.

Merge.

Download.

Open merged result in editor.

Use pdf-lib or another reliable browser-side PDF library.

31. Split

Support:

Split every page.

Custom page ranges.

Extract selected pages.

Multiple output documents.

If multiple output documents need packaging, use ZIP generation client-side only when needed.

32. Compression

Implement honest client-side compression.

Show:

Original size.

Compression option.

Output size.

Reduction percentage.

If compression is limited for a particular PDF structure, report the limitation rather than fabricating a result.

Do not promise a specific percentage reduction before processing.

33. Conversions

Prioritize reliable browser-side features:

PDF → PNG

PDF → JPG

Images → PDF

PDF → Text

Only implement additional conversions when there is a reliable client-side implementation.

Do not add fake converters.

34. Security Features

Implement only features genuinely supported by the selected browser libraries.

Potential features:

Password protection.

Encryption.

Permission restrictions.

Password removal where supported.

For unsupported encrypted PDF operations, show a clear limitation message.

35. Recent Documents

Use IndexedDB for browser-local document persistence when storing document bytes is appropriate.

Store only what is required.

Allow:

Open.

Remove one.

Clear all history.

Clear all application data.

Clearly state:

Stored locally in this browser.

Do not store document data in LocalStorage when the data size makes IndexedDB more appropriate.

36. Settings

Support:

Appearance

Light.

Dark.

System.

Editor

Default zoom.

Auto-save preference.

Thumbnail settings.

Privacy

Clear local documents.

Clear recent history.

Clear application data.

Accessibility

Reduce motion.

High contrast.

Persist settings locally.

37. Notifications

Use a consistent toast/notification system.

Examples:

PDF opened.

Page deleted.

Changes undone.

PDF exported.

Merge completed.

Compression completed.

Error occurred.

Do not use browser alert() for routine application notifications.

38. Dialogs

Create reusable dialogs for:

Delete page.

Delete annotation.

Clear history.

Clear local data.

Password entry.

Signature.

Export options.

Unsupported operation.

Confirm destructive action.

Dialogs must be keyboard accessible.

39. Loading and Progress

Provide meaningful loading states:

Loading PDF.

Rendering pages.

Processing pages.

Generating document.

Compressing.

Exporting.

For long operations:

Show progress when determinable.

Otherwise show an indeterminate progress state.

Keep the UI responsive.

Prefer workers for heavy processing.

40. Error Handling

Create domain-specific errors.

Examples:

InvalidPdfError
UnsupportedPdfOperationError
PdfLoadError
PdfRenderError
PdfExportError
StorageError
FileValidationError

Map these errors to user-friendly UI.

Never expose stack traces.

41. Performance

Prioritize performance from the beginning.

Requirements:

Lazy-load major routes.

Avoid unnecessary change detection.

Use OnPush-compatible patterns.

Prefer Signals where appropriate.

Virtualize page lists for large documents.

Render thumbnails efficiently.

Avoid duplicate ArrayBuffers.

Revoke unused Blob URLs.

Clean up event listeners.

Destroy workers when no longer needed.

Avoid memory leaks.

Avoid rendering invisible pages unnecessarily.

For large documents, use progressive/lazy processing where possible.

42. Memory Management

PDFs can consume significant browser memory.

Follow these practices:

Reuse buffers where practical.

Avoid cloning large PDFs unnecessarily.

Release temporary object URLs.

Release canvas resources where appropriate.

Avoid keeping multiple full-resolution renderings alive.

Process large batches incrementally.

Use workers for heavy transformations.

Keep history snapshots lightweight.

43. Security and Privacy

Review every dependency and feature for unintended network behavior.

Verify:

PDF contents never leave browser.

No document content is sent to analytics.

No passwords are logged.

No signatures are logged.

No sensitive document metadata is accidentally transmitted.

Keep processing local.

44. Testing Strategy

Use the project's supported Angular testing stack.

At minimum test:

Unit

File validation.

Document state.

Selection.

Page ordering.

Annotation state.

Undo/redo.

Export helpers.

Storage helpers.

Component

Toolbar.

File uploader.

Page sidebar.

Properties panel.

Dialogs.

Settings.

Integration

Test workflows such as:

Open PDF
→ Add annotation
→ Undo
→ Redo
→ Export
→ Download

and:

Select two PDFs
→ Reorder
→ Merge
→ Download

45. Quality Gates

After each implementation milestone:

Run the Angular build.

Run tests.

Fix TypeScript errors.

Fix template errors.

Inspect browser console.

Verify responsive behavior.

Verify no accidental network requests.

Verify the Stitch design remains consistent.

Verify accessibility basics.

Only then continue.

Never knowingly move forward with a broken build.

46. Implementation Milestones

Implement in this exact order.

Milestone 1 — Repository Audit

Inspect repository.

Inspect Angular version.

Inspect package.json.

Inspect Stitch-generated UI.

Identify existing components.

Identify existing styles.

Identify existing routes.

Identify existing PDF libraries.

Identify missing libraries.

Propose minimal architecture changes.

Do not blindly rewrite the project.

Milestone 2 — Foundation

Implement:

Theme.

Bootstrap integration.

Font Awesome.

App shell.

Header.

Footer.

Navigation.

Shared components.

Toasts.

Dialog infrastructure.

Loading infrastructure.

Error infrastructure.

Milestone 3 — Public UI

Implement:

Home.

All Tools.

Tool cards.

Responsive navigation.

Privacy messaging.

Milestone 4 — File Handling

Implement:

File picker.

Drag/drop.

Validation.

Local file lifecycle.

Milestone 5 — PDF Viewer

Implement:

ngx-extended-pdf-viewer.

Rendering.

Zoom.

Page navigation.

Thumbnails.

Search foundation.

Milestone 6 — Page Management

Implement:

Selection.

Reorder.

Delete.

Duplicate.

Rotate.

Extract.

Milestone 7 — Editor Foundation

Implement:

Toolbar.

Workspace.

Overlay layer.

Selection model.

Properties panel.

Editor state.

Milestone 8 — Annotation Tools

Implement:

Text.

Highlight.

Underline.

Strikethrough.

Comment.

Milestone 9 — Drawing

Implement:

Pen.

Freehand.

Eraser.

Rectangle.

Circle.

Arrow.

Line.

Milestone 10 — Media

Implement:

Image.

Signature.

Stamp.

Milestone 11 — History

Implement:

Undo.

Redo.

Command/history model.

Milestone 12 — Export

Implement:

PDF generation.

Blob creation.

Download.

Error handling.

Milestone 13 — PDF Utilities

Implement:

Merge.

Split.

Extract.

Milestone 14 — Optimization

Implement:

Compression.

PDF → PNG/JPG.

Image → PDF.

PDF → Text.

Milestone 15 — Security

Implement only genuinely supported:

Protect.

Encrypt.

Permission controls.

Unlock where supported.

Milestone 16 — Storage

Implement:

IndexedDB.

Recent documents.

Local settings.

Clear local data.

Milestone 17 — Responsive UX

Implement:

Tablet.

Mobile editor.

Bottom toolbar.

Bottom sheets.

Touch interactions.

Milestone 18 — Accessibility

Implement:

Keyboard navigation.

ARIA.

Focus management.

Reduced motion.

Contrast improvements.

Milestone 19 — Performance

Implement:

Lazy loading.

Virtualization.

Web Workers.

Memory cleanup.

Rendering optimizations.

Milestone 20 — Testing and QA

Implement:

Unit tests.

Component tests.

Integration tests.

Responsive verification.

Build verification.

Production build.

47. Agent Operating Procedure

For every milestone:

Step A — Inspect

Inspect the relevant code before editing.

Step B — Plan

Identify:

Files to add.

Files to modify.

Dependencies required.

Risks.

Tests required.

Step C — Implement

Make the smallest coherent implementation.

Step D — Validate

Run:

Build.

Tests.

Lint if configured.

Step E — Review

Check:

Design fidelity.

Responsiveness.

Accessibility.

Performance.

Security/privacy.

Type safety.

Step F — Continue

Only proceed when the current milestone is stable.

48. Avoid Giant Refactors

Do not make a huge refactor and feature implementation in one change.

Prefer incremental changes.

Bad:

Rewrite the entire application + add PDF editor + add merge/split/export.

Good:

Foundation
→ Verify

PDF viewer
→ Verify

Page management
→ Verify

Editor
→ Verify

Export
→ Verify

49. Code Quality

Follow modern Angular and TypeScript practices:

Strict typing.

Small components.

Clear services.

Dependency injection.

readonly where useful.

Typed event payloads.

No unnecessary inheritance.

Avoid magic strings.

Avoid magic numbers.

Centralize constants.

Use clean naming.

Keep methods focused.

Keep templates simple.

Avoid overly complex template expressions.

50. Logging

Production logging must be minimal.

Do not log:

PDF contents.

PDF passwords.

Signature data.

Extracted sensitive text.

Large ArrayBuffers.

User document metadata unnecessarily.

Use a controlled development logger if required.

51. Network Policy

The application must not make document-processing network requests.

Acceptable network behavior may include:

Loading static application assets.

Loading web fonts if intentionally configured.

Loading icons/assets from bundled dependencies.

Standard application resources.

Do not send:

PDF binaries.

Extracted PDF text.

PDF passwords.

Signatures.

Document images.

52. Dependency Policy

Before installing any library:

Check package compatibility.

Check bundle size.

Check maintenance status.

Check licensing.

Check whether browser-only operation is supported.

Prefer standard browser APIs when equivalent.

Avoid redundant UI/icon libraries.

Preferred stack:

Angular
Bootstrap
Font Awesome
ngx-extended-pdf-viewer
pdf-lib
RxJS
IndexedDB
Web Workers

Add other libraries only when justified.

53. Bootstrap Guidelines

Use Bootstrap to provide responsive primitives, but do not let raw Bootstrap components dictate the final visual design.

Prefer:

<div class="container-fluid">
<div class="row">
<div class="col-lg-...">

and utility classes for:

spacing

flex

sizing

display

positioning

responsive behavior

Create custom classes/tokens for the PDFForge visual identity.

Avoid deeply nesting utility classes when a reusable component is clearer.

54. Font Awesome Guidelines

Create a consistent icon strategy.

Examples:

Open PDF → file-pdf

Merge → object-group

Split → scissors

Delete → trash

Rotate → rotate

Search → magnifying-glass

Settings → gear

Download → download

Print → print

Add text → font

Highlight → highlighter

Draw → pen

Signature → signature

Use accessible aria-label values for icon-only controls.

55. Stitch Design Verification

When implementing each screen:

Compare the Angular result against the Stitch design.

Verify:

Header height.

Sidebar width.

Toolbar spacing.

Font sizing.

Card proportions.

Button dimensions.

Page canvas positioning.

Properties panel.

Mobile behavior.

If the implementation differs unnecessarily from Stitch, correct it.

56. Product UX Rules

The user should be able to do:

Open PDF
→ Edit
→ Export

with minimum friction.

Never force:

Registration.

Login.

Email verification.

Upload confirmation.

Marketing interstitials.

Use clear calls to action.

57. Empty / Loading / Error / Success States

Every major feature must have:

Empty state.

Loading state.

Processing state.

Success state.

Error state.

Do not leave blank screens when something is loading.

58. Browser Compatibility

Design for modern browsers.

At minimum consider:

Chromium-based browsers.

Firefox.

Safari where supported by the selected PDF stack.

Do not depend on a browser feature without detecting/supporting its limitations where necessary.

59. Feature Completeness Rule

A feature is not considered complete just because the UI exists.

For each feature verify:

UI
+
State
+
Interaction
+
Validation
+
Processing
+
Error handling
+
Accessibility
+
Responsive behavior
+
Export/result
+
Testing

60. Final Product Definition

The final application should feel like:

A professional PDF editor.

A real browser application.

A cohesive product.

Fast.

Private.

Free.

Responsive.

Maintainable.

Production ready.

It must NOT feel like:

A static Stitch prototype.

A template dashboard.

A collection of disconnected demo screens.

A fake PDF editor.

A backend-dependent SaaS product.

61. Start Here

Immediately begin with Milestone 1 — Repository Audit.

Inspect the project before changing anything.

Then implement the milestones sequentially.

After every milestone, provide a concise report:

Milestone:
Implemented:
Files changed:
Dependencies added:
Validation:
Known limitations:
Next milestone:

Do not skip validation.

Do not claim completion without verification.

Do not create a backend.

Do not upload user documents.

Preserve the Stitch UI.

Build PDFForge as a professional, responsive, privacy-first Angular application.