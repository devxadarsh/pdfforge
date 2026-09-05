import { Component, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { TOOL_CATEGORIES, ToolCard, ToolCategory } from '../../core/constants/tools';

export interface CategoryFilterItem {
  id: string;
  title: string;
  icon: string;
  count: number;
}

@Component({
  selector: 'app-tools',
  standalone: true,
  imports: [RouterLink, FormsModule, NgClass],
  templateUrl: './tools.component.html',
  styleUrl: './tools.component.scss'
})
export class ToolsComponent {
  readonly categories = TOOL_CATEGORIES;
  readonly query = signal('');
  readonly selectedCategory = signal<string>('all');

  readonly allTools = computed<ToolCard[]>(() => {
    return this.categories.flatMap((c) => c.items);
  });

  readonly filterTabs = computed<CategoryFilterItem[]>(() => {
    const q = this.query().trim().toLowerCase();
    const allMatching = this.allTools().filter(
      (t) =>
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    );

    const tabs: CategoryFilterItem[] = [
      {
        id: 'all',
        title: 'All Tools',
        icon: 'fa-solid fa-shapes',
        count: allMatching.length,
      },
    ];

    for (const cat of this.categories) {
      const catCount = cat.items.filter(
        (t) =>
          !q ||
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      ).length;

      tabs.push({
        id: cat.id,
        title: cat.title,
        icon: cat.icon,
        count: catCount,
      });
    }

    return tabs;
  });

  readonly filteredCategories = computed<ToolCategory[]>(() => {
    const q = this.query().trim().toLowerCase();
    const activeCat = this.selectedCategory();

    return this.categories
      .filter((cat) => activeCat === 'all' || cat.id === activeCat)
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            !q ||
            item.title.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  });

  readonly totalVisibleCount = computed<number>(() => {
    return this.filteredCategories().reduce((acc, cat) => acc + cat.items.length, 0);
  });

  setQuery(value: string): void {
    this.query.set(value);
  }

  clearSearch(): void {
    this.query.set('');
    this.selectedCategory.set('all');
  }

  selectCategory(id: string): void {
    this.selectedCategory.set(id);
  }
}

