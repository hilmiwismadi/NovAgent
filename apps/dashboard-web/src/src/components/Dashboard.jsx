import { useState, useEffect } from 'react';
import api from '../services/api';
import WhitelistManager from './WhitelistManager';
import WhatsAppQR from './WhatsAppQR';
import CustomAlert from './CustomAlert';
import CustomConfirm from './CustomConfirm';
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

  useEffect(() => {
    fetchClients();
    fetchWhitelistData();
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

  const fetchClients = async () => {
    try {
      setLoading(true);
      const data = await api.getAllClients();
      setClients(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching clients:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWhitelistData = async () => {
    try {
      const data = await api.getAllWhitelist('client');
      // Create a map: phoneNumber -> true for quick lookup
      const whitelistMap = {};
      data.forEach(entry => {
        whitelistMap[entry.phoneNumber] = true;
      });
      setWhitelistData(whitelistMap);
    } catch (err) {
      console.error('Error fetching whitelist:', err);
    }
  };

  const handleUpdate = async (id, field, value) => {
    try {
      await api.updateClient(id, { [field]: value });
      setClients(clients.map(c =>
        c.id === id ? { ...c, [field]: value } : c
      ));
    } catch (err) {
      console.error('Error updating client:', err);
      showAlert('Failed to update: ' + err.message, 'error');
    }
  };

  const handleViewConversations = async (client) => {
    try {
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
    }
  };

  const handleResetContext = (client) => {
    showConfirm(
      `HAPUS client ${client.nama || formatPhone(client.id)}?\n\n` +
      `⚠️ PERHATIAN: Ini akan MENGHAPUS PERMANENT:\n` +
      `• Semua conversation history\n` +
      `• Event details & pricing\n` +
      `• Meeting schedules\n` +
      `• User record dari database\n\n` +
      `❌ Row akan HILANG dari tabel!\n` +
      `❌ Tindakan ini TIDAK BISA dibatalkan!\n\n` +
      `Client harus didaftarkan ulang jika ingin chat lagi.`,
      async () => {
        // User confirmed - proceed with DELETE
        try {
          const result = await api.resetClientContext(client.id);

          // Immediately REMOVE the client from the table
          setClients(prevClients => prevClients.filter(c => c.id !== client.id));

          // Close modal if open
          if (selectedClient && selectedClient.id === client.id) {
            setSelectedClient(null);
            setConversations([]);
          }

          // Show success message
          showAlert(
            `✅ Client berhasil dihapus!\n\n` +
            `Client: ${result.clientName || 'N/A'}\n` +
            `Organisasi: ${result.clientOrg || 'N/A'}\n\n` +
            `Deleted:\n` +
            `✓ ${result.deletedConversations} conversations\n` +
            `✓ All client data\n` +
            `✓ User record\n\n` +
            `Row telah dihapus dari tabel!`,
            'success'
          );
        } catch (err) {
          console.error('Error deleting client:', err);
          showAlert('Failed to delete client: ' + err.message, 'error');
        }
      },
      () => {
        // User cancelled - do nothing
        console.log('Reset cancelled by user');
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
    if (!newClientPhone.trim()) {
      showAlert('Nomor WhatsApp harus diisi!', 'warning');
      return;
    }

    try {
      setAddingClient(true);
      await api.addToWhitelist({
        phoneNumber: newClientPhone,
        type: 'client',
        nama: newClientName || null
      });

      // Clear form
      setNewClientPhone('');
      setNewClientName('');

      // Refresh both clients and whitelist data
      await fetchClients();
      await fetchWhitelistData();

      showAlert('Client berhasil ditambahkan!\nBot sekarang akan merespon chat dari nomor ini.', 'success');
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
    }
  };

  if (loading) {
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
        <h1>NovAgent CRM Dashboard</h1>
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
          <button onClick={fetchClients} className="refresh-btn">
            Refresh
          </button>
        )}
      </header>

      {/* CRM TAB CONTENT */}
      {activeTab === 'crm' && (
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
                  >
                    {isWhitelisted ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="phone-cell">{formatPhone(client.id)}</td>
                <td>
                  <input
                    type="text"
                    value={client.nama || ''}
                    onChange={(e) => handleUpdate(client.id, 'nama', e.target.value)}
                    onBlur={(e) => handleUpdate(client.id, 'nama', e.target.value)}
                    placeholder="Nama"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={client.instansi || ''}
                    onChange={(e) => handleUpdate(client.id, 'instansi', e.target.value)}
                    onBlur={(e) => handleUpdate(client.id, 'instansi', e.target.value)}
                    placeholder="Instansi"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={client.event || ''}
                    onChange={(e) => handleUpdate(client.id, 'event', e.target.value)}
                    onBlur={(e) => handleUpdate(client.id, 'event', e.target.value)}
                    placeholder="Event"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={client.igLink || ''}
                    onChange={(e) => handleUpdate(client.id, 'igLink', e.target.value)}
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
                    >
                      Chat
                    </button>
                    <button
                      className="action-btn reset-btn"
                      onClick={() => handleResetContext(client)}
                      title="Reset conversation history & context"
                    >
                      Reset
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
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  onClick={handleGetContextSummary}
                  disabled={loadingSummary || conversations.length === 0}
                  className="context-summary-btn"
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loadingSummary || conversations.length === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    opacity: loadingSummary || conversations.length === 0 ? 0.6 : 1,
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  {loadingSummary ? 'Loading...' : 'Summary'}
                </button>
                <button onClick={() => setSelectedClient(null)}>×</button>
              </div>
            </div>

            {conversationSummary && (
              <div style={{
                position: 'absolute',
                top: '80px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '90%',
                maxWidth: '800px',
                maxHeight: '70vh',
                backgroundColor: '#f0f7ff',
                border: '2px solid #4CAF50',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                zIndex: 1000,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '15px 20px',
                  borderBottom: '2px solid #4CAF50',
                  backgroundColor: '#e3f2fd'
                }}>
                  <h3 style={{ margin: 0, color: '#2c5282', fontSize: '18px' }}>Conversation Summary</h3>
                  <button
                    onClick={() => setConversationSummary(null)}
                    style={{
                      background: '#f44336',
                      border: 'none',
                      fontSize: '16px',
                      cursor: 'pointer',
                      color: 'white',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold'
                    }}
                  >
                    ×
                  </button>
                </div>
                <div style={{
                  padding: '20px',
                  overflow: 'auto',
                  flex: 1,
                  whiteSpace: 'pre-wrap',
                  color: '#1a365d',
                  lineHeight: '1.6',
                  wordBreak: 'break-word'
                }}>
                  {conversationSummary.summary}
                </div>
                {conversationSummary.totalMessages && (
                  <div style={{
                    padding: '12px 20px',
                    fontSize: '12px',
                    color: '#718096',
                    borderTop: '1px solid #ccc',
                    backgroundColor: '#f0f7ff'
                  }}>
                    Total messages: {conversationSummary.totalMessages} |
                    Last updated: {new Date(conversationSummary.timestamp).toLocaleString('id-ID')}
                  </div>
                )}
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
      )}

      {/* WHITELIST TAB CONTENT */}
      {activeTab === 'whitelist' && (
        <WhitelistManager />
      )}

      {/* WHATSAPP TAB CONTENT */}
      {activeTab === 'whatsapp' && (
        <WhatsAppQR />
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
