import { TestBed } from '@angular/core/testing';
import { createMemoryStorage } from '../testing/factories';
import { PurchaseSnapshot } from '../models/purchase-snapshot.model';
import {
  PURCHASE_SNAPSHOT_KEY,
  PURCHASE_SNAPSHOT_TTL_MS,
  PURCHASE_STORAGE,
  PurchaseSnapshotService,
} from './purchase-snapshot.service';

const NOW = 1_800_000_000_000;
const SNAPSHOT: PurchaseSnapshot = {
  saleId: 's1',
  items: [{ name: 'Yerba 1kg', quantity: 2, unit: 'Unit' }],
  total: 3000,
  createdAt: NOW,
};

describe('PurchaseSnapshotService', () => {
  let storage: Storage;
  let service: PurchaseSnapshotService;

  beforeEach(() => {
    storage = createMemoryStorage();
    TestBed.configureTestingModule({
      providers: [{ provide: PURCHASE_STORAGE, useValue: storage }],
    });
    service = TestBed.inject(PurchaseSnapshotService);
  });

  it('guarda y recupera el detalle de la venta indicada', () => {
    service.save(SNAPSHOT);

    expect(service.find('s1', NOW)).toEqual(SNAPSHOT);
  });

  it('no devuelve el detalle de otra venta', () => {
    service.save(SNAPSHOT);

    expect(service.find('otra-venta', NOW)).toBeNull();
  });

  it('sin id de venta devuelve el último, mientras sea reciente', () => {
    service.save(SNAPSHOT);

    expect(service.find(null, NOW + 1000)).toEqual(SNAPSHOT);
    expect(service.find(null, NOW + PURCHASE_SNAPSHOT_TTL_MS + 1)).toBeNull();
  });

  it('ignora datos dañados o con otra forma', () => {
    storage.setItem(PURCHASE_SNAPSHOT_KEY, '{no es json');
    expect(service.find(null, NOW)).toBeNull();

    storage.setItem(PURCHASE_SNAPSHOT_KEY, JSON.stringify({ saleId: 1, items: 'x' }));
    expect(service.find(null, NOW)).toBeNull();
  });

  it('sin storage no falla', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: PURCHASE_STORAGE, useValue: null }] });
    const bare = TestBed.inject(PurchaseSnapshotService);

    expect(() => bare.save(SNAPSHOT)).not.toThrow();
    expect(bare.find('s1', NOW)).toBeNull();
  });
});
