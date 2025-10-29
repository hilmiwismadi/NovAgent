import { useState, useEffect } from 'react';
import './CustomAlert.css';

/**
 * Custom Alert Component
 * Replaces vanilla JavaScript alert() with a modern, styled modal
 */
export default function CustomAlert({ message, type = 'info', onClose }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation
    setIsVisible(true);

    // Auto-close after 5 seconds for success messages
    if (type === 'success') {
      const timer = setTimeout(() => {
        handleClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      if (onClose) onClose();
    }, 300); // Wait for animation to complete
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  return (
    <div className={`custom-alert-overlay ${isVisible ? 'visible' : ''}`} onClick={handleClose}>
      <div className={`custom-alert custom-alert-${type} ${isVisible ? 'visible' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="custom-alert-icon">{getIcon()}</div>
        <div className="custom-alert-content">
          <p className="custom-alert-message">{message}</p>
        </div>
        <button className="custom-alert-close" onClick={handleClose}>
          ✕
        </button>
      </div>
    </div>
  );
}
