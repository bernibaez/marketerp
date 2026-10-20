-- Mercato — Migración para permitir roles personalizados dinámicos
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run

-- 0. Asegurar extensiones requeridas para generación de UUIDs y contraseñas
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Eliminar restricción de CHECK fija en la tabla perfiles
-- Esto permite que cualquier rol (ej: 'superadmin', 'supervisor', etc.) pueda asignarse a los usuarios
ALTER TABLE perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check;

-- 2. Asegurar que la tabla roles exista con clave única en codigo
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    permisos JSONB DEFAULT '{}'::jsonb,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- 3. Actualizar función es_admin() para incluir 'superadmin' además de 'admin' y 'super_admin'
CREATE OR REPLACE FUNCTION es_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfiles
    WHERE id = auth.uid() AND rol IN ('admin', 'super_admin', 'superadmin') AND activo = TRUE
  );
$$;

-- 4. Actualizar función RPC crear_usuario_sistema para validar contra la tabla roles
DROP FUNCTION IF EXISTS crear_usuario_sistema(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS crear_usuario_sistema;

CREATE OR REPLACE FUNCTION crear_usuario_sistema(
    p_correo TEXT,
    p_password TEXT,
    p_nombre_completo TEXT,
    p_rol TEXT,
    p_sucursal_id UUID DEFAULT NULL,
    p_telefono TEXT DEFAULT NULL,
    p_codigo_acceso TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_caller_rol TEXT;
    v_user_id UUID;
    v_encrypted TEXT;
BEGIN
    SELECT rol INTO v_caller_rol FROM perfiles WHERE id = auth.uid();

    -- Permitir bootstrap si no hay perfiles aún (primer admin vía service/SQL)
    IF EXISTS (SELECT 1 FROM perfiles LIMIT 1) THEN
        IF v_caller_rol IS NULL OR (v_caller_rol NOT IN ('admin', 'super_admin', 'superadmin') AND NOT EXISTS (
            SELECT 1 FROM roles r WHERE r.codigo = v_caller_rol AND (r.permisos->'usuarios'->>'crear')::boolean = true
        )) THEN
            RAISE EXCEPTION 'Solo admin/super_admin o usuarios con permiso pueden crear usuarios';
        END IF;
    END IF;

    -- Validar que el rol exista en la tabla roles o sea un código estándar
    IF NOT EXISTS (SELECT 1 FROM roles WHERE lower(codigo) = lower(p_rol))
       AND lower(p_rol) NOT IN ('admin', 'super_admin', 'superadmin', 'cajero', 'almacen', 'contable', 'vendedor') THEN
        RAISE EXCEPTION 'El rol "%" no existe en el catálogo de roles', p_rol;
    END IF;

    IF EXISTS (SELECT 1 FROM perfiles WHERE correo = lower(p_correo)) THEN
        RAISE EXCEPTION 'Ya existe un usuario con ese correo';
    END IF;

    v_user_id := gen_random_uuid();
    v_encrypted := crypt(p_password, gen_salt('bf'));

    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
    ) VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        lower(p_correo),
        v_encrypted,
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('nombre_completo', p_nombre_completo),
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    );

    INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
    ) VALUES (
        v_user_id,
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', lower(p_correo)),
        'email',
        v_user_id::text,
        NOW(),
        NOW(),
        NOW()
    );

    INSERT INTO perfiles (
        id, nombre_completo, correo, telefono, rol, sucursal_id, codigo_acceso, activo
    ) VALUES (
        v_user_id,
        p_nombre_completo,
        lower(p_correo),
        p_telefono,
        lower(p_rol),
        p_sucursal_id,
        p_codigo_acceso,
        TRUE
    );

    RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION crear_usuario_sistema(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT) TO authenticated, anon;

-- 5. Asegurar políticas RLS de la tabla 'roles' para lectura y escritura completa
DROP POLICY IF EXISTS roles_select ON roles;
CREATE POLICY roles_select ON roles
  FOR SELECT TO authenticated, anon
  USING (TRUE);

DROP POLICY IF EXISTS roles_insert ON roles;
CREATE POLICY roles_insert ON roles
  FOR INSERT TO authenticated, anon
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS roles_update ON roles;
CREATE POLICY roles_update ON roles
  FOR UPDATE TO authenticated, anon
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS roles_delete ON roles;
CREATE POLICY roles_delete ON roles
  FOR DELETE TO authenticated, anon
  USING (TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE roles TO authenticated, anon;

-- 6. Sembrar roles estándar si no existen en la base de datos
INSERT INTO roles (codigo, nombre, descripcion, permisos) VALUES
(
  'almacen', 
  'Almacenista', 
  'Inventario, compras y transferencias', 
  '{"dashboard":{"ver":true},"productos":{"ver":true,"crear":true,"editar":true,"eliminar":true,"exportar":true},"combos":{"ver":true,"crear":true,"editar":true,"eliminar":true},"transferencias":{"ver":true,"crear":true,"aprobar":true},"ajustes_stock":{"ver":true,"crear":true,"aprobar":true,"exportar":true},"balanzas":{"ver":true,"editar":true},"compras":{"ver":true,"crear":true,"editar":true,"aprobar":true,"exportar":true},"configuracion":{"ver":true}}'::jsonb
)
ON CONFLICT (codigo) DO NOTHING;

-- 7. Notificar recarga a PostgREST
NOTIFY pgrst, 'reload schema';
