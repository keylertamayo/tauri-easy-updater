import type { CSSProperties, ReactNode } from 'react';
import type { UpdateInfo } from '../types';

type Theme = 'light' | 'dark' | 'auto';

export interface UpdateModalProps {
  updateInfo: UpdateInfo;
  onDismiss: () => void;
  appName?: string;
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
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // ignore
    }
  }
}

export function UpdateModal(props: UpdateModalProps) {
  const { updateInfo, onDismiss, appName, theme = 'auto', className } = props;
  const resolvedTheme = resolveTheme(theme);

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15,23,42,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 60
  };

  const modalStyle: CSSProperties =
    resolvedTheme === 'dark'
      ? {
          backgroundColor: '#020617',
          color: '#e5e7eb',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          maxWidth: '28rem',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(15,23,42,0.8)'
        }
      : {
          backgroundColor: 'white',
          color: '#0f172a',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          maxWidth: '28rem',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(15,23,42,0.2)'
        };

  const primaryButtonStyle: CSSProperties =
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
          borderColor: '#4b5563',
          color: '#e5e7eb'
        }
      : {
          borderColor: '#cbd5f5',
          color: '#1f2937'
        };

  const textMuted: CSSProperties = {
    opacity: 0.8,
    fontSize: '0.875rem'
  };

  const title: ReactNode = appName ? `${appName} tiene una nueva versión` : 'Nueva actualización disponible';

  return (
    <div style={overlayStyle}>
      <div style={modalStyle} className={className}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '0.75rem'
          }}
        >
          <div>
            <h2
              style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                margin: 0,
                marginBottom: '0.25rem'
              }}
            >
              {title}
            </h2>
            <p style={textMuted}>
              Versión actual {updateInfo.currentVersion} · Nueva versión {updateInfo.latestVersion}
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              lineHeight: 1,
              marginLeft: '0.5rem'
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{
            marginTop: '0.75rem',
            marginBottom: '1rem',
            maxHeight: '12rem',
            overflowY: 'auto',
            padding: '0.5rem',
            borderRadius: '0.5rem',
            backgroundColor: resolvedTheme === 'dark' ? '#020617' : '#f1f5f9',
            fontSize: '0.875rem',
            whiteSpace: 'pre-wrap'
          }}
        >
          {updateInfo.releaseNotes || 'Esta actualización incluye mejoras y correcciones de errores.'}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem',
            marginTop: '0.5rem'
          }}
        >
          <button
            type="button"
            onClick={onDismiss}
            style={{
              ...secondaryButtonStyle,
              background: 'transparent',
              padding: '0.45rem 0.9rem',
              borderRadius: '9999px',
              borderWidth: 1,
              borderStyle: 'solid',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            Recordarme después
          </button>
          <button
            type="button"
            onClick={() => {
              void openUrl(updateInfo.downloadUrl);
            }}
            style={{
              ...primaryButtonStyle,
              padding: '0.45rem 0.9rem',
              borderRadius: '9999px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500
            }}
          >
            Descargar ahora
          </button>
        </div>
      </div>
    </div>
  );
}

