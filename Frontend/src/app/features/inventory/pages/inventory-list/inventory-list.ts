import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../../shared/components/page-header/page-header';

@Component({
  imports: [PageHeader, EmptyState],
  selector: 'app-inventory-list',
  styleUrl: './inventory-list.scss',
  templateUrl: './inventory-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryList {}
