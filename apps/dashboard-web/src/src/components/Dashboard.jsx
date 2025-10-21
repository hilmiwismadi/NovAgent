import { useState, useEffect } from 'react';
import api from '../services/api';
import './Dashboard.css';

export default function Dashboard() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchClients();
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
        <button onClick={fetchClients} className="refresh-btn">
          🔄 Refresh
        </button>
      </header>

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
            {clients.map((client, index) => (
              <tr key={client.id}>
                <td>{index + 1}</td>
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
            ))}
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

            <div className="conversations-container">
              {conversations.length === 0 ? (
                <p className="no-messages">No conversation history</p>
              ) : (
                conversations.map((conv) => (
                  <div key={conv.id} className="conversation">
                    <div className="message user-message">
                      <strong>User:</strong> {conv.userMessage}
                    </div>
                    <div className="message agent-message">
                      <strong>NovaBot:</strong> {conv.agentResponse}
                    </div>
                    <div className="timestamp">{new Date(conv.timestamp).toLocaleString('id-ID')}</div>
                  </div>
                ))
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
    </div>
  );
}
