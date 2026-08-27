import { Component, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { TOOL_CATEGORIES, ToolCard } from '../../core/constants/tools';

@Component({
    selector: 'app-tools',
    imports: [RouterLink, FormsModule, NgClass],
    templateUrl: './tools.component.html',
    styleUrl: './tools.component.scss'
})
export class ToolsComponent {
  readonly categories = TOOL_CATEGORIES;
  readonly query = signal('');

  readonly filtered = computed<ToolCard[]>(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.categories.flatMap((c) => c.items);
    if (!q) {
      return all;
    }
    return all.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
    );
  });

  setQuery(value: string): void {
    this.query.set(value);
  }
}
