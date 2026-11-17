import { TestBed } from '@angular/core/testing';
import { createMemoryStorage } from '../testing/storage';
import { TOKEN_STORAGE, TOKEN_STORAGE_KEY, TokenStorageService } from './token-storage.service';

function create(storage: Storage | null): TokenStorageService {
  TestBed.configureTestingModule({ providers: [{ provide: TOKEN_STORAGE, useValue: storage }] });
  return TestBed.inject(TokenStorageService);
}

describe('TokenStorageService', () => {
  it('arranca sin token', () => {
    const service = create(createMemoryStorage());

    expect(service.get()).toBeNull();
    expect(service.token()).toBeNull();
  });

  it('guarda el token en el storage y en memoria', () => {
    const storage = createMemoryStorage();
    const service = create(storage);

    service.set('abc.def.ghi');

    expect(service.get()).toBe('abc.def.ghi');
    expect(storage.getItem(TOKEN_STORAGE_KEY)).toBe('abc.def.ghi');
  });

  it('restaura el token guardado al iniciar (sobrevive al F5)', () => {
    const service = create(createMemoryStorage({ [TOKEN_STORAGE_KEY]: 'guardado' }));

    expect(service.get()).toBe('guardado');
  });

  it('clear borra el token de memoria y del storage', () => {
    const storage = createMemoryStorage({ [TOKEN_STORAGE_KEY]: 'guardado' });
    const service = create(storage);

    service.clear();

    expect(service.get()).toBeNull();
    expect(storage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('expone el token como signal reactivo', () => {
    const service = create(createMemoryStorage());
    const seen: (string | null)[] = [];

    seen.push(service.token());
    service.set('t1');
    seen.push(service.token());
    service.clear();
    seen.push(service.token());

    expect(seen).toEqual([null, 't1', null]);
  });

  it('un valor vacío en el storage cuenta como sin token', () => {
    expect(create(createMemoryStorage({ [TOKEN_STORAGE_KEY]: '' })).get()).toBeNull();
  });

  it('sin storage disponible funciona solo en memoria', () => {
    const service = create(null);

    service.set('solo-memoria');

    expect(service.get()).toBe('solo-memoria');
    service.clear();
    expect(service.get()).toBeNull();
  });

  it('tolera un storage que lanza al leer o al escribir', () => {
    const broken = createMemoryStorage();
    broken.getItem = () => {
      throw new Error('bloqueado');
    };
    broken.setItem = () => {
      throw new Error('cuota');
    };
    broken.removeItem = () => {
      throw new Error('bloqueado');
    };
    const service = create(broken);

    expect(service.get()).toBeNull();
    expect(() => service.set('t')).not.toThrow();
    expect(service.get()).toBe('t');
    expect(() => service.clear()).not.toThrow();
    expect(service.get()).toBeNull();
  });
});
