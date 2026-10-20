export type DefaultUserRole =
  | 'Administrador'
  | 'Cajero'
  | 'Vendedor'
  | 'Almacenista'
  | 'Contador';

export type UserRole = DefaultUserRole | (string & {});

