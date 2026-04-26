import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-incident-pagination',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './incident-pagination.html',
  styleUrl: './incident-pagination.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IncidentPagination {

  @Input({ required: true }) currentPage!: number;
  @Input({ required: true }) totalPages!: number;
  @Input({ required: true }) totalElements!: number;
  @Input() pageSize = 20;
  @Input() loading = false;

  @Output() pageChange = new EventEmitter<number>();
  
  get displayPage(): number {
    return this.currentPage + 1;
  }

  get isFirstPage(): boolean {
    return this.currentPage === 0;
  }

  get isLastPage(): boolean {
    return this.currentPage >= this.totalPages - 1;
  }

  get hasMultiplePages(): boolean {
    return this.totalPages > 1;
  }

  get visiblePages(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    const half = Math.floor(maxVisible / 2);

    let start = Math.max(0, this.currentPage - half);
    const end = Math.min(this.totalPages - 1, start + maxVisible - 1);

    start = Math.max(0, end - maxVisible + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  }

  onPrevious(): void {
    if (!this.isFirstPage && !this.loading) {
      this.pageChange.emit(this.currentPage - 1);
    }
  }

  onNext(): void {
    if (!this.isLastPage && !this.loading) {
      this.pageChange.emit(this.currentPage + 1);
    }
  }

  onPageSelect(page: number): void {
    if (page !== this.currentPage && !this.loading) {
      this.pageChange.emit(page);
    }
  }
}