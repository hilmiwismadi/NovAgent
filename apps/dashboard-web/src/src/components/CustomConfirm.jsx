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
        <div className="custom-confirm-icon">❓</div>
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
