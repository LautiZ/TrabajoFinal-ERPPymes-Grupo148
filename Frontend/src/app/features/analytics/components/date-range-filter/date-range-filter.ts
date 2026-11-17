import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AnalyticsService } from '../../services/analytics.service';
import { DateRangePreset } from '../../models/analytics.model';

@Component({
  selector: 'app-date-range-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './date-range-filter.html',
  styleUrl: './date-range-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DateRangeFilterComponent implements OnInit {
  private readonly analyticsService = inject(AnalyticsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly customFrom = signal<string>(this.analyticsService.from());
  protected readonly customTo = signal<string>(this.analyticsService.to());
  protected readonly activePreset = computed(() => this.analyticsService.filter().preset ?? 'custom');

  /** Valida que 'desde' sea menor o igual a 'hasta' */
  protected readonly isInvalidRange = computed(() => {
    const from = this.customFrom();
    const to = this.customTo();
    if (!from || !to) {
      return true;
    }
    return from > to;
  });

  ngOnInit(): void {
    const queryMap = this.route.snapshot.queryParamMap;
    const urlFrom = queryMap.get('from');
    const urlTo = queryMap.get('to');
    const urlPreset = (queryMap.get('preset') as DateRangePreset | null) ?? undefined;

    if (urlFrom && urlTo && urlFrom <= urlTo) {
      this.customFrom.set(urlFrom);
      this.customTo.set(urlTo);
      this.analyticsService.updateDateRange(urlFrom, urlTo, urlPreset ?? 'custom');
    } else {
      // Sincroniza el estado inicial en los queryParams sin agregar entrada al historial
      this.syncQueryParams(
        this.analyticsService.from(),
        this.analyticsService.to(),
        this.activePreset(),
        true,
      );
    }
  }

  selectPreset(preset: DateRangePreset): void {
    const { from, to } = this.calculatePresetDates(preset);
    this.customFrom.set(from);
    this.customTo.set(to);
    this.analyticsService.updateDateRange(from, to, preset);
    this.syncQueryParams(from, to, preset);
  }

  onCustomDateChange(from: string, to: string): void {
    this.customFrom.set(from);
    this.customTo.set(to);

    if (from && to && from <= to) {
      this.analyticsService.updateDateRange(from, to, 'custom');
      this.syncQueryParams(from, to, 'custom');
    }
  }

  calculatePresetDates(preset: DateRangePreset, baseDate = new Date()): { from: string; to: string } {
    const today = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());

    switch (preset) {
      case 'today': {
        const ymd = this.formatYmd(today);
        return { from: ymd, to: ymd };
      }
      case 'last7days': {
        const start = new Date(today);
        start.setDate(today.getDate() - 6);
        return { from: this.formatYmd(start), to: this.formatYmd(today) };
      }
      case 'currentMonth': {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        return { from: this.formatYmd(firstDay), to: this.formatYmd(today) };
      }
      case 'previousMonth': {
        const firstDayPrev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayPrev = new Date(today.getFullYear(), today.getMonth(), 0);
        return { from: this.formatYmd(firstDayPrev), to: this.formatYmd(lastDayPrev) };
      }
      default:
        return { from: this.customFrom(), to: this.customTo() };
    }
  }

  private syncQueryParams(
    from: string,
    to: string,
    preset: DateRangePreset,
    replaceUrl = false,
  ): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { from, to, preset },
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }

  private formatYmd(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}