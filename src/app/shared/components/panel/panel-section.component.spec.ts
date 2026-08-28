import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PanelSectionComponent } from './panel-section.component';

@Component({
  standalone: true,
  imports: [PanelSectionComponent],
  template: `
    <app-panel-section title="Standard Section" [collapsible]="true">
      <button psec-actions type="button" class="test-action">Action</button>
      <div class="test-body">Standard Projected Content</div>
    </app-panel-section>

    <app-panel-section title="Bare Section" [bare]="true">
      <div class="test-bare-body">Bare Projected Content</div>
    </app-panel-section>
  `,
})
class TestHostComponent {}

describe('PanelSectionComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('should project body and actions into standard section', () => {
    const el: HTMLElement = fixture.nativeElement;
    const action = el.querySelector('.test-action');
    const body = el.querySelector('.test-body');

    expect(action).toBeTruthy();
    expect(action?.textContent).toContain('Action');
    expect(body).toBeTruthy();
    expect(body?.textContent).toContain('Standard Projected Content');
  });

  it('should project body into bare nested section', () => {
    const el: HTMLElement = fixture.nativeElement;
    const bareBody = el.querySelector('.test-bare-body');

    expect(bareBody).toBeTruthy();
    expect(bareBody?.textContent).toContain('Bare Projected Content');
  });
});
