import { useState, useEffect } from 'react';
import api from '../services/api';
import QRCode from 'react-qr-code';
import CustomAlert from './CustomAlert';
import CustomConfirm from './CustomConfirm';
import { useAlert } from '../hooks/useAlert';
import './WhatsAppQR.css';

export default function WhatsAppQR() {
  const { showAlert, showConfirm, alert, confirm } = useAlert();
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [waStatus, setWaStatus] = useState({ status: 'unknown' });
  const [waInfo, setWaInfo] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetchAll();

    // Poll for updates every 5 seconds
    const interval = setInterval(() => {
      fetchAll();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const fetchAll = async () => {
    await Promise.all([
      fetchQRCode(),
      fetchStatus(),
      fetchInfo()
    ]);
  };

  const fetchQRCode = async () => {
    try {
      const data = await api.getWhatsAppQR();
      setQrData(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching QR code:', error);
      setLoading(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const status = await api.getWhatsAppStatus();
      setWaStatus(status);
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  const fetchInfo = async () => {
    try {
      const info = await api.getWhatsAppInfo();
      setWaInfo(info);
    } catch (error) {
      console.error('Error fetching info:', error);
      setWaInfo(null);
    }
  };

  const handleDisconnect = async () => {
    showConfirm(
      'Are you sure you want to disconnect WhatsApp? You will need to scan the QR code again to reconnect.',
      async () => {
        await executeDisconnect();
      },
      null,
      'Yes, Disconnect',
      'Cancel'
    );
  };

  const executeDisconnect = async () => {
    setDisconnecting(true);
    try {
      const result = await api.logoutWhatsApp();
      if (result.success) {
        showAlert('Successfully disconnected! Please scan the QR code to reconnect.', 'success');
        // Refresh data
        await fetchAll();
      } else {
        showAlert('Failed to disconnect: ' + (result.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      showAlert('Error disconnecting: ' + error.message, 'error');
    } finally {
      setDisconnecting(false);
    }
  };

  const formatPhoneNumber = (number) => {
    if (!number) return 'Unknown';
    // Format: 62877xxx → +62 877-xxx-xxxx
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.startsWith('62')) {
      const formatted = `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)}-${cleaned.slice(5, 9)}-${cleaned.slice(9)}`;
      return formatted;
    }
    return '+' + cleaned;
  };

  if (loading) {
    return (
      <div className="qr-container loading">
        <div className="spinner"></div>
        <p>Loading WhatsApp status...</p>
      </div>
    );
  }

  return (
    <div className="qr-container">
      <div className="qr-header">
        <h2>WhatsApp Connection</h2>
        <div className={`status-badge ${waStatus.status}`}>
          {waStatus.status === 'connected' ? 'Connected' :
           waStatus.status === 'disconnected' ? 'Disconnected' :
           'Connecting'}
        </div>
      </div>

      {qrData && qrData.available ? (
        <div className="qr-content">
          <div className="qr-instructions">
            <h3>Connect Your WhatsApp</h3>
            <ol>
              <li>Open WhatsApp on your phone</li>
              <li>Navigate to Settings → Linked Devices</li>
              <li>Tap "Link a Device"</li>
              <li>Scan this QR code</li>
            </ol>
          </div>

          <div className="qr-code-display">
            <QRCode
              value={qrData.qr}
              size={240}
              level="H"
              style={{ margin: '0 auto', display: 'block' }}
            />
            <p className="qr-timestamp">
              {new Date(qrData.timestamp).toLocaleString()}
            </p>
            <p className="qr-note">
              QR code auto-refreshes every 60 seconds
            </p>
          </div>
        </div>
      ) : (
        <div className="qr-not-available">
          <h3>Connected Successfully</h3>

          {waInfo && waInfo.connected && (
            <>
              <p>Your WhatsApp account is linked to this dashboard.</p>

              <div className="connected-info">
                <div className="info-card">
                  <div className="info-label">Phone Number</div>
                  <div className="info-value">{formatPhoneNumber(waInfo.phoneNumber)}</div>
                </div>

                {waInfo.pushname && (
                  <div className="info-card">
                    <div className="info-label">Account Name</div>
                    <div className="info-value">{waInfo.pushname}</div>
                  </div>
                )}

                {waInfo.platform && (
                  <div className="info-card">
                    <div className="info-label">Platform</div>
                    <div className="info-value">{waInfo.platform}</div>
                  </div>
                )}

                <div className="info-card">
                  <div className="info-label">Status</div>
                  <div className="info-value">{waInfo.state}</div>
                </div>
              </div>
            </>
          )}

          <p className="device-info">
            View this connection in WhatsApp → Settings → Linked Devices
          </p>

          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="disconnect-btn"
          >
            {disconnecting ? 'Disconnecting...' : 'Disconnect Device'}
          </button>
        </div>
      )}

      <div className="qr-footer">
        <p className="help-text">
          Ensure the WhatsApp bot service is running for full functionality
        </p>
        {waStatus.pendingMessages > 0 && (
          <p className="pending-messages">
            {waStatus.pendingMessages} pending message{waStatus.pendingMessages > 1 ? 's' : ''} in queue
          </p>
        )}
      </div>

      {/* Custom Alert and Confirm Modals */}
      {alert && (
        <CustomAlert
          message={alert.message}
          type={alert.type}
          onClose={() => showAlert(null)}
        />
      )}
      {confirm && (
        <CustomConfirm
          message={confirm.message}
          confirmText={confirm.confirmText}
          cancelText={confirm.cancelText}
          onConfirm={confirm.onConfirm}
          onCancel={confirm.onCancel}
        />
      )}
    </div>
  );
}
