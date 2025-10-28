import { useState, useEffect } from 'react';
import api from '../services/api';
import WhitelistManager from './WhitelistManager';
import './Dashboard.css';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('crm'); // 'crm' or 'whitelist'
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Add client state
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [addingClient, setAddingClient] = useState(false);
  const [whitelistData, setWhitelistData] = useState({});

  useEffect(() => {
    fetchClients();
    fetchWhitelistData();
  }, []);

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
      alert('Failed to update: ' + err.message);
    }
  };

  const handleViewConversations = async (client) => {
    try {
      setSelectedClient(client);
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
      alert('Failed to fetch conversations: ' + err.message);
    }
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
      alert('Message sent successfully!');
    } catch (err) {
      console.error('Error sending message:', err);
      alert('Failed to send message: ' + err.message);
    } finally {
      setSending(false);
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
      alert('Nomor WhatsApp harus diisi!');
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

      alert('✅ Client berhasil ditambahkan!\nBot sekarang akan merespon chat dari nomor ini.');
    } catch (err) {
      console.error('Error adding client:', err);
      alert('❌ Gagal menambah client: ' + err.message);
    } finally {
      setAddingClient(false);
    }
  };

  const handleToggleWhitelist = async (phoneNumber, currentStatus) => {
    const action = currentStatus ? 'hapus dari' : 'tambahkan ke';
    const actionIng = currentStatus ? 'menghapus' : 'menambahkan';

    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} whitelist untuk ${phoneNumber.replace('@c.us', '')}?\n\nBot ${currentStatus ? 'tidak akan' : 'akan'} merespon chat dari nomor ini.`)) {
      return;
    }

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
      alert(`✅ Berhasil ${actionIng} whitelist!`);
    } catch (err) {
      console.error(`Error ${actionIng} whitelist:`, err);
      alert(`❌ Gagal ${actionIng} whitelist: ` + err.message);
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
            📊 CRM
          </button>
          <button
            onClick={() => setActiveTab('whitelist')}
            className={`tab-btn ${activeTab === 'whitelist' ? 'active' : ''}`}
          >
            📋 Whitelist
          </button>
        </div>
        {activeTab === 'crm' && (
          <button onClick={fetchClients} className="refresh-btn">
            🔄 Refresh
          </button>
        )}
      </header>

      {/* CRM TAB CONTENT */}
      {activeTab === 'crm' && (
        <>
          {/* Add Client Section */}
          <div className="add-client-section">
            <h3>➕ Tambah Client Baru</h3>
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
                  {addingClient ? '⏳ Menambah...' : '✅ Tambah Client'}
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
                    {isWhitelisted ? '✅ Active' : '❌ Inactive'}
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
                  <button
                    className="action-btn"
                    onClick={() => handleViewConversations(client)}
                  >
                    💬 Chat
                  </button>
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
              <button onClick={() => setSelectedClient(null)}>✕</button>
            </div>

            <div className="chat-history-container">
              {conversations.length === 0 ? (
                <div className="no-messages-placeholder">
                  <div className="no-messages-icon">💬</div>
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
                  {sending ? 'Sending...' : '📤 Send Message'}
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
    </div>
  );
}
