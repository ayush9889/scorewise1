import React from 'react';
import { Trophy, Target, Clock, TrendingUp, Play } from 'lucide-react';
import { Match } from '../types/cricket';
import { motion } from 'framer-motion';

interface InningsBreakModalProps {
  match: Match;
  onContinue: () => void;
}

export const InningsBreakModal: React.FC<InningsBreakModalProps> = ({ match, onContinue }) => {
  const firstInningsTeam = match.isSecondInnings ? match.bowlingTeam : match.battingTeam;
  const target = firstInningsTeam.score + 1;
  const runRate = ((firstInningsTeam.score / ((firstInningsTeam.overs * 6) + firstInningsTeam.balls)) * 6).toFixed(2);
  const requiredRunRate = (target / match.totalOvers).toFixed(2);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-white rounded-2xl w-full max-w-sm shadow-2xl"
      >
        {/* Compact Header */}
        <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white p-4 rounded-t-2xl text-center">
          <Trophy className="w-8 h-8 mx-auto mb-2" />
          <h2 className="text-lg font-bold">Innings Break</h2>
          <p className="text-green-100 text-sm">First innings completed!</p>
        </div>

        {/* Compact Summary */}
        <div className="p-4 space-y-4">
          {/* First Innings Score */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-center">
              <div className="text-sm font-medium text-gray-600">{firstInningsTeam.name}</div>
              <div className="text-2xl font-bold text-green-600 my-1">
                {firstInningsTeam.score}/{firstInningsTeam.wickets}
              </div>
              <div className="text-xs text-gray-500">
                {firstInningsTeam.overs}.{firstInningsTeam.balls} overs • RR: {runRate}
              </div>
            </div>
          </div>

          {/* Target Information */}
          <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-3 border border-orange-200">
            <div className="text-center">
              <Target className="w-6 h-6 text-orange-600 mx-auto mb-1" />
              <div className="text-sm font-medium text-orange-800 mb-1">
                Target for {match.isSecondInnings ? match.battingTeam.name : match.bowlingTeam.name}
              </div>
              <div className="text-3xl font-bold text-orange-600 mb-1">{target}</div>
              <div className="text-xs text-orange-700">runs to win</div>
            </div>
          </div>

          {/* Match Details */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-blue-50 rounded-lg p-2 text-center">
              <Clock className="w-4 h-4 text-blue-500 mx-auto mb-1" />
              <div className="font-bold text-blue-700">{match.totalOvers}</div>
              <div className="text-blue-600">Total Overs</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-2 text-center">
              <TrendingUp className="w-4 h-4 text-purple-500 mx-auto mb-1" />
              <div className="font-bold text-purple-700">{requiredRunRate}</div>
              <div className="text-purple-600">Required RR</div>
            </div>
          </div>

          {/* Continue Button */}
          <button
            onClick={onContinue}
            className="w-full bg-gradient-to-r from-green-500 to-blue-500 text-white py-3 px-4 rounded-lg font-semibold hover:from-green-600 hover:to-blue-600 transition-all duration-200 shadow-lg flex items-center justify-center"
          >
            <Play className="w-4 h-4 mr-2" />
            Start Second Innings
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};