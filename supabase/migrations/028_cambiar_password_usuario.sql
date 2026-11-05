-- ============================================================
-- Migración 028: RPC para permitir a administradores cambiar la contraseña de un usuario
-- ============================================================

CREATE OR REPLACE FUNCTION cambiar_password_usuario(
    p_user_id UUID,
    p_nueva_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_caller_rol TEXT;
    v_encrypted TEXT;
BEGIN
    -- Permitir si es el mismo usuario o si el ejecutor tiene rol administrador
    IF auth.uid() <> p_user_id THEN
        SELECT rol INTO v_caller_rol FROM perfiles WHERE id = auth.uid();
        IF v_caller_rol IS NULL OR v_caller_rol NOT IN ('admin', 'super_admin', 'superadmin') THEN
            RAISE EXCEPTION 'Solo administradores pueden cambiar la contraseña de otros usuarios';
        END IF;
    END IF;

    IF length(trim(p_nueva_password)) < 6 THEN
        RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres';
    END IF;

    v_encrypted := crypt(trim(p_nueva_password), gen_salt('bf'));

    UPDATE auth.users
    SET encrypted_password = v_encrypted,
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION cambiar_password_usuario(UUID, TEXT) TO authenticated;

