import { isSupabaseConfigured } from '@/services/clienteSupabase';
import { guardarLogoEmpresa, obtenerLogoEmpresa } from '@/services/empresa.service';

const LOGO_STORAGE_KEY = 'mercato_company_logo';
const LOGO_CHANGE_EVENT = 'mercato-logo-change';

const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ACCEPTED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];

export function getCompanyLogo(): string | null {
  try {
    return localStorage.getItem(LOGO_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setCompanyLogo(dataUrl: string) {
  localStorage.setItem(LOGO_STORAGE_KEY, dataUrl);
  window.dispatchEvent(new Event(LOGO_CHANGE_EVENT));

  if (isSupabaseConfigured()) {
    void guardarLogoEmpresa(dataUrl).catch(() => {
      /* cache local ya guardado */
    });
  }
}

export function clearCompanyLogo() {
  localStorage.removeItem(LOGO_STORAGE_KEY);
  window.dispatchEvent(new Event(LOGO_CHANGE_EVENT));

  if (isSupabaseConfigured()) {
    void guardarLogoEmpresa(null).catch(() => {
      /* ignore */
    });
  }
}

/** Carga logo desde Supabase y actualiza caché local. */
export async function syncCompanyLogoFromDb(): Promise<string | null> {
  if (!isSupabaseConfigured()) return getCompanyLogo();
  try {
    const url = await obtenerLogoEmpresa();
    if (url) {
      localStorage.setItem(LOGO_STORAGE_KEY, url);
      window.dispatchEvent(new Event(LOGO_CHANGE_EVENT));
      return url;
    }
    localStorage.removeItem(LOGO_STORAGE_KEY);
    window.dispatchEvent(new Event(LOGO_CHANGE_EVENT));
    return null;
  } catch {
    return getCompanyLogo();
  }
}

export function readLogoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!ACCEPTED.includes(file.type) && !file.name.match(/\.(png|jpe?g|webp|svg)$/i)) {
      reject(new Error('Formato no válido. Usa PNG, JPG, WEBP o SVG.'));
      return;
    }
    if (file.size > MAX_BYTES) {
      reject(new Error('La imagen supera el máximo de 2MB.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('No se pudo leer la imagen.'));
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

export function subscribeLogoChange(callback: () => void) {
  window.addEventListener(LOGO_CHANGE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(LOGO_CHANGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}
