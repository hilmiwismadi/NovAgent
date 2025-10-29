import { useState, useEffect } from 'react';
import './CustomConfirm.css';

/**
 * Custom Confirm Component
 * Replaces vanilla JavaScript confirm() with a modern, styled modal
 */
export default function CustomConfirm({
  message,
  confirmText = 'Konfirmasi',
  cancelText = 'Batal',
  onConfirm,
  onCancel
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleConfirm = () => {
    setIsVisible(false);
    setTimeout(() => {
      if (onConfirm) onConfirm();
    }, 300);
  };

  const handleCancel = () => {
    setIsVisible(false);
    setTimeout(() => {
      if (onCancel) onCancel();
    }, 300);
  };

  return (
    <div className={`custom-confirm-overlay ${isVisible ? 'visible' : ''}`} onClick={handleCancel}>
      <div className={`custom-confirm ${isVisible ? 'visible' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="custom-confirm-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </div>
        <div className="custom-confirm-content">
          <h3 className="custom-confirm-title">Konfirmasi</h3>
          <p className="custom-confirm-message">{message}</p>
        </div>
        <div className="custom-confirm-actions">
          <button
            className="custom-confirm-btn custom-confirm-btn-cancel"
            onClick={handleCancel}
          >
            {cancelText}
          </button>
          <button
            className="custom-confirm-btn custom-confirm-btn-confirm"
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
