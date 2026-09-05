import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageSeoConfig } from '../../../core/constants/seo-data';

@Component({
  selector: 'app-tool-seo-content',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './tool-seo-content.component.html',
  styleUrl: './tool-seo-content.component.scss',
})
export class ToolSeoContentComponent {
  readonly config = input.required<PageSeoConfig>();
}
