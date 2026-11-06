import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analytics-dashboard.html',
  styleUrl: './analytics-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsDashboard {}