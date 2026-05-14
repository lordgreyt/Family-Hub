import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, CameraOff } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export const BarcodeScanner = ({ onScan, onClose }: BarcodeScannerProps) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const lastScanRef = useRef<string>('');
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const elId = 'barcode-reader';
    // Ensure the element exists before creating the scanner
    const el = document.getElementById(elId);
    if (!el) {
      setError('Scanner-Element nicht gefunden');
      return;
    }

    const scanner = new Html5Qrcode(elId);
    scannerRef.current = scanner;

    // Check for available cameras
    Html5Qrcode.getCameras()
      .then(devices => {
        if (devices && devices.length > 0) {
          setHasCamera(true);
          const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          };

          // Prefer back camera on mobile
          const backCamera = devices.find(d =>
            d.label.toLowerCase().includes('back') ||
            d.label.toLowerCase().includes('umgebung') ||
            d.label.toLowerCase().includes('environment')
          );
          const cameraId = backCamera ? backCamera.id : devices[0].id;

          scanner
            .start(
              cameraId,
              config,
              (decodedText: string) => {
                // Debounce: ignore rapid duplicate scans and scans within 2 seconds
                if (decodedText === lastScanRef.current) return;
                if (scanTimeoutRef.current) return;

                lastScanRef.current = decodedText;
                scanTimeoutRef.current = setTimeout(() => {
                  scanTimeoutRef.current = null;
                  lastScanRef.current = '';
                }, 2000);

                // Vibrate briefly on successful scan (mobile feedback)
                if (navigator.vibrate) {
                  navigator.vibrate(100);
                }
                onScan(decodedText);
              },
              () => {
                // Scan errors are expected (no barcode in view) — silent handling
              }
            )
            .then(() => {
              setIsScanning(true);
            })
            .catch(err => {
              console.error('Scanner start error:', err);
              setError('Kamera konnte nicht gestartet werden. Bitte erlaube den Kamera-Zugriff.');
            });
        } else {
          setError('Keine Kamera gefunden. Barcode-Scanner benötigt eine Kamera.');
        }
      })
      .catch(err => {
        console.error('Camera enumeration error:', err);
        setError('Kein Zugriff auf die Kamera. Bitte erlaube den Kamera-Zugriff in den Einstellungen.');
      });

    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onScan]);

  const handleStopAndClose = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().then(() => onClose()).catch(() => onClose());
    } else {
      onClose();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.92)',
      padding: '1rem',
    }}>
      {/* Close button */}
      <button
        onClick={handleStopAndClose}
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          zIndex: 10,
          background: 'rgba(255,255,255,0.15)',
          border: 'none',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'white',
        }}
      >
        <X size={22} />
      </button>

      {error ? (
        <div style={{ color: 'white', textAlign: 'center', maxWidth: '320px' }}>
          <CameraOff size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
          <p style={{ fontSize: '0.95rem', lineHeight: 1.5 }}>{error}</p>
          <button
            onClick={onClose}
            className="btn btn-primary"
            style={{ marginTop: '1.5rem', padding: '0.6rem 2rem' }}
          >
            Schließen
          </button>
        </div>
      ) : (
        <>
          <div style={{
            color: 'white',
            textAlign: 'center',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <Camera size={20} />
            <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>
              {isScanning ? 'Barcode in das Sichtfeld halten' : 'Kamera wird gestartet...'}
            </span>
          </div>

          {/* Scanner viewport */}
          <div style={{
            width: '100%',
            maxWidth: '340px',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '2px solid rgba(255,255,255,0.2)',
            boxShadow: '0 0 0 2px rgba(0,217,255,0.3), 0 0 30px rgba(0,217,255,0.15)',
          }}>
            <div
              id="barcode-reader"
              style={{ width: '100%', minHeight: '300px' }}
            />
          </div>

          {/* Manual entry fallback */}
          <p style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: '0.75rem',
            marginTop: '1rem',
            textAlign: 'center',
          }}>
            Halte den Barcode ruhig und gut beleuchtet ins Sichtfeld
          </p>
        </>
      )}
    </div>
  );
};
