import { TestBed } from '@angular/core/testing';
import { DEFAULT_LOW_STOCK_THRESHOLD } from '../utils/stock-status';
import {
  INVENTORY_STORAGE,
  LOW_STOCK_THRESHOLD_KEY,
  LowStockThresholdService,
  MAX_LOW_STOCK_THRESHOLD,
} from './low-stock-threshold.service';

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, String(value));
    },
  };
}

function create(storage: Storage | null): LowStockThresholdService {
  TestBed.configureTestingModule({
    providers: [{ provide: INVENTORY_STORAGE, useValue: storage }],
  });
  return TestBed.inject(LowStockThresholdService);
}

describe('LowStockThresholdService', () => {
  it('arranca con el umbral por defecto', () => {
    expect(create(memoryStorage()).value()).toBe(DEFAULT_LOW_STOCK_THRESHOLD);
  });

  it('cambia el umbral y lo recuerda en el storage', () => {
    const storage = memoryStorage();
    const service = create(storage);

    expect(service.set(25)).toBe(true);

    expect(service.value()).toBe(25);
    expect(storage.getItem(LOW_STOCK_THRESHOLD_KEY)).toBe('25');
  });

  it('restaura el umbral guardado al iniciar', () => {
    expect(create(memoryStorage({ [LOW_STOCK_THRESHOLD_KEY]: '40' })).value()).toBe(40);
  });

  it('acepta 0 (solo se considera "sin stock") y decimales', () => {
    const service = create(memoryStorage());

    expect(service.set(0)).toBe(true);
    expect(service.value()).toBe(0);
    expect(service.set(2.5)).toBe(true);
    expect(service.value()).toBe(2.5);
  });

  it('rechaza valores inválidos y deja el umbral como estaba', () => {
    const service = create(memoryStorage());
    service.set(20);

    expect(service.set(-1)).toBe(false);
    expect(service.set(Number.NaN)).toBe(false);
    expect(service.set(Number.POSITIVE_INFINITY)).toBe(false);
    expect(service.set(MAX_LOW_STOCK_THRESHOLD + 1)).toBe(false);

    expect(service.value()).toBe(20);
  });

  it('ignora un valor corrupto o fuera de rango en el storage', () => {
    expect(create(memoryStorage({ [LOW_STOCK_THRESHOLD_KEY]: 'abc' })).value()).toBe(
      DEFAULT_LOW_STOCK_THRESHOLD,
    );
    TestBed.resetTestingModule();
    expect(create(memoryStorage({ [LOW_STOCK_THRESHOLD_KEY]: '-5' })).value()).toBe(
      DEFAULT_LOW_STOCK_THRESHOLD,
    );
  });

  it('funciona en memoria si no hay storage o si falla al escribir', () => {
    const service = create(null);
    expect(service.set(15)).toBe(true);
    expect(service.value()).toBe(15);

    TestBed.resetTestingModule();
    const broken = memoryStorage();
    broken.setItem = () => {
      throw new Error('cuota');
    };
    const other = create(broken);
    expect(other.set(7)).toBe(true);
    expect(other.value()).toBe(7);
  });
});
