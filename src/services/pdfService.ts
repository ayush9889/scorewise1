import { Match } from '../types/cricket';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export class PDFService {
  static async generateDetailedScorecard(match: Match): Promise<Blob> {
    const doc = new jsPDF();
    
    // Header: Match result and title
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text(`${match.team1.name} v/s ${match.team2.name}`, 14, 15);
    doc.setFontSize(14);
    doc.text(`${match.winner ? match.winner + ' won by ' + match.resultMargin : 'Match Drawn'}.`, 14, 25);
    let y = 35;

    // --- First Innings ---
    doc.setFillColor(34, 139, 34);
    doc.setTextColor(255, 255, 255);
    doc.rect(14, y, 180, 8, 'F');
    doc.text(match.team1.name, 16, y + 6);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text(`${match.team1.score}-${match.team1.wickets} (${match.team1.overs}.${match.team1.balls})`, 160, y + 6, { align: 'right' });
    y += 12;

    // Batting Table
    const firstBattingRows = match.team1.players.map(player => {
      const stats = this.calculateBattingStats(match, [player])[0];
      return {
        player,
        stats
      };
    }).filter(row => row.stats.balls > 0).map(row => [
      this.getDismissalInfo(match, row.player),
      row.stats.runs.toString(),
      row.stats.balls.toString(),
      row.stats.fours.toString(),
      row.stats.sixes.toString(),
      row.stats.strikeRate,
    ]);
    autoTable(doc, {
      startY: y,
      head: [['Batsman', 'R', 'B', '4s', '6s', 'SR']],
      body: firstBattingRows,
      theme: 'grid',
      headStyles: { fillColor: [34, 139, 34] },
    });
    y = (doc as any).lastAutoTable.finalY + 2;

    // Extras line
    doc.setFontSize(10);
    doc.text(`Extras: (B ${match.team1.extras.byes}, LB ${match.team1.extras.legByes}, WD ${match.team1.extras.wides}, NB ${match.team1.extras.noBalls}, 0 P)`, 16, y + 6);
    y += 10;

    // Total line
    doc.setFontSize(11);
    doc.text(`Total: ${match.team1.score}-${match.team1.wickets} (${match.team1.overs}.${match.team1.balls}) RR: ${((match.team1.score / (match.team1.overs + match.team1.balls / 6)) || 0).toFixed(2)}`, 16, y + 6);
    y += 10;

    // Fall of wickets
    doc.setFontSize(10);
    doc.text('Fall of wickets', 16, y + 6);
    let fallY = y + 12;
    (match.team1.fallOfWickets || []).forEach(fall => {
      doc.text(`${fall.batsman}: ${fall.score} (${fall.over})`, 18, fallY);
      fallY += 6;
    });
    y = fallY + 2;

    // Bowling Table
    const firstBowlingRows = match.team2.players.map(player => {
      const stats = this.calculateBowlingStats(match, [player])[0];
      return {
        player,
        stats
      };
    }).filter(row => parseFloat(row.stats.overs) > 0).map(row => [
      row.player.name,
      row.stats.overs,
      row.stats.maidens || '0',
      row.stats.runs.toString(),
      row.stats.wickets.toString(),
      row.stats.economy,
      row.stats.wides.toString(),
      row.stats.noBalls.toString(),
    ]);
    autoTable(doc, {
      startY: y,
      head: [['Bowler', 'O', 'M', 'R', 'W', 'ER', 'WD', 'NB']],
      body: firstBowlingRows,
      theme: 'grid',
      headStyles: { fillColor: [34, 139, 34] },
    });
    y = (doc as any).lastAutoTable.finalY + 2;

    // --- Second Innings ---
    doc.setFillColor(34, 139, 34);
    doc.setTextColor(255, 255, 255);
    doc.rect(14, y, 180, 8, 'F');
    doc.text(match.team2.name, 16, y + 6);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text(`${match.team2.score}-${match.team2.wickets} (${match.team2.overs}.${match.team2.balls})`, 160, y + 6, { align: 'right' });
    y += 12;

    // Batting Table
    const secondBattingRows = match.team2.players.map(player => {
      const stats = this.calculateBattingStats(match, [player])[0];
      return {
        player,
        stats
      };
    }).filter(row => row.stats.balls > 0).map(row => [
      this.getDismissalInfo(match, row.player),
      row.stats.runs.toString(),
      row.stats.balls.toString(),
      row.stats.fours.toString(),
      row.stats.sixes.toString(),
      row.stats.strikeRate,
    ]);
    autoTable(doc, {
      startY: y,
      head: [['Batsman', 'R', 'B', '4s', '6s', 'SR']],
      body: secondBattingRows,
      theme: 'grid',
      headStyles: { fillColor: [34, 139, 34] },
    });
    y = (doc as any).lastAutoTable.finalY + 2;

    // Extras line
    doc.setFontSize(10);
    doc.text(`Extras: (B ${match.team2.extras.byes}, LB ${match.team2.extras.legByes}, WD ${match.team2.extras.wides}, NB ${match.team2.extras.noBalls}, 0 P)`, 16, y + 6);
    y += 10;

    // Total line
    doc.setFontSize(11);
    doc.text(`Total: ${match.team2.score}-${match.team2.wickets} (${match.team2.overs}.${match.team2.balls}) RR: ${((match.team2.score / (match.team2.overs + match.team2.balls / 6)) || 0).toFixed(2)}`, 16, y + 6);
    y += 10;

    // Fall of wickets
    doc.setFontSize(10);
    doc.text('Fall of wickets', 16, y + 6);
    fallY = y + 12;
    (match.team2.fallOfWickets || []).forEach(fall => {
      doc.text(`${fall.batsman}: ${fall.score} (${fall.over})`, 18, fallY);
      fallY += 6;
    });
    y = fallY + 2;

    // Bowling Table
    const secondBowlingRows = match.team1.players.map(player => {
      const stats = this.calculateBowlingStats(match, [player])[0];
      return {
        player,
        stats
      };
    }).filter(row => parseFloat(row.stats.overs) > 0).map(row => [
      row.player.name,
      row.stats.overs,
      row.stats.maidens || '0',
      row.stats.runs.toString(),
      row.stats.wickets.toString(),
      row.stats.economy,
      row.stats.wides.toString(),
      row.stats.noBalls.toString(),
    ]);
    autoTable(doc, {
      startY: y,
      head: [['Bowler', 'O', 'M', 'R', 'W', 'ER', 'WD', 'NB']],
      body: secondBowlingRows,
      theme: 'grid',
      headStyles: { fillColor: [34, 139, 34] },
    });
    y = (doc as any).lastAutoTable.finalY + 2;

    // Man of the Match
    if (match.manOfTheMatch) {
      doc.setFontSize(12);
      doc.setTextColor(245, 158, 11);
      doc.text(`Man of the Match: ${match.manOfTheMatch.name}`, 16, y + 8);
      doc.setTextColor(0, 0, 0);
      y += 12;
    }

    // Footer
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Generated by ScoreWise Cricket Scorer', 14, doc.internal.pageSize.height - 10);
    return doc.output('blob');
  }

  private static calculateBattingStats(match: Match, players: any[]): any[] {
    const stats = [];
    
    for (const player of players) {
      const battingBalls = match.balls.filter(b => b.striker.id === player.id);
      let runs = 0;
      let balls = 0;
      let fours = 0;
      let sixes = 0;
      let gotOut = false;

      battingBalls.forEach(ball => {
        if (!ball.isWide && !ball.isNoBall && !ball.isBye && !ball.isLegBye) {
          runs += ball.runs;
        }
        if (!ball.isWide && !ball.isNoBall) {
          balls++;
        }
        if (ball.runs === 4) fours++;
        if (ball.runs === 6) sixes++;
        if (ball.isWicket && ball.striker.id === player.id) gotOut = true;
      });

      const strikeRate = balls > 0 ? ((runs / balls) * 100).toFixed(1) : '0.0';

      stats.push({
        player: player.name,
        runs,
        balls,
        fours,
        sixes,
        gotOut,
        strikeRate
      });
    }

    return stats;
  }

  private static calculateBowlingStats(match: Match, players: any[]): any[] {
    const stats = [];
    
    for (const player of players) {
      const bowlingBalls = match.balls.filter(b => b.bowler.id === player.id);
      let wickets = 0;
      let runs = 0;
      let balls = 0;
      let wides = 0;
      let noBalls = 0;

      bowlingBalls.forEach(ball => {
        if (!ball.isWide && !ball.isNoBall) {
          balls++;
        }
        if (ball.isWicket && ball.wicketType !== 'run_out') {
          wickets++;
        }
        runs += ball.runs;
        if (ball.isWide) wides++;
        if (ball.isNoBall) noBalls++;
      });

      const overs = Math.floor(balls / 6) + (balls % 6) / 10;
      const economy = overs > 0 ? (runs / overs).toFixed(2) : '0.00';

      stats.push({
        player: player.name,
        overs: overs.toFixed(1),
        wickets,
        runs,
        economy,
        wides,
        noBalls
      });
    }

    return stats;
  }

  static async generateScoreboardPDF(match: Match): Promise<Blob> {
    // Create a canvas to draw the scoreboard
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    // Set canvas size for PDF
    canvas.width = 800;
    canvas.height = 1200;

    // Set background
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('ScoreWise - Match Scoreboard', canvas.width / 2, 50);

    // Match details
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`${match.team1.name} vs ${match.team2.name}`, canvas.width / 2, 100);

    // Match result
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#10b981';
    ctx.fillText(`Winner: ${match.winner}`, canvas.width / 2, 140);

    // Team scores
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    
    // Team 1
    ctx.fillText(`${match.team1.name}:`, 50, 200);
    ctx.fillText(`${match.team1.score}/${match.team1.wickets}`, 50, 230);
    ctx.fillText(`Overs: ${match.team1.overs}.${match.team1.balls}`, 50, 260);

    // Team 2
    ctx.fillText(`${match.team2.name}:`, 50, 320);
    ctx.fillText(`${match.team2.score}/${match.team2.wickets}`, 50, 350);
    ctx.fillText(`Overs: ${match.team2.overs}.${match.team2.balls}`, 50, 380);

    // Match format
    ctx.font = '16px Arial';
    ctx.fillText(`Format: ${match.totalOvers} overs`, 50, 420);

    // Man of the Match
    if (match.manOfTheMatch) {
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 18px Arial';
      ctx.fillText(`Man of the Match: ${match.manOfTheMatch.name}`, 50, 460);
    }

    // Date
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px Arial';
    const matchDate = new Date(match.startTime).toLocaleDateString();
    ctx.fillText(`Date: ${matchDate}`, 50, 500);

    // Footer
    ctx.fillStyle = '#64748b';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Generated by ScoreWise Cricket Scorer', canvas.width / 2, 580);

    // Convert canvas to blob
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          throw new Error('Failed to generate PDF blob');
        }
      }, 'image/png');
    });
  }

  static async shareScoreboard(match: Match): Promise<void> {
    try {
      const blob = await this.generateDetailedScorecard(match);
      
      // Create file for sharing
      const file = new File([blob], `detailed_scorecard_${match.team1.name}_vs_${match.team2.name}.pdf`, {
        type: 'application/pdf'
      });

      // Check if Web Share API is available
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Cricket Match Scorecard',
          text: `Check out the detailed scorecard for ${match.team1.name} vs ${match.team2.name}!`,
          files: [file]
        });
      } else {
        // Fallback: Download the file
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `detailed_scorecard_${match.team1.name}_vs_${match.team2.name}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to share scoreboard:', error);
      throw error;
    }
  }

  static async shareToWhatsApp(match: Match): Promise<void> {
    try {
      const blob = await this.generateDetailedScorecard(match);
      const url = URL.createObjectURL(blob);
      
      // Create WhatsApp share URL with detailed information
      const text = `🏏 Cricket Match Scorecard\n\n${match.team1.name} vs ${match.team2.name}\n\n${match.team1.name}: ${match.team1.score}/${match.team1.wickets} (${match.team1.overs}.${match.team1.balls})\n${match.team2.name}: ${match.team2.score}/${match.team2.wickets} (${match.team2.overs}.${match.team2.balls})\n\nWinner: ${match.winner}\n\n${match.manOfTheMatch ? `Man of the Match: ${match.manOfTheMatch.name}\n\n` : ''}Generated by ScoreWise Cricket Scorer`;
      
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(whatsappUrl, '_blank');
      
      // Clean up
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('Failed to share to WhatsApp:', error);
      throw error;
    }
  }

  // Helper to get dismissal info for a player
  private static getDismissalInfo(match: Match, player: any): string {
    // Find the ball where the player got out
    const wicketBall = match.balls.find(b => b.isWicket && b.striker.id === player.id);
    if (!wicketBall) return player.name + ' not out';
    // Example: c Fielder b Bowler
    if (wicketBall.wicketType === 'caught') {
      return `${player.name} c ${wicketBall.wicketFielder?.name || ''} b ${wicketBall.bowler.name}`;
    } else if (wicketBall.wicketType === 'bowled') {
      return `${player.name} b ${wicketBall.bowler.name}`;
    } else if (wicketBall.wicketType === 'lbw') {
      return `${player.name} lbw b ${wicketBall.bowler.name}`;
    } else if (wicketBall.wicketType === 'run_out') {
      return `${player.name} run out (${wicketBall.wicketFielder?.name || ''})`;
    } else if (wicketBall.wicketType === 'stumped') {
      return `${player.name} st ${wicketBall.wicketFielder?.name || ''} b ${wicketBall.bowler.name}`;
    } else if (wicketBall.wicketType === 'hit_wicket') {
      return `${player.name} hit wicket b ${wicketBall.bowler.name}`;
    }
    return `${player.name} out`;
  }
} 