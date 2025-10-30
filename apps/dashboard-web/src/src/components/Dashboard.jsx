import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import WhitelistManager from './WhitelistManager';
import WhatsAppQR from './WhatsAppQR';
import CustomAlert from './CustomAlert';
import CustomConfirm from './CustomConfirm';
import ErrorBoundary from './ErrorBoundary';
import { useAlert } from '../hooks/useAlert';
import './Dashboard.css';

export default function Dashboard() {
  const { showAlert, showConfirm, alert, confirm } = useAlert();
  const [activeTab, setActiveTab] = useState('crm'); // 'crm' or 'whitelist'
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [conversationSummary, setConversationSummary] = useState(null);

  // Add client state
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [addingClient, setAddingClient] = useState(false);
  const [whitelistData, setWhitelistData] = useState({});

  // Loading states for various operations
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingWhitelist, setLoadingWhitelist] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [togglingWhitelist, setTogglingWhitelist] = useState({});
  const [resettingClient, setResettingClient] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Local state for form inputs to provide immediate feedback
  const [inputValues, setInputValues] = useState({});

  // AbortController for cleanup
  const abortControllerRef = useRef(null);

  // Online status
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showAlert('Connection restored!', 'success');
    };

    const handleOffline = () => {
      setIsOnline(false);
      showAlert('Connection lost. Please check your internet connection.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showAlert]);

  useEffect(() => {
    fetchClients();
    fetchWhitelistData();

    // Cleanup function to cancel pending requests
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Update page title based on active tab
  useEffect(() => {
    const titles = {
      crm: 'CRM - NovAgent Dashboard',
      whitelist: 'Whitelist - NovAgent Dashboard',
      whatsapp: 'WhatsApp QR - NovAgent Dashboard'
    };
    document.title = titles[activeTab] || 'NovAgent Dashboard';
  }, [activeTab]);

  const fetchClients = async (isRetry = false) => {
    try {
      setLoadingClients(true);
      const data = await api.getAllClients();
      setClients(data);
      setError(null);
      setRetryCount(0);
    } catch (err) {
      console.error('Error fetching clients:', err);

      // Retry logic if online and haven't retried too many times
      if (isOnline && !isRetry && retryCount < 2) {
        setRetryCount(prev => prev + 1);
        showAlert('Retrying to fetch clients...', 'info');
        setTimeout(() => fetchClients(true), 2000);
        return;
      }

      setError(err.message);
      showAlert('Failed to fetch clients. Please check your connection and try again.', 'error');
    } finally {
      setLoadingClients(false);
    }
  };

  const fetchWhitelistData = async () => {
    try {
      setLoadingWhitelist(true);
      const data = await api.getAllWhitelist('client');
      // Create a map: phoneNumber -> true for quick lookup
      const whitelistMap = {};
      data.forEach(entry => {
        whitelistMap[entry.phoneNumber] = true;
      });
      setWhitelistData(whitelistMap);
    } catch (err) {
      console.error('Error fetching whitelist:', err);
    } finally {
      setLoadingWhitelist(false);
    }
  };

  const handleInputChange = (clientId, field, value) => {
    const key = `${clientId}-${field}`;
    setInputValues(prev => ({ ...prev, [key]: value }));
  };

  const createAbortController = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    return abortControllerRef.current;
  };

  const validatePhoneNumber = (phone) => {
    if (!phone || !phone.trim()) {
      return { isValid: false, error: 'Nomor WhatsApp harus diisi!' };
    }

    const cleanPhone = phone.replace(/\D/g, ''); // Remove non-digit characters

    // Check if it starts with Indonesian country code or regional format
    if (cleanPhone.startsWith('0')) {
      if (cleanPhone.length < 10 || cleanPhone.length > 13) {
        return { isValid: false, error: 'Nomor telepon tidak valid (10-13 digit)' };
      }
    } else if (cleanPhone.startsWith('62')) {
      if (cleanPhone.length < 11 || cleanPhone.length > 14) {
        return { isValid: false, error: 'Nomor telepon tidak valid (11-14 digit dengan +62)' };
      }
    } else {
      return { isValid: false, error: 'Nomor harus dimulai dengan 0 atau 62' };
    }

    return { isValid: true, error: null };
  };

  const validateInstagramUrl = (url) => {
    if (!url || !url.trim()) {
      return { isValid: true, error: null }; // Empty is allowed
    }

    const igRegex = /^https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9._-]+\/?$/;
    if (!igRegex.test(url.trim())) {
      return { isValid: false, error: 'URL Instagram tidak valid' };
    }

    return { isValid: true, error: null };
  };

  const handleUpdate = async (id, field, value) => {
    try {
      // Validate Instagram URL if field is igLink
      if (field === 'igLink' && value) {
        const validation = validateInstagramUrl(value);
        if (!validation.isValid) {
          showAlert(validation.error, 'warning');
          // Reset input value
          const key = `${id}-${field}`;
          setInputValues(prev => ({ ...prev, [key]: undefined }));
          return;
        }
      }

      await api.updateClient(id, { [field]: value });
      setClients(prevClients =>
        prevClients.map(c =>
          c.id === id ? { ...c, [field]: value } : c
        )
      );
      // Clear the input value after successful update
      const key = `${id}-${field}`;
      setInputValues(prev => ({ ...prev, [key]: undefined }));
    } catch (err) {
      console.error('Error updating client:', err);
      showAlert('Failed to update: ' + err.message, 'error');
    }
  };

  const handleViewConversations = async (client) => {
    try {
      setLoadingConversations(true);
      setSelectedClient(client);
      setConversationSummary(null); // Reset summary when opening new chat
      const convs = await api.getConversations(client.id);
      setConversations(convs);

      // Auto-update lastContact from latest conversation
      if (convs.length > 0) {
        const latestTimestamp = convs[0].timestamp;
        if (!client.lastContact || new Date(latestTimestamp) > new Date(client.lastContact)) {
          await handleUpdate(client.id, 'lastContact', new Date(latestTimestamp));
        }
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
      showAlert('Failed to fetch conversations: ' + err.message, 'error');
    } finally {
      setLoadingConversations(false);
    }
  };

  const handleDeleteClient = (client) => {
    showConfirm(
      `HAPUS client ${client.nama || formatPhone(client.id)}?\n\n` +
      `⚠️ PERHATIAN: Ini akan MENGHAPUS PERMANENT:\n` +
      `• Semua conversation history\n` +
      `• Event details & pricing\n` +
      `• Meeting schedules\n` +
      `• User record dari database\n` +
      `• Memory context & cache\n\n` +
      `❌ Row akan HILANG dari tabel!\n` +
      `❌ Tindakan ini TIDAK BISA dibatalkan!\n\n` +
      `Client harus didaftarkan ulang jika ingin chat lagi.`,
      async () => {
        // User confirmed - proceed with DELETE
        try {
          setResettingClient(client.id);

          // Use the proper deleteClient API instead of resetClientContext
          await api.deleteClient(client.id);

          // Also try to remove from whitelist for complete cleanup
          try {
            const isWhitelisted = whitelistData[client.id] || false;
            if (isWhitelisted) {
              await api.removeFromWhitelist(client.id);
            }
          } catch (whitelistErr) {
            console.warn('Could not remove from whitelist:', whitelistErr);
            // Don't fail the whole operation if whitelist removal fails
          }

          // Only update state AFTER successful API call
          setClients(prevClients => prevClients.filter(c => c.id !== client.id));

          // Close modal if open
          if (selectedClient && selectedClient.id === client.id) {
            setSelectedClient(null);
            setConversations([]);
          }

          // Remove from whitelist data if present
          setWhitelistData(prev => {
            const newData = { ...prev };
            delete newData[client.id];
            return newData;
          });

          // Clear any input values related to this client
          setInputValues(prev => {
            const newValues = { ...prev };
            Object.keys(newValues).forEach(key => {
              if (key.startsWith(`${client.id}-`)) {
                delete newValues[key];
              }
            });
            return newValues;
          });

          // Show success message
          showAlert(
            `✅ Client berhasil dihapus!\n\n` +
            `Client: ${client.nama || formatPhone(client.id)}\n\n` +
            `Deleted:\n` +
            `✓ All client data from database\n` +
            `✓ Conversation history\n` +
            `✓ User record\n` +
            `✓ Memory context & cache\n\n` +
            `Row telah dihapus permanen dari tabel!`,
            'success'
          );
        } catch (err) {
          console.error('Error deleting client:', err);
          showAlert('Failed to delete client: ' + err.message, 'error');
        } finally {
          setResettingClient(null);
        }
      },
      () => {
        // User cancelled - do nothing
        console.log('Reset cancelled by user');
        setResettingClient(null);
      }
    );
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedClient) return;

    try {
      setSending(true);
      await api.sendWhatsAppMessage(selectedClient.id, newMessage);

      // Refresh conversations
      const convs = await api.getConversations(selectedClient.id);
      setConversations(convs);

      // Update lastContact
      await handleUpdate(selectedClient.id, 'lastContact', new Date());

      setNewMessage('');
      showAlert('Message sent successfully!', 'success');
    } catch (err) {
      console.error('Error sending message:', err);
      showAlert('Failed to send message: ' + err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const handleGetContextSummary = async () => {
    if (!selectedClient) return;

    try {
      setLoadingSummary(true);
      const summary = await api.getConversationSummary(selectedClient.id);
      setConversationSummary(summary);
      showAlert('Context summary generated successfully!', 'success');
    } catch (err) {
      console.error('Error getting context summary:', err);
      showAlert('Failed to generate summary: ' + err.message, 'error');
    } finally {
      setLoadingSummary(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('id-ID');
  };

  const formatPhone = (whatsappId) => {
    if (!whatsappId) return '';
    return whatsappId.replace('@c.us', '');
  };

  const handleAddClient = async (e) => {
    e.preventDefault();

    // Validate phone number
    const phoneValidation = validatePhoneNumber(newClientPhone);
    if (!phoneValidation.isValid) {
      showAlert(phoneValidation.error, 'warning');
      return;
    }

    try {
      setAddingClient(true);

      // Format phone number to WhatsApp format
      const formattedPhone = newClientPhone.startsWith('0')
        ? `62${newClientPhone.slice(1)}@c.us`
        : `${newClientPhone}@c.us`;

      // Check if client already exists
      const existingClients = await api.getAllClients();
      const existingClient = existingClients.find(c => c.id === formattedPhone);

      if (existingClient) {
        showAlert('Client dengan nomor ini sudah ada di dashboard!', 'warning');
        // Refresh data to show existing client
        await fetchClients();
        await fetchWhitelistData();
        return;
      }

      // Check if phone exists in whitelist but not in clients (inconsistent state)
      const existingWhitelist = await api.getAllWhitelist('client');
      const existingWhitelistEntry = existingWhitelist.find(w => w.phoneNumber === formattedPhone);

      if (existingWhitelistEntry) {
        // Fix inconsistent state: create client record to match whitelist
        await api.createClient({
          id: formattedPhone,
          nama: newClientName || existingWhitelistEntry.nama || null,
          dealStatus: 'prospect',
          status: 'To Do'
        });

        showAlert('Client sudah ada di whitelist, rekam client telah dibuat ulang!', 'success');
      } else {
        // New client: create both client record and whitelist entry
        await api.createClient({
          id: formattedPhone,
          nama: newClientName || null,
          dealStatus: 'prospect',
          status: 'To Do'
        });

        await api.addToWhitelist({
          phoneNumber: formattedPhone,
          type: 'client',
          nama: newClientName || null
        });

        showAlert('Client berhasil ditambahkan!\nBot sekarang akan merespon chat dari nomor ini.', 'success');
      }

      // Clear form
      setNewClientPhone('');
      setNewClientName('');

      // Refresh both clients and whitelist data
      await fetchClients();
      await fetchWhitelistData();

    } catch (err) {
      console.error('Error adding client:', err);
      showAlert('Gagal menambah client: ' + err.message, 'error');
    } finally {
      setAddingClient(false);
    }
  };

  const handleToggleWhitelist = async (phoneNumber, currentStatus) => {
    const action = currentStatus ? 'hapus dari' : 'tambahkan ke';
    const actionIng = currentStatus ? 'menghapus' : 'menambahkan';

    showConfirm(
      `${action.charAt(0).toUpperCase() + action.slice(1)} whitelist untuk ${phoneNumber.replace('@c.us', '')}?\n\nBot ${currentStatus ? 'tidak akan' : 'akan'} merespon chat dari nomor ini.`,
      async () => {
        await executeToggleWhitelist(phoneNumber, currentStatus, actionIng);
      }
    );
  };

  const executeToggleWhitelist = async (phoneNumber, currentStatus, actionIng) => {
    try {
      setTogglingWhitelist(prev => ({ ...prev, [phoneNumber]: true }));

      if (currentStatus) {
        // Remove from whitelist
        await api.removeFromWhitelist(phoneNumber);
      } else {
        // Add to whitelist
        await api.addToWhitelist({
          phoneNumber: phoneNumber,
          type: 'client',
          nama: null
        });
      }

      await fetchWhitelistData();
      showAlert(`Berhasil ${actionIng} whitelist!`, 'success');
    } catch (err) {
      console.error(`Error ${actionIng} whitelist:`, err);
      showAlert(`Gagal ${actionIng} whitelist: ` + err.message, 'error');
    } finally {
      setTogglingWhitelist(prev => ({ ...prev, [phoneNumber]: false }));
    }
  };

  if (loadingClients && !clients.length) {
    return (
      <div className="dashboard-container">
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="error">Error: {error}</div>
        <button onClick={fetchClients}>Retry</button>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-left">
          <h1>NovAgent CRM Dashboard</h1>
          <div className={`connection-status ${isOnline ? 'online' : 'offline'}`}>
            <span className="status-dot"></span>
            {isOnline ? 'Online' : 'Offline'}
          </div>
        </div>
        <div className="tab-navigation">
          <button
            onClick={() => setActiveTab('crm')}
            className={`tab-btn ${activeTab === 'crm' ? 'active' : ''}`}
          >
            CRM
          </button>
          <button
            onClick={() => setActiveTab('whitelist')}
            className={`tab-btn ${activeTab === 'whitelist' ? 'active' : ''}`}
          >
            Whitelist
          </button>
          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`tab-btn ${activeTab === 'whatsapp' ? 'active' : ''}`}
          >
            WhatsApp
          </button>
        </div>
        {activeTab === 'crm' && (
          <button
            onClick={async () => {
              setRefreshing(true);
              try {
                await fetchClients();
                await fetchWhitelistData();
                showAlert('Data refreshed successfully!', 'success');
              } catch (err) {
                showAlert('Failed to refresh data: ' + err.message, 'error');
              } finally {
                setRefreshing(false);
              }
            }}
            className="refresh-btn"
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        )}
      </header>

      {/* CRM TAB CONTENT */}
      {activeTab === 'crm' && (
        <ErrorBoundary>
          <>
            {/* Add Client Section */}
            <div className="add-client-section">
            <h3>Tambah Client Baru</h3>
            <p className="section-description">
              Client yang ditambahkan otomatis masuk ke whitelist agar bot bisa merespon chat mereka.
            </p>
            <form onSubmit={handleAddClient} className="add-client-form">
              <div className="form-row">
                <input
                  type="text"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  placeholder="Nomor WhatsApp (contoh: 08123456789 atau 628123456789)"
                  disabled={addingClient}
                  className="client-phone-input"
                />
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Nama client (opsional)"
                  disabled={addingClient}
                  className="client-name-input"
                />
                <button type="submit" disabled={addingClient} className="client-add-btn">
                  {addingClient ? 'Menambah...' : 'Tambah Client'}
                </button>
              </div>
            </form>
          </div>

          <div className="dashboard-stats">
            <div className="stat-card">
              <h3>Total Clients</h3>
              <p>{clients.length}</p>
            </div>
            <div className="stat-card">
              <h3>To Do</h3>
              <p>{clients.filter(c => c.status === 'To Do').length}</p>
            </div>
            <div className="stat-card">
              <h3>Follow Up</h3>
              <p>{clients.filter(c => c.status === 'Follow Up').length}</p>
            </div>
            <div className="stat-card">
              <h3>Next Year</h3>
              <p>{clients.filter(c => c.status === 'Next Year').length}</p>
            </div>
          </div>

          <div className="table-container">
        <table className="crm-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Whitelist</th>
              <th>WhatsApp</th>
              <th>Nama</th>
              <th>Instansi / EO</th>
              <th>Event</th>
              <th>IG Link</th>
              <th>Last Contact</th>
              <th>Meeting Date</th>
              <th>Status</th>
              <th>Deal Status</th>
              <th>PIC</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client, index) => {
              const isWhitelisted = whitelistData[client.id] || false;
              return (
              <tr key={client.id}>
                <td>{index + 1}</td>
                <td className="whitelist-cell">
                  <button
                    onClick={() => handleToggleWhitelist(client.id, isWhitelisted)}
                    className={`whitelist-toggle-btn ${isWhitelisted ? 'active' : 'inactive'}`}
                    title={isWhitelisted ? 'Klik untuk remove dari whitelist' : 'Klik untuk add ke whitelist'}
                    disabled={togglingWhitelist[client.id]}
                  >
                    {togglingWhitelist[client.id] ? '...' : (isWhitelisted ? 'Active' : 'Inactive')}
                  </button>
                </td>
                <td className="phone-cell">{formatPhone(client.id)}</td>
                <td>
                  <input
                    type="text"
                    value={inputValues[`${client.id}-nama`] ?? (client.nama || '')}
                    onChange={(e) => handleInputChange(client.id, 'nama', e.target.value)}
                    onBlur={(e) => handleUpdate(client.id, 'nama', e.target.value)}
                    placeholder="Nama"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={inputValues[`${client.id}-instansi`] ?? (client.instansi || '')}
                    onChange={(e) => handleInputChange(client.id, 'instansi', e.target.value)}
                    onBlur={(e) => handleUpdate(client.id, 'instansi', e.target.value)}
                    placeholder="Instansi"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={inputValues[`${client.id}-event`] ?? (client.event || '')}
                    onChange={(e) => handleInputChange(client.id, 'event', e.target.value)}
                    onBlur={(e) => handleUpdate(client.id, 'event', e.target.value)}
                    placeholder="Event"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={inputValues[`${client.id}-igLink`] ?? (client.igLink || '')}
                    onChange={(e) => handleInputChange(client.id, 'igLink', e.target.value)}
                    onBlur={(e) => handleUpdate(client.id, 'igLink', e.target.value)}
                    placeholder="Instagram URL"
                    className="ig-link-input"
                  />
                </td>
                <td>{formatDate(client.lastContact)}</td>
                <td className="meeting-date-cell">
                  {client.meetingDate ? (
                    <div className="meeting-date-display">
                      <span className="meeting-date-text">
                        {new Date(client.meetingDate).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  ) : (
                    <span className="no-meeting">-</span>
                  )}
                </td>
                <td>
                  <select
                    value={client.status || 'To Do'}
                    onChange={(e) => handleUpdate(client.id, 'status', e.target.value)}
                  >
                    <option value="To Do">To Do</option>
                    <option value="Follow Up">Follow Up</option>
                    <option value="Next Year">Next Year</option>
                  </select>
                </td>
                <td>
                  <select
                    value={client.dealStatus || 'prospect'}
                    onChange={(e) => handleUpdate(client.id, 'dealStatus', e.target.value)}
                  >
                    <option value="prospect">Prospect</option>
                    <option value="negotiation">Negotiation</option>
                    <option value="closed">Closed</option>
                    <option value="lost">Lost</option>
                  </select>
                </td>
                <td>
                  <select
                    value={client.pic || ''}
                    onChange={(e) => handleUpdate(client.id, 'pic', e.target.value)}
                  >
                    <option value="">-</option>
                    <option value="Dzaki">Dzaki</option>
                    <option value="Ahmad">Ahmad</option>
                    <option value="Sarah">Sarah</option>
                    <option value="Budi">Budi</option>
                  </select>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '5px', flexDirection: 'column' }}>
                    <button
                      className="action-btn"
                      onClick={() => handleViewConversations(client)}
                      disabled={loadingConversations}
                    >
                      {loadingConversations ? 'Loading...' : 'Chat'}
                    </button>
                    <button
                      className="action-btn reset-btn"
                      onClick={() => handleDeleteClient(client)}
                      title="Delete client permanently from database"
                      disabled={resettingClient === client.id}
                    >
                      {resettingClient === client.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedClient && (
        <div className="modal-overlay" onClick={() => setSelectedClient(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Chat: {selectedClient.nama || formatPhone(selectedClient.id)}</h2>
              <div className="modal-header-actions">
                <button
                  onClick={handleGetContextSummary}
                  disabled={loadingSummary || conversations.length === 0}
                  className="context-summary-btn"
                >
                  {loadingSummary ? 'Loading...' : 'Summary'}
                </button>
                <button
                  onClick={() => setSelectedClient(null)}
                  className="modal-header-close"
                >
                  ×
                </button>
              </div>
            </div>

            {conversationSummary && (
              <div className="summary-modal-overlay" onClick={() => setConversationSummary(null)}>
                <div className="summary-modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="summary-modal-header">
                    <h3>Conversation Summary</h3>
                    <button
                      onClick={() => setConversationSummary(null)}
                      className="summary-modal-close"
                    >
                      ×
                    </button>
                  </div>
                  <div className="summary-modal-body">
                    {conversationSummary.summary}
                  </div>
                  {conversationSummary.totalMessages && (
                    <div className="summary-modal-footer">
                      Total messages: {conversationSummary.totalMessages} |
                      Last updated: {new Date(conversationSummary.timestamp).toLocaleString('id-ID')}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="chat-history-container">
              {conversations.length === 0 ? (
                <div className="no-messages-placeholder">
                  <div className="no-messages-icon">No Messages</div>
                  <p>No messages yet</p>
                  <span>Start a conversation below</span>
                </div>
              ) : (
                <div className="chat-bubbles">
                  {conversations.map((conv) => (
                    <div key={conv.id}>
                      {/* User Message (if exists) */}
                      {conv.userMessage && (
                        <div className="chat-bubble-wrapper user-bubble-wrapper">
                          <div className="chat-bubble user-bubble">
                            <div className="bubble-content">{conv.userMessage}</div>
                            <div className="bubble-time">
                              {new Date(conv.timestamp).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Agent/Admin Message (if exists) */}
                      {conv.agentResponse && (
                        <div className="chat-bubble-wrapper agent-bubble-wrapper">
                          <div className="chat-bubble agent-bubble">
                            <div className="bubble-sender">
                              {conv.metadata?.source === 'dashboard' ? 'Admin' : 'NovaBot'}
                            </div>
                            <div className="bubble-content">{conv.agentResponse}</div>
                            <div className="bubble-time">
                              {new Date(conv.timestamp).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="message-form-container">
              <form onSubmit={handleSendMessage} className="message-form">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message here..."
                  rows="3"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="send-btn"
                >
                  {sending ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
          </>
        </ErrorBoundary>
      )}

      {/* WHITELIST TAB CONTENT */}
      {activeTab === 'whitelist' && (
        <ErrorBoundary>
          <WhitelistManager />
        </ErrorBoundary>
      )}

      {/* WHATSAPP TAB CONTENT */}
      {activeTab === 'whatsapp' && (
        <ErrorBoundary>
          <WhatsAppQR />
        </ErrorBoundary>
      )}

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
