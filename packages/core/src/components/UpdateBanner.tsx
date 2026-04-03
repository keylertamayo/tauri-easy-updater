import type { CSSProperties } from 'react';
import type { UpdateInfo } from '../types';

type Theme = 'light' | 'dark' | 'auto';

export interface UpdateBannerProps {
  updateInfo: UpdateInfo;
  onDismiss: () => void;
  position?: 'top' | 'bottom';
  theme?: Theme;
  className?: string;
}

function resolveTheme(theme: Theme = 'auto'): 'light' | 'dark' {
  if (theme === 'auto' && typeof window !== 'undefined' && 'matchMedia' in window) {
    try {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch {
      // ignore
    }
  }
  return theme === 'auto' ? 'light' : theme;
}

async function openUrl(url: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const { invoke } = await import('@tauri-apps/api/tauri');
    await invoke('plugin:easy-updater|open_url', { url });
  } catch {
    // Fallback: try regular browser navigation.
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // ignore
    }
  }
}

export function UpdateBanner(props: UpdateBannerProps) {
  const { updateInfo, onDismiss, position = 'bottom', theme = 'auto', className } = props;
  const resolvedTheme = resolveTheme(theme);

  const base: CSSProperties = {
    position: 'fixed',
    left: 0,
    right: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    zIndex: 50
  };

  const positionStyle: CSSProperties =
    position === 'top'
      ? {
          top: 0
        }
      : {
          bottom: 0
        };

  const themeStyle: CSSProperties =
    resolvedTheme === 'dark'
      ? {
          backgroundColor: 'rgba(15,23,42,0.95)',
          color: 'white',
          borderTop: position === 'bottom' ? '1px solid rgba(148,163,184,0.5)' : undefined,
          borderBottom: position === 'top' ? '1px solid rgba(148,163,184,0.5)' : undefined
        }
      : {
          backgroundColor: 'rgba(248,250,252,0.98)',
          color: '#020617',
          borderTop: position === 'bottom' ? '1px solid #e2e8f0' : undefined,
          borderBottom: position === 'top' ? '1px solid #e2e8f0' : undefined
        };

  const buttonStyle: CSSProperties =
    resolvedTheme === 'dark'
      ? {
          backgroundColor: '#22c55e',
          color: '#022c22'
        }
      : {
          backgroundColor: '#16a34a',
          color: 'white'
        };

  const secondaryButtonStyle: CSSProperties =
    resolvedTheme === 'dark'
      ? {
          color: '#e5e7eb'
        }
      : {
          color: '#4b5563'
        };

  return (
    <div style={{ ...base, ...positionStyle, ...themeStyle }} className={className}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
        <span style={{ fontWeight: 500 }}>
          Nueva versión {updateInfo.latestVersion} disponible
        </span>
        <span style={{ opacity: 0.8 }}>
          Estás usando la versión {updateInfo.currentVersion}. Descarga la última actualización.
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          type="button"
          style={{
            ...buttonStyle,
            borderRadius: '9999px',
            padding: '0.4rem 0.9rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500
          }}
          onClick={() => {
            void openUrl(updateInfo.downloadUrl);
          }}
        >
          Actualizar ahora
        </button>
        <button
          type="button"
          aria-label="Cerrar"
          style={{
            ...secondaryButtonStyle,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem',
            lineHeight: 1
          }}
          onClick={onDismiss}
        >
          ×
        </button>
      </div>
    </div>
  );
}

