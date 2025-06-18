import React, { useState } from 'react';
import { User, Camera, X, Plus } from 'lucide-react';
import { Player } from '../types/cricket';
import { storageService } from '../services/storage';

interface AddPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayerAdded: (player: Player) => void;
  groupId?: string;
}

export const AddPlayerModal: React.FC<AddPlayerModalProps> = ({
  isOpen,
  onClose,
  onPlayerAdded,
  groupId
}) => {
  const [name, setName] = useState('');
  const [shortId, setShortId] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError('');

    try {
      const player: Player = {
        id: `${isGuest ? 'guest' : 'player'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: name.trim(),
        shortId: shortId.trim() || undefined,
        photoUrl: photoUrl || undefined,
        isGroupMember: !!groupId && !isGuest,
        isGuest: isGuest,
        groupIds: groupId && !isGuest ? [groupId] : undefined,
        stats: {
          matchesPlayed: 0,
          runsScored: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          fifties: 0,
          hundreds: 0,
          highestScore: 0,
          timesOut: 0,
          wicketsTaken: 0,
          ballsBowled: 0,
          runsConceded: 0,
          catches: 0,
          runOuts: 0,
          motmAwards: 0,
          ducks: 0,
          dotBalls: 0,
          maidenOvers: 0,
          bestBowlingFigures: '0/0'
        }
      };

      // Immediately call the callback and close modal
      onPlayerAdded(player);
      
      // Reset form immediately
      setName('');
      setShortId('');
      setPhotoUrl('');
      setIsGuest(false);
      setLoading(false);
      onClose();
      
      // Save to storage in the background (non-blocking)
      storageService.savePlayer(player).catch((err) => {
        console.error('Background save failed for player:', err);
        // Player is already added via callback, so this failure won't affect the UI
      });
      
    } catch (err) {
      setError('Failed to add player. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-6 text-white rounded-t-2xl">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Add Player</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Player Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Player Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsGuest(false)}
                className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                  !isGuest
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <User className="w-5 h-5" />
                  <span className="font-medium">Group Member</span>
                </div>
                <p className="text-sm opacity-75 mt-1">Full player with stats tracking</p>
              </button>
              
              <button
                type="button"
                onClick={() => setIsGuest(true)}
                className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                  isGuest
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Plus className="w-5 h-5" />
                  <span className="font-medium">Guest Player</span>
                </div>
                <p className="text-sm opacity-75 mt-1">Quick add for this match</p>
              </button>
            </div>
          </div>

          {/* Player Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Player Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Enter player name"
              required
            />
          </div>

          {/* Short ID (only for group members) */}
          {!isGuest && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Short ID (Optional)
              </label>
              <input
                type="text"
                value={shortId}
                onChange={(e) => setShortId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="e.g., JDOE, MSD"
                maxLength={10}
              />
            </div>
          )}

          {/* Photo Upload (only for group members) */}
          {!isGuest && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Profile Photo (Optional)
              </label>
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                    {photoUrl ? (
                      <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <label className="absolute -bottom-1 -right-1 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-purple-700 transition-colors">
                    <Camera className="w-3 h-3 text-white" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500">
                    Click the camera icon to upload a profile photo
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className={`w-full py-4 rounded-xl font-semibold transition-all duration-300 ${
              loading || !name.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : isGuest
                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'bg-purple-500 hover:bg-purple-600 text-white'
            }`}
          >
            {loading ? 'Adding...' : `Add ${isGuest ? 'Guest' : 'Group'} Player`}
          </button>
        </form>
      </div>
    </div>
  );
};