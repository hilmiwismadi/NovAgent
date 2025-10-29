import { useState, useEffect } from 'react';
import api from '../services/api';
import CustomAlert from './CustomAlert';
import CustomConfirm from './CustomConfirm';
import { useAlert } from '../hooks/useAlert';
import './WhitelistManager.css';

export default function WhitelistManager() {
  const { showAlert, showConfirm, alert, confirm } = useAlert();
  const [internalWhitelist, setInternalWhitelist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form states
  const [newInternalPhone, setNewInternalPhone] = useState('');
  const [newInternalName, setNewInternalName] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchWhitelist();
  }, []);

  const fetchWhitelist = async () => {
    try {
      setLoading(true);
      const internal = await api.getAllWhitelist('internal');

      setInternalWhitelist(internal);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching whitelist:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddInternal = async (e) => {
    e.preventDefault();
    if (!newInternalPhone.trim()) {
      showAlert('Nomor WhatsApp harus diisi!', 'warning');
      return;
    }

    try {
      setAdding(true);
      await api.addToWhitelist({
        phoneNumber: newInternalPhone,
        type: 'internal',
        nama: newInternalName || null
      });

      // Refresh list
      await fetchWhitelist();

      // Clear form
      setNewInternalPhone('');
      setNewInternalName('');

      showAlert('Tim internal berhasil ditambahkan ke whitelist!', 'success');
    } catch (err) {
      console.error('Error adding internal:', err);
      showAlert('Gagal menambah tim internal: ' + err.message, 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (phoneNumber, type) => {
    showConfirm(
      `Hapus ${phoneNumber} dari whitelist ${type}?`,
      async () => {
        await executeDelete(phoneNumber);
      }
    );
  };

  const executeDelete = async (phoneNumber) => {
    try {
      await api.removeFromWhitelist(phoneNumber);
      await fetchWhitelist();
      showAlert('Nomor berhasil dihapus dari whitelist!', 'success');
    } catch (err) {
      console.error('Error deleting:', err);
      showAlert('Gagal menghapus nomor: ' + err.message, 'error');
    }
  };

  const formatPhone = (phone) => {
    if (!phone) return '';
    return phone.replace('@c.us', '');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="whitelist-container">
        <div className="loading">Loading whitelist...</div>
      </div>
    );
  }

  return (
    <div className="whitelist-container">
      <header className="whitelist-header">
        <h2>Internal Team Whitelist Management</h2>
        <button onClick={fetchWhitelist} className="refresh-btn-small">
          Refresh
        </button>
      </header>

      {error && (
        <div className="error-banner">
          Error: {error}
          <button onClick={fetchWhitelist}>Retry</button>
        </div>
      )}

      <div className="whitelist-info-top">
        <p>
          ℹ️ <strong>Info:</strong> Untuk menambah client whitelist, gunakan form di tab <strong>CRM</strong>.
          Tab ini khusus untuk manage tim internal yang bisa akses internal commands.
        </p>
      </div>

      <div className="whitelist-sections-single">
        {/* INTERNAL TEAM WHITELIST SECTION */}
        <div className="whitelist-section">
          <h3>Internal Team Whitelist ({internalWhitelist.length})</h3>

          <form onSubmit={handleAddInternal} className="add-form">
            <div className="form-group">
              <input
                type="text"
                value={newInternalPhone}
                onChange={(e) => setNewInternalPhone(e.target.value)}
                placeholder="Nomor WhatsApp (contoh: 628123456789)"
                disabled={adding}
                className="phone-input"
              />
              <input
                type="text"
                value={newInternalName}
                onChange={(e) => setNewInternalName(e.target.value)}
                placeholder="Nama (opsional)"
                disabled={adding}
                className="name-input"
              />
              <button type="submit" disabled={adding} className="add-btn">
                {adding ? 'Menambah...' : 'Tambah Tim Internal'}
              </button>
            </div>
          </form>

          <div className="whitelist-table-container">
            {internalWhitelist.length === 0 ? (
              <p className="empty-state">Belum ada tim internal di whitelist</p>
            ) : (
              <table className="whitelist-table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Nomor WhatsApp</th>
                    <th>Nama</th>
                    <th>Ditambahkan</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {internalWhitelist.map((entry, index) => (
                    <tr key={entry.id}>
                      <td>{index + 1}</td>
                      <td className="phone-cell">{formatPhone(entry.phoneNumber)}</td>
                      <td>{entry.nama || '-'}</td>
                      <td className="date-cell">{formatDate(entry.createdAt)}</td>
                      <td>
                        <button
                          onClick={() => handleDelete(entry.phoneNumber, 'internal')}
                          className="delete-btn"
                          title="Hapus dari whitelist"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="whitelist-info">
        <p>
          <strong>ℹ️ Info:</strong> Nomor bisa dimasukkan dalam format:
          <code>08123456789</code>, <code>628123456789</code>, atau <code>+628123456789</code>
          <br/>
          Sistem akan otomatis mengkonversi ke format WhatsApp yang benar.
        </p>
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
