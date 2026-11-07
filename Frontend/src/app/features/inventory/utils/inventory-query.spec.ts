import { ParamMap, convertToParamMap } from '@angular/router';
import {
  DEFAULT_LIST_STATE,
  ListState,
  hasActiveFilters,
  parseListState,
  toListQuery,
  toQueryParams,
} from './inventory-query';

const params = (value: Record<string, string>): ParamMap => convertToParamMap(value);

describe('parseListState', () => {
  it('usa los valores por defecto cuando la URL no trae parámetros', () => {
    expect(parseListState(params({}))).toEqual(DEFAULT_LIST_STATE);
  });

  it('lee página, tamaño, búsqueda, orden y filtros', () => {
    const state = parseListState(
      params({
        page: '3',
        limit: '25',
        search: '  yerba ',
        sortBy: 'price',
        sortOrder: 'desc',
        categoryId: 'c1',
        stockStatus: 'low',
      }),
    );

    expect(state).toEqual({
      page: 3,
      limit: 25,
      search: 'yerba',
      sortBy: 'price',
      sortOrder: 'desc',
      categoryId: 'c1',
      stockStatus: 'low',
    });
  });

  it('descarta valores inválidos en vez de romper la vista', () => {
    const state = parseListState(
      params({
        page: '-2',
        limit: '999',
        sortBy: 'password',
        sortOrder: 'sideways',
        stockStatus: 'hacked',
      }),
    );

    expect(state).toEqual(DEFAULT_LIST_STATE);
  });

  it('descarta páginas no numéricas o decimales', () => {
    expect(parseListState(params({ page: 'abc' })).page).toBe(1);
    expect(parseListState(params({ page: '2.5' })).page).toBe(1);
  });
});

describe('toQueryParams', () => {
  it('omite los valores por defecto para dejar la URL limpia', () => {
    expect(toQueryParams(DEFAULT_LIST_STATE)).toEqual({
      page: null,
      limit: null,
      search: null,
      sortBy: null,
      sortOrder: null,
      categoryId: null,
      stockStatus: null,
    });
  });

  it('incluye solo lo que difiere del estado por defecto', () => {
    const state: ListState = {
      ...DEFAULT_LIST_STATE,
      page: 2,
      search: 'caf',
      stockStatus: 'out',
    };

    const query = toQueryParams(state);

    expect(query['page']).toBe(2);
    expect(query['search']).toBe('caf');
    expect(query['stockStatus']).toBe('out');
    expect(query['sortBy']).toBeNull();
  });

  it('es el inverso de parseListState', () => {
    const state: ListState = {
      page: 4,
      limit: 50,
      search: 'valvula',
      sortBy: 'stock',
      sortOrder: 'desc',
      categoryId: 'c9',
      stockStatus: 'low',
    };
    const asStrings = Object.fromEntries(
      Object.entries(toQueryParams(state))
        .filter(([, v]) => v !== null)
        .map(([k, v]) => [k, String(v)]),
    );

    expect(parseListState(convertToParamMap(asStrings))).toEqual(state);
  });
});

describe('toListQuery', () => {
  it('convierte el estado en la consulta al backend, sin enviar filtros vacíos', () => {
    expect(toListQuery(DEFAULT_LIST_STATE)).toEqual({
      page: 1,
      limit: 10,
      search: undefined,
      sortBy: 'name',
      sortOrder: 'asc',
      categoryId: undefined,
      stockStatus: undefined,
      lowStockThreshold: undefined,
    });
  });

  it('envía el umbral solo cuando se filtra por stock bajo', () => {
    expect(toListQuery({ ...DEFAULT_LIST_STATE, stockStatus: 'low' }, 15).lowStockThreshold).toBe(
      15,
    );
    expect(
      toListQuery({ ...DEFAULT_LIST_STATE, stockStatus: 'out' }, 15).lowStockThreshold,
    ).toBeUndefined();
  });
});

describe('hasActiveFilters', () => {
  it('detecta búsqueda y filtros, pero no orden ni paginación', () => {
    expect(hasActiveFilters(DEFAULT_LIST_STATE)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_LIST_STATE, page: 3, sortBy: 'price' })).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_LIST_STATE, search: 'x' })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_LIST_STATE, categoryId: 'c1' })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_LIST_STATE, stockStatus: 'out' })).toBe(true);
  });
});
