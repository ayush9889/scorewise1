import React, { useState, useEffect } from 'react';
import { Group } from '../types/auth';
import LinkJoinService from '../services/linkJoinService';
import { Share2, Copy, MessageSquare, QrCode, ExternalLink, Check, Download, Smartphone, Globe, Clock, Shield } from 'lucide-react';

interface GroupShareModalProps {
  group: Group;
  isOpen: boolean;
  onClose: () => void;
}

export const GroupShareModal: React.FC<GroupShareModalProps> = ({ group, isOpen, onClose }) => {
  const [joinLink, setJoinLink] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && group) {
      generateJoinAssets();
    }
  }, [isOpen, group]);

  const generateJoinAssets = async () => {
    setLoading(true);
    try {
      // Generate join link
      const link = LinkJoinService.generateJoinLink(group);
      setJoinLink(link);

      // Generate QR code
      const qrCode = await LinkJoinService.generateQRCode(link);
      setQrCodeUrl(qrCode);
    } catch (error) {
      console.error('Failed to generate join assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyJoinLink = async () => {
    try {
      await LinkJoinService.copyJoinLinkToClipboard(joinLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error('Failed to copy join link:', error);
    }
  };

  const copyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(group.inviteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (error) {
      console.error('Failed to copy invite code:', error);
    }
  };

  const shareToWhatsApp = () => {
    if (joinLink) {
      LinkJoinService.shareToWhatsApp(group, joinLink);
    }
  };

  const downloadQRCode = () => {
    if (qrCodeUrl) {
      const link = document.createElement('a');
      link.href = qrCodeUrl;
      link.download = `${group.name}-QR-Code.svg`;
      link.click();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Share Group</h2>
              <p className="text-gray-600 mt-1">Invite others to join "{group.name}"</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Method 1: Join Link (Recommended) */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-green-500 p-2 rounded-lg">
                <ExternalLink className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-green-800">Join Link</h3>
                <p className="text-green-600 text-sm">Recommended - One click to join!</p>
              </div>
            </div>

            {loading ? (
              <div className="animate-pulse bg-green-200 h-12 rounded-lg"></div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-4 border border-green-200">
                  <div className="flex items-center space-x-2">
                    <Globe className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-700 font-mono break-all">{joinLink}</span>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={copyJoinLink}
                    className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                  >
                    {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                  
                  <button
                    onClick={shareToWhatsApp}
                    className="flex-1 bg-green-500 text-white py-3 px-4 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center space-x-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </button>
                </div>

                <div className="bg-green-100 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <Shield className="w-5 h-5 text-green-600 mt-0.5" />
                    <div className="text-sm text-green-700">
                      <p className="font-medium mb-1">Why use join links?</p>
                      <ul className="text-xs space-y-1 list-disc list-inside">
                        <li>🔒 Secure and automatically expire in 24 hours</li>
                        <li>📱 One-click joining - no codes to type</li>
                        <li>🚀 Works on any device with internet</li>
                        <li>👥 Easier for non-tech-savvy members</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Method 2: QR Code */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-purple-500 p-2 rounded-lg">
                <QrCode className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-purple-800">QR Code</h3>
                <p className="text-purple-600 text-sm">Scan to join instantly</p>
              </div>
            </div>

            {loading ? (
              <div className="animate-pulse bg-purple-200 h-48 rounded-lg"></div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-6 border border-purple-200 flex justify-center">
                  {qrCodeUrl ? (
                    <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                  ) : (
                    <div className="w-48 h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                      <QrCode className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                </div>

                <button
                  onClick={downloadQRCode}
                  disabled={!qrCodeUrl}
                  className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download QR Code</span>
                </button>

                <div className="bg-purple-100 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <Smartphone className="w-5 h-5 text-purple-600 mt-0.5" />
                    <div className="text-sm text-purple-700">
                      <p className="font-medium mb-1">How to use QR code:</p>
                      <ul className="text-xs space-y-1 list-disc list-inside">
                        <li>📱 Open camera app on phone</li>
                        <li>📸 Point camera at QR code</li>
                        <li>🔗 Tap the notification that appears</li>
                        <li>🎉 Join the group instantly!</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Method 3: Traditional Invite Code (Fallback) */}
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-gray-500 p-2 rounded-lg">
                <Copy className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Invite Code</h3>
                <p className="text-gray-600 text-sm">Traditional method (if links don't work)</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-mono font-bold text-gray-800 tracking-wider">{group.inviteCode}</span>
                  <button
                    onClick={copyInviteCode}
                    className="p-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="bg-yellow-100 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Clock className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-700">
                    <p className="font-medium mb-1">Manual joining instructions:</p>
                    <ul className="text-xs space-y-1 list-disc list-inside">
                      <li>Go to "Join Group" in the app</li>
                      <li>Enter this 6-character code</li>
                      <li>Make sure to type it exactly as shown</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-800 mb-3">💡 Pro Tips</h3>
            <div className="space-y-2 text-sm text-blue-700">
              <p>• <strong>Join links are the easiest</strong> - just click and join!</p>
              <p>• <strong>QR codes work great</strong> for in-person sharing</p>
              <p>• <strong>Share via WhatsApp</strong> for instant group invites</p>
              <p>• <strong>Links expire in 24 hours</strong> for security</p>
              <p>• <strong>Members can join instantly</strong> - no approval needed</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupShareModal; 