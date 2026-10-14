import React, { useState, useEffect, useRef } from 'react';
import { Context } from '@/context';

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: number;
  type: 'user' | 'system' | 'win' | 'bet';
}

const ChatSystem: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const context = React.useContext(Context);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Add welcome message
    const welcomeMessage: ChatMessage = {
      id: 'welcome',
      username: 'System',
      message: 'Welcome to Aviator Chat! 🎮',
      timestamp: Date.now(),
      type: 'system'
    };
    setMessages([welcomeMessage]);

    // Simulate some demo messages
    const demoMessages: ChatMessage[] = [
      {
        id: '1',
        username: 'Player1',
        message: 'Good luck everyone! 🍀',
        timestamp: Date.now() - 300000,
        type: 'user'
      },
      {
        id: '2',
        username: 'HighRoller',
        message: 'Just won 15.6x! 🚀',
        timestamp: Date.now() - 200000,
        type: 'win'
      },
      {
        id: '3',
        username: 'Player2',
        message: 'Betting big this round 💰',
        timestamp: Date.now() - 100000,
        type: 'bet'
      }
    ];

    setTimeout(() => {
      setMessages(prev => [...prev, ...demoMessages]);
      setIsConnected(true);
    }, 1000);

    // Listen for game events to create automatic messages
    if (context?.socket) {
      context.socket.on('betPlaced', (data: any) => {
        const betMessage: ChatMessage = {
          id: `bet_${Date.now()}`,
          username: data.username || 'Player',
          message: `Placed bet: ₹${data.amount}`,
          timestamp: Date.now(),
          type: 'bet'
        };
        setMessages(prev => [...prev, betMessage]);
      });

      context.socket.on('betCashedOut', (data: any) => {
        const winMessage: ChatMessage = {
          id: `win_${Date.now()}`,
          username: data.username || 'Player',
          message: `Cashed out at ${data.cashOutAt}x for ₹${data.payout}! 🎉`,
          timestamp: Date.now(),
          type: 'win'
        };
        setMessages(prev => [...prev, winMessage]);
      });

      return () => {
        context.socket.off('betPlaced');
        context.socket.off('betCashedOut');
      };
    }
  }, [context?.socket]);

  const sendMessage = () => {
    if (!inputMessage.trim()) return;

    const newMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      username: context?.userInfo?.userName || 'You',
      message: inputMessage.trim(),
      timestamp: Date.now(),
      type: 'user'
    };

    setMessages(prev => [...prev, newMessage]);
    setInputMessage('');

    // In a real implementation, emit this to the server
    // context?.socket?.emit('chatMessage', newMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getMessageStyle = (type: string) => {
    switch (type) {
      case 'system':
        return { color: '#ffd700', fontStyle: 'italic' };
      case 'win':
        return { color: '#00ff00', fontWeight: 'bold' };
      case 'bet':
        return { color: '#ff8800' };
      default:
        return { color: '#ffffff' };
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h4>Live Chat</h4>
        <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          <div className="status-dot"></div>
          {isConnected ? 'Online' : 'Connecting...'}
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className="message">
            <span className="timestamp">{formatTime(msg.timestamp)}</span>
            <span className="username" style={getMessageStyle(msg.type)}>
              {msg.username}:
            </span>
            <span className="message-text" style={getMessageStyle(msg.type)}>
              {msg.message}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          maxLength={200}
          disabled={!isConnected}
        />
        <button 
          onClick={sendMessage} 
          disabled={!inputMessage.trim() || !isConnected}
        >
          Send
        </button>
      </div>

      <style jsx>{`
        .chat-container {
          background: rgba(0, 0, 0, 0.9);
          border-radius: 8px;
          padding: 16px;
          margin: 16px;
          height: 400px;
          display: flex;
          flex-direction: column;
          font-family: Arial, sans-serif;
        }

        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #333;
        }

        .chat-header h4 {
          margin: 0;
          color: white;
          font-size: 16px;
        }

        .connection-status {
          display: flex;
          align-items: center;
          font-size: 12px;
          gap: 6px;
        }

        .connection-status.connected {
          color: #00ff00;
        }

        .connection-status.disconnected {
          color: #ff4444;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: currentColor;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 8px 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .message {
          display: flex;
          gap: 8px;
          font-size: 13px;
          line-height: 1.4;
          word-wrap: break-word;
        }

        .timestamp {
          color: #888;
          font-size: 11px;
          min-width: 35px;
        }

        .username {
          font-weight: bold;
          min-width: 60px;
        }

        .message-text {
          flex: 1;
        }

        .chat-input {
          display: flex;
          gap: 8px;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid #333;
        }

        .chat-input input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #555;
          border-radius: 4px;
          background: #222;
          color: white;
          font-size: 13px;
        }

        .chat-input input:focus {
          outline: none;
          border-color: #f39c12;
        }

        .chat-input input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .chat-input button {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          background: #f39c12;
          color: white;
          cursor: pointer;
          font-size: 13px;
          font-weight: bold;
        }

        .chat-input button:hover:not(:disabled) {
          background: #e67e22;
        }

        .chat-input button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .chat-messages::-webkit-scrollbar {
          width: 4px;
        }

        .chat-messages::-webkit-scrollbar-track {
          background: #333;
        }

        .chat-messages::-webkit-scrollbar-thumb {
          background: #666;
          border-radius: 2px;
        }

        @media (max-width: 768px) {
          .chat-container {
            height: 300px;
            margin: 8px;
            padding: 12px;
          }

          .message {
            font-size: 12px;
          }

          .chat-input input, .chat-input button {
            font-size: 12px;
            padding: 6px 10px;
          }
        }
      `}</style>
    </div>
  );
};

export default ChatSystem;
