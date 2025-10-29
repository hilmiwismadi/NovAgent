import { useState, useCallback } from 'react';

/**
 * Custom hook to manage alert and confirm modals
 * Usage:
 * const { showAlert, showConfirm, AlertComponent } = useAlert();
 *
 * showAlert('Success message', 'success');
 * showConfirm('Are you sure?', () => { // on confirm }, () => { // on cancel });
 */
export function useAlert() {
  const [alert, setAlert] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const showAlert = useCallback((message, type = 'info') => {
    setAlert({ message, type });
  }, []);

  const hideAlert = useCallback(() => {
    setAlert(null);
  }, []);

  const showConfirm = useCallback((message, onConfirm, onCancel, confirmText = 'Konfirmasi', cancelText = 'Batal') => {
    setConfirm({
      message,
      confirmText,
      cancelText,
      onConfirm: () => {
        setConfirm(null);
        if (onConfirm) onConfirm();
      },
      onCancel: () => {
        setConfirm(null);
        if (onCancel) onCancel();
      }
    });
  }, []);

  return {
    showAlert,
    hideAlert,
    showConfirm,
    alert,
    confirm
  };
}
