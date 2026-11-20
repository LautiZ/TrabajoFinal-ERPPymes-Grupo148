import { canCreateUsers, creatableRoles } from './user-creation';

describe('user-creation', () => {
  it('el propietario crea administradores y empleados', () => {
    expect(creatableRoles('Owner')).toEqual(['Admin', 'Employee']);
    expect(canCreateUsers('Owner')).toBe(true);
  });

  it('el administrador solo crea empleados: nunca un administrador ni un propietario', () => {
    expect(creatableRoles('Admin')).toEqual(['Employee']);
    expect(creatableRoles('Admin')).not.toContain('Admin');
    expect(creatableRoles('Admin')).not.toContain('Owner');
    expect(canCreateUsers('Admin')).toBe(true);
  });

  it('el empleado no crea a nadie', () => {
    expect(creatableRoles('Employee')).toEqual([]);
    expect(canCreateUsers('Employee')).toBe(false);
  });

  it('sin sesión nadie puede crear usuarios', () => {
    expect(creatableRoles(null)).toEqual([]);
    expect(canCreateUsers(undefined)).toBe(false);
  });

  it('nadie puede crear un propietario (es único, RN-16.1)', () => {
    for (const role of ['Owner', 'Admin', 'Employee'] as const) {
      expect(creatableRoles(role)).not.toContain('Owner');
    }
  });
});
