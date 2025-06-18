import React from 'react';
import { Match, Player } from '../types/cricket';
import { X, Share2, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ScorecardModalProps {
  match: Match;
  onClose: () => void;
}

export const ScorecardModal: React.FC<ScorecardModalProps> = ({ match, onClose }) => {
  const handleShare = async () => {
    const scorecardText = generateScorecardText();
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Match Scorecard',
          text: scorecardText
        });
      } catch (err) {
        console.error('Error sharing:', err);
        // Fallback to clipboard
        navigator.clipboard.writeText(scorecardText);
        alert('Scorecard copied to clipboard!');
      }
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(scorecardText);
      alert('Scorecard copied to clipboard!');
    }
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.text('Match Scorecard', 14, 15);
    
    // Add match summary
    doc.setFontSize(12);
    doc.text(`${match.battingTeam.name} vs ${match.bowlingTeam.name}`, 14, 25);
    doc.text(`Date: ${new Date(match.date).toLocaleDateString()}`, 14, 32);
    doc.text(`Venue: ${match.venue}`, 14, 39);
    
    // Add batting scorecard
    doc.text('Batting Scorecard', 14, 50);
    const battingTable = match.battingTeam.players.map(player => {
      const balls = match.balls.filter(b => b.striker.id === player.id).length;
      const runs = match.balls
        .filter(b => b.striker.id === player.id)
        .reduce((sum, b) => sum + b.runs, 0);
      const fours = match.balls.filter(b => b.striker.id === player.id && b.runs === 4).length;
      const sixes = match.balls.filter(b => b.striker.id === player.id && b.runs === 6).length;
      return [
        player.name,
        runs.toString(),
        balls.toString(),
        fours.toString(),
        sixes.toString(),
        ((runs / balls) * 100).toFixed(2)
      ];
    });
    
    autoTable(doc, {
      startY: 55,
      head: [['Batsman', 'R', 'B', '4s', '6s', 'SR']],
      body: battingTable,
      theme: 'grid'
    });
    
    // Add bowling scorecard
    const lastY = (doc as any).lastAutoTable.finalY + 10;
    doc.text('Bowling Scorecard', 14, lastY);
    
    const bowlingTable = match.bowlingTeam.players.map(player => {
      const balls = match.balls.filter(b => b.bowler.id === player.id).length;
      const runs = match.balls
        .filter(b => b.bowler.id === player.id)
        .reduce((sum, b) => sum + b.runs, 0);
      const wickets = match.balls.filter(b => b.bowler.id === player.id && b.isWicket).length;
      return [
        player.name,
        `${Math.floor(balls / 6)}.${balls % 6}`,
        runs.toString(),
        wickets.toString(),
        (runs / (balls / 6)).toFixed(2)
      ];
    });
    
    autoTable(doc, {
      startY: lastY + 5,
      head: [['Bowler', 'O', 'R', 'W', 'Econ']],
      body: bowlingTable,
      theme: 'grid'
    });
    
    // Add extras
    const extrasY = (doc as any).lastAutoTable.finalY + 10;
    doc.text('Extras', 14, extrasY);
    doc.text(`Wides: ${match.battingTeam.extras.wides}`, 14, extrasY + 7);
    doc.text(`No Balls: ${match.battingTeam.extras.noBalls}`, 14, extrasY + 14);
    doc.text(`Byes: ${match.battingTeam.extras.byes}`, 14, extrasY + 21);
    doc.text(`Leg Byes: ${match.battingTeam.extras.legByes}`, 14, extrasY + 28);
    
    // Add Man of the Match if selected
    if (match.manOfTheMatch) {
      const motmY = extrasY + 35;
      doc.text(`Man of the Match: ${match.manOfTheMatch.name}`, 14, motmY);
    }
    
    // Save the PDF
    doc.save('match-scorecard.pdf');
  };

  const generateScorecardText = () => {
    let text = `Match Scorecard\n\n`;
    text += `${match.battingTeam.name} vs ${match.bowlingTeam.name}\n`;
    text += `Date: ${new Date(match.date).toLocaleDateString()}\n`;
    text += `Venue: ${match.venue}\n\n`;

    // Batting Scorecard
    text += 'Batting Scorecard\n';
    text += 'Batsman\tR\tB\t4s\t6s\tSR\n';
    match.battingTeam.players.forEach(player => {
      const balls = match.balls.filter(b => b.striker.id === player.id).length;
      const runs = match.balls
        .filter(b => b.striker.id === player.id)
        .reduce((sum, b) => sum + b.runs, 0);
      const fours = match.balls.filter(b => b.striker.id === player.id && b.runs === 4).length;
      const sixes = match.balls.filter(b => b.striker.id === player.id && b.runs === 6).length;
      const strikeRate = ((runs / balls) * 100).toFixed(2);
      text += `${player.name}\t${runs}\t${balls}\t${fours}\t${sixes}\t${strikeRate}\n`;
    });

    // Bowling Scorecard
    text += '\nBowling Scorecard\n';
    text += 'Bowler\tO\tR\tW\tEcon\n';
    match.bowlingTeam.players.forEach(player => {
      const balls = match.balls.filter(b => b.bowler.id === player.id).length;
      const runs = match.balls
        .filter(b => b.bowler.id === player.id)
        .reduce((sum, b) => sum + b.runs, 0);
      const wickets = match.balls.filter(b => b.bowler.id === player.id && b.isWicket).length;
      const economy = (runs / (balls / 6)).toFixed(2);
      text += `${player.name}\t${Math.floor(balls / 6)}.${balls % 6}\t${runs}\t${wickets}\t${economy}\n`;
    });

    // Extras
    text += '\nExtras\n';
    text += `Wides: ${match.battingTeam.extras.wides}\n`;
    text += `No Balls: ${match.battingTeam.extras.noBalls}\n`;
    text += `Byes: ${match.battingTeam.extras.byes}\n`;
    text += `Leg Byes: ${match.battingTeam.extras.legByes}\n`;

    // Man of the Match
    if (match.manOfTheMatch) {
      text += `\nMan of the Match: ${match.manOfTheMatch.name}\n`;
    }

    return text;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Match Scorecard</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleShare}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Share Scorecard"
            >
              <Share2 className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={handleDownloadPDF}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Download PDF"
            >
              <Download className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-4rem)]">
          {/* Match Summary */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Match Summary</h3>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-gray-600">{match.battingTeam.name} vs {match.bowlingTeam.name}</p>
              <p className="text-gray-600">Date: {new Date(match.date).toLocaleDateString()}</p>
              <p className="text-gray-600">Venue: {match.venue}</p>
            </div>
          </div>

          {/* Batting Scorecard */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Batting Scorecard</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left">Batsman</th>
                    <th className="px-4 py-2 text-center">R</th>
                    <th className="px-4 py-2 text-center">B</th>
                    <th className="px-4 py-2 text-center">4s</th>
                    <th className="px-4 py-2 text-center">6s</th>
                    <th className="px-4 py-2 text-center">SR</th>
                  </tr>
                </thead>
                <tbody>
                  {match.battingTeam.players.map(player => {
                    const balls = match.balls.filter(b => b.striker.id === player.id).length;
                    const runs = match.balls
                      .filter(b => b.striker.id === player.id)
                      .reduce((sum, b) => sum + b.runs, 0);
                    const fours = match.balls.filter(b => b.striker.id === player.id && b.runs === 4).length;
                    const sixes = match.balls.filter(b => b.striker.id === player.id && b.runs === 6).length;
                    const strikeRate = ((runs / balls) * 100).toFixed(2);
                    return (
                      <tr key={player.id} className="border-t border-gray-200">
                        <td className="px-4 py-2">{player.name}</td>
                        <td className="px-4 py-2 text-center">{runs}</td>
                        <td className="px-4 py-2 text-center">{balls}</td>
                        <td className="px-4 py-2 text-center">{fours}</td>
                        <td className="px-4 py-2 text-center">{sixes}</td>
                        <td className="px-4 py-2 text-center">{strikeRate}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bowling Scorecard */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Bowling Scorecard</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left">Bowler</th>
                    <th className="px-4 py-2 text-center">O</th>
                    <th className="px-4 py-2 text-center">R</th>
                    <th className="px-4 py-2 text-center">W</th>
                    <th className="px-4 py-2 text-center">Econ</th>
                  </tr>
                </thead>
                <tbody>
                  {match.bowlingTeam.players.map(player => {
                    const balls = match.balls.filter(b => b.bowler.id === player.id).length;
                    const runs = match.balls
                      .filter(b => b.bowler.id === player.id)
                      .reduce((sum, b) => sum + b.runs, 0);
                    const wickets = match.balls.filter(b => b.bowler.id === player.id && b.isWicket).length;
                    const economy = (runs / (balls / 6)).toFixed(2);
                    return (
                      <tr key={player.id} className="border-t border-gray-200">
                        <td className="px-4 py-2">{player.name}</td>
                        <td className="px-4 py-2 text-center">{Math.floor(balls / 6)}.{balls % 6}</td>
                        <td className="px-4 py-2 text-center">{runs}</td>
                        <td className="px-4 py-2 text-center">{wickets}</td>
                        <td className="px-4 py-2 text-center">{economy}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Extras */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Extras</h3>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-gray-600">Wides: {match.battingTeam.extras.wides}</p>
              <p className="text-gray-600">No Balls: {match.battingTeam.extras.noBalls}</p>
              <p className="text-gray-600">Byes: {match.battingTeam.extras.byes}</p>
              <p className="text-gray-600">Leg Byes: {match.battingTeam.extras.legByes}</p>
            </div>
          </div>

          {/* Man of the Match */}
          {match.manOfTheMatch && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Man of the Match</h3>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-gray-600">{match.manOfTheMatch.name}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 