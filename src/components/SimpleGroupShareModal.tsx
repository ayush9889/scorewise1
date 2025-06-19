import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Share2, MessageCircle, QrCode, Download } from 'lucide-react';
import { Group } from '../types/auth';
import { SimpleGroupShare } from '../services/simpleGroupShare';

interface SimpleGroupShareModalProps {
  group: Group;
  onClose: () => void;
}

export const SimpleGroupShareModal: React.FC<SimpleGroupShareModalProps> = ({ group, onClose }) => {
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loadingQR, setLoadingQR] = useState(false);

  const joinUrl = SimpleGroupShare.generateJoinURL(group);

  useEffect(() => {
    // Generate QR code on mount
    generateQRCode();
  }, [group]);

  const generateQRCode = async () => {
    setLoadingQR(true);
    try {
      const qrCodeDataUrl = await SimpleGroupShare.generateQRCode(group);
      setQrCode(qrCodeDataUrl);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
    } finally {
      setLoadingQR(false);
    }
  };

  const handleCopy = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(type);
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedItem(type);
      setTimeout(() => setCopiedItem(null), 2000);
    }
  };

  const handleWhatsAppShare = () => {
    SimpleGroupShare.shareToWhatsApp(group);
  };

  const downloadQRCode = () => {
    if (!qrCode) return;
    
    const link = document.createElement('a');
    link.download = `${group.name}-QR-Code.png`;
    link.href = qrCode;
    link.click();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Share Group</h2>
            <p className="text-sm text-gray-600">"{group.name}"</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Method 1: Join Link (Recommended) */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center mb-3">
              <Share2 className="w-5 h-5 text-blue-600 mr-2" />
              <h3 className="font-semibold text-blue-900">Join Link (Recommended)</h3>
            </div>
            <p className="text-sm text-blue-700 mb-3">
              One-click joining - just click the link!
            </p>
            
            <div className="bg-white rounded-lg p-3 border border-blue-200 mb-3">
              <p className="text-xs text-gray-600 mb-1">Join URL:</p>
              <p className="text-sm font-mono break-all text-gray-800">{joinUrl}</p>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => handleCopy(joinUrl, 'link')}
                className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                {copiedItem === 'link' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedItem === 'link' ? 'Copied!' : 'Copy Link'}</span>
              </button>
              
              <button
                onClick={handleWhatsAppShare}
                className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp</span>
              </button>
            </div>
          </div>

          {/* Method 2: Invite Code */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="flex items-center mb-3">
              <Copy className="w-5 h-5 text-gray-600 mr-2" />
              <h3 className="font-semibold text-gray-900">Invite Code</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Manual entry option for those who prefer typing
            </p>
            
            <div className="bg-white rounded-lg p-3 border border-gray-200 mb-3">
              <p className="text-xs text-gray-600 mb-1">Enter this code in the app:</p>
              <p className="text-2xl font-bold font-mono text-center text-gray-800 tracking-wider">
                {group.inviteCode}
              </p>
            </div>

            <button
              onClick={() => handleCopy(group.inviteCode, 'code')}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
            >
              {copiedItem === 'code' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedItem === 'code' ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>

          {/* Method 3: QR Code */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <div className="flex items-center mb-3">
              <QrCode className="w-5 h-5 text-purple-600 mr-2" />
              <h3 className="font-semibold text-purple-900">QR Code</h3>
            </div>
            <p className="text-sm text-purple-700 mb-3">
              Scan with any QR code scanner
            </p>

            <div className="flex flex-col items-center">
              {loadingQR ? (
                <div className="w-48 h-48 bg-white rounded-lg border border-purple-200 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
              ) : qrCode ? (
                <div className="bg-white p-4 rounded-lg border border-purple-200">
                  <img 
                    src={qrCode} 
                    alt="QR Code" 
                    className="w-40 h-40"
                  />
                </div>
              ) : (
                <div className="w-48 h-48 bg-white rounded-lg border border-purple-200 flex items-center justify-center">
                  <p className="text-sm text-gray-500">QR Code generation failed</p>
                </div>
              )}

              {qrCode && (
                <button
                  onClick={downloadQRCode}
                  className="mt-3 flex items-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Download QR</span>
                </button>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <h3 className="font-semibold text-green-900 mb-2">How to Join:</h3>
            <div className="text-sm text-green-700 space-y-1">
              <p>📱 <strong>Option 1:</strong> Click the join link above</p>
              <p>🔢 <strong>Option 2:</strong> Open the app and enter invite code: <strong>{group.inviteCode}</strong></p>
              <p>📷 <strong>Option 3:</strong> Scan the QR code with your camera</p>
            </div>
          </div>

          {/* Group Info */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Group Information:</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>Name:</strong> {group.name}</p>
              <p><strong>Members:</strong> {group.members?.length || 0}</p>
              <p><strong>Invite Code:</strong> {group.inviteCode}</p>
              <p><strong>Created:</strong> {new Date(group.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 