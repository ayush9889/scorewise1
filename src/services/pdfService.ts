import { Match } from '../types/cricket';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CricketEngine } from './cricketEngine';

export class PDFService {
  static async generateDetailedScorecard(match: Match): Promise<Blob> {
    const doc = new jsPDF();
    let y = 15;

    // === HEADER SECTION ===
    y = this.addHeader(doc, match, y);
    y += 10;

    // === MATCH RESULT AND DETAILS ===
    y = this.addMatchResult(doc, match, y);
    y += 15;

    // === FIRST INNINGS ===
    y = this.addInningsSection(doc, match, 1, y);
    
    // Check if we need a new page
    if (y > 220) {
      doc.addPage();
      y = 20;
    } else {
      y += 15;
    }

    // === SECOND INNINGS ===
    if (match.isSecondInnings || match.isCompleted) {
      y = this.addInningsSection(doc, match, 2, y);
    }

    // Check if we need a new page for MOTM
    if (y > 240) {
      doc.addPage();
      y = 20;
    } else {
      y += 10;
    }

    // === MAN OF THE MATCH SECTION ===
    y = this.addManOfTheMatchSection(doc, match, y);

    // === FOOTER ===
    this.addFooter(doc);

    return doc.output('blob');
  }

  private static addHeader(doc: jsPDF, match: Match, y: number): number {
    // Title
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.text('CRICKET MATCH SCORECARD', doc.internal.pageSize.width / 2, y, { align: 'center' });
    
    // Match teams
    doc.setFontSize(14);
    doc.text(`${match.team1.name} vs ${match.team2.name}`, doc.internal.pageSize.width / 2, y + 10, { align: 'center' });
    
    // Date and format
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const matchDate = new Date(match.startTime).toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    doc.text(`${matchDate} • ${match.totalOvers} overs per side`, doc.internal.pageSize.width / 2, y + 18, { align: 'center' });
    
    return y + 25;
  }

  private static addMatchResult(doc: jsPDF, match: Match, y: number): number {
    if (!match.isCompleted) return y;

    // Get match result
    const result = CricketEngine.getMatchResult(match);
    
    // Result box
    doc.setFillColor(76, 175, 80);
    doc.rect(14, y - 3, 182, 16, 'F');
    
    // Result text
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text('MATCH RESULT', doc.internal.pageSize.width / 2, y + 4, { align: 'center' });
    doc.text(result, doc.internal.pageSize.width / 2, y + 10, { align: 'center' });
    
    // Toss information
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    y += 20;
    doc.text(`Toss: ${match.tossWinner} elected to ${match.tossDecision === 'bat' ? 'bat first' : 'bowl first'}`, 14, y);
    
    return y + 5;
  }

  private static addInningsSection(doc: jsPDF, match: Match, innings: number, y: number): number {
    const team = innings === 1 ? match.team1 : match.team2;
    const bowlingTeam = innings === 1 ? match.team2 : match.team1;
    
    // Innings header
    doc.setFillColor(63, 81, 181);
    doc.setTextColor(255, 255, 255);
    doc.rect(14, y, 182, 8, 'F');
    doc.setFontSize(11);
    doc.text(`${team.name} - ${innings === 1 ? '1st' : '2nd'} Innings`, 16, y + 6);
    
    // Total score
    const runRate = team.overs > 0 ? ((team.score / (team.overs + team.balls / 6)) || 0).toFixed(2) : '0.00';
    doc.text(`${team.score}/${team.wickets} (${team.overs}.${team.balls} overs, RR: ${runRate})`, 
             190, y + 6, { align: 'right' });
    
    y += 12;

    // Batting table
    const battingData = this.prepareBattingData(match, team, innings);
    if (battingData.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Batsman', 'Dismissal', 'R', 'B', '4s', '6s', 'SR']],
        body: battingData,
        theme: 'grid',
        headStyles: { 
          fillColor: [63, 81, 181],
          textColor: [255, 255, 255],
          fontSize: 9,
          halign: 'center'
        },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 30, halign: 'left' },
          1: { cellWidth: 45, halign: 'left' },
          2: { cellWidth: 12, halign: 'center' },
          3: { cellWidth: 12, halign: 'center' },
          4: { cellWidth: 12, halign: 'center' },
          5: { cellWidth: 12, halign: 'center' },
          6: { cellWidth: 20, halign: 'center' }
        }
      });
      y = (doc as any).lastAutoTable.finalY + 3;
    }

    // Extras and Total
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const extras = team.extras;
    const totalExtras = extras.byes + extras.legByes + extras.wides + extras.noBalls;
    doc.text(`Extras: ${totalExtras} (b ${extras.byes}, lb ${extras.legByes}, w ${extras.wides}, nb ${extras.noBalls})`, 16, y + 3);
    y += 8;

    doc.setFontSize(10);
    doc.text(`Total: ${team.score}/${team.wickets} (${team.overs}.${team.balls} overs) RR: ${runRate}`, 16, y + 3);
    y += 8;

    // Fall of wickets
    y = this.addFallOfWickets(doc, match, team, innings, y);

    // Partnerships
    y = this.addPartnerships(doc, match, team, innings, y);

    // Bowling figures
    y = this.addBowlingFigures(doc, match, bowlingTeam, innings, y);

    return y;
  }

  private static prepareBattingData(match: Match, team: any, innings: number): any[][] {
    const battingData: any[][] = [];
    
    team.players.forEach((player: any) => {
      const playerBalls = match.balls.filter((b: any) => 
        b.striker.id === player.id && b.innings === innings
      );
      
      // Only include players who faced at least one ball
      if (playerBalls.length === 0) return;

      let runs = 0;
      let ballsFaced = 0;
      let fours = 0;
      let sixes = 0;

      playerBalls.forEach((ball: any) => {
        if (!ball.isWide && !ball.isNoBall && !ball.isBye && !ball.isLegBye) {
          runs += ball.runs;
        }
        if (!ball.isWide && !ball.isNoBall) {
          ballsFaced++;
        }
        if (ball.runs === 4) fours++;
        if (ball.runs === 6) sixes++;
      });

      const strikeRate = ballsFaced > 0 ? ((runs / ballsFaced) * 100).toFixed(1) : '0.0';
      const dismissal = this.getDismissalInfo(match, player, innings);

      battingData.push([
        player.name,
        dismissal,
        runs.toString(),
        ballsFaced.toString(),
        fours.toString(),
        sixes.toString(),
        strikeRate
      ]);
    });

    return battingData;
  }

  private static addFallOfWickets(doc: jsPDF, match: Match, team: any, innings: number, y: number): number {
    const fallOfWickets = this.calculateFallOfWickets(match, team, innings);
    
    if (fallOfWickets.length === 0) return y + 3;

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('Fall of wickets:', 16, y + 3);
    y += 8;

    let fowText = '';
    fallOfWickets.forEach((fow, index) => {
      if (index > 0) fowText += ', ';
      fowText += `${fow.wicketNumber}-${fow.score} (${fow.batsman}, ${fow.over})`;
      
      // Break line if too long (about 85 characters)
      if (fowText.length > 85 && index < fallOfWickets.length - 1) {
        doc.text(fowText, 16, y + 3);
        y += 6;
        fowText = '';
      }
    });
    
    if (fowText) {
      doc.text(fowText, 16, y + 3);
      y += 6;
    }

    return y + 3;
  }

  private static addPartnerships(doc: jsPDF, match: Match, team: any, innings: number, y: number): number {
    const partnerships = this.calculatePartnerships(match, team, innings);
    
    if (partnerships.length === 0) return y + 3;

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('Partnerships:', 16, y + 3);
    y += 8;

    partnerships.forEach((partnership) => {
      const partnershipText = `${partnership.runs} runs for ${partnership.wicket} wicket (${partnership.batsman1} & ${partnership.batsman2})`;
      doc.text(partnershipText, 16, y + 3);
      y += 6;
    });

    return y + 3;
  }

  private static calculatePartnerships(match: Match, team: any, innings: number): any[] {
    const partnerships: any[] = [];
    const teamBalls = match.balls.filter((b: any) => 
      b.innings === innings && 
      team.players.some((p: any) => p.id === b.striker.id)
    );

    if (teamBalls.length === 0) return partnerships;

    let currentPartnership = {
      runs: 0,
      wicket: 1,
      batsman1: teamBalls[0]?.striker?.name || '',
      batsman2: teamBalls[0]?.nonStriker?.name || '',
      startBall: 0
    };

    let wicketCount = 0;

    teamBalls.forEach((ball: any, index: number) => {
      currentPartnership.runs += ball.runs;

      if (ball.isWicket) {
        wicketCount++;
        partnerships.push({
          ...currentPartnership,
          wicket: wicketCount
        });

        // Start new partnership if not the last wicket
        if (wicketCount < 10 && index < teamBalls.length - 1) {
          const nextBall = teamBalls[index + 1];
          currentPartnership = {
            runs: 0,
            wicket: wicketCount + 1,
            batsman1: nextBall?.striker?.name || '',
            batsman2: nextBall?.nonStriker?.name || '',
            startBall: index + 1
          };
        }
      }
    });

    // Add unfinished partnership if innings ended without all wickets falling
    if (wicketCount < 10 && currentPartnership.runs > 0) {
      partnerships.push({
        ...currentPartnership,
        wicket: wicketCount + 1
      });
    }

    return partnerships;
  }

  private static calculateFallOfWickets(match: Match, team: any, innings: number): any[] {
    const fallOfWickets: any[] = [];
    let wicketCount = 0;

    match.balls.forEach((ball: any) => {
      if (ball.innings === innings && ball.isWicket && 
          team.players.some((p: any) => p.id === ball.striker.id)) {
        wicketCount++;
        const overNumber = `${ball.overNumber}.${((ball.ballNumber - 1) % 6) + 1}`;
        
        fallOfWickets.push({
          wicketNumber: wicketCount,
          score: this.getScoreAtWicket(match, ball, innings),
          batsman: ball.striker.name,
          over: overNumber,
          dismissal: this.getWicketType(ball)
        });
      }
    });

    return fallOfWickets;
  }

  private static getScoreAtWicket(match: Match, wicketBall: any, innings: number): number {
    let score = 0;
    
    for (const ball of match.balls) {
      if (ball.innings === innings && 
          (ball.ballNumber < wicketBall.ballNumber || 
           (ball.ballNumber === wicketBall.ballNumber && ball.id === wicketBall.id))) {
        score += ball.runs;
      }
      if (ball.id === wicketBall.id) break;
    }
    
    return score;
  }

  private static addBowlingFigures(doc: jsPDF, match: Match, bowlingTeam: any, innings: number, y: number): number {
    const bowlingData = this.prepareBowlingData(match, bowlingTeam, innings);
    
    if (bowlingData.length === 0) return y;

    y += 5;

    autoTable(doc, {
      startY: y,
      head: [['Bowler', 'O', 'M', 'R', 'W', 'Econ', 'Dots', '4s', '6s']],
      body: bowlingData,
      theme: 'grid',
      headStyles: { 
        fillColor: [139, 69, 19],
        textColor: [255, 255, 255],
        fontSize: 9,
        halign: 'center'
      },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 30, halign: 'left' },
        1: { cellWidth: 15, halign: 'center' },
        2: { cellWidth: 12, halign: 'center' },
        3: { cellWidth: 12, halign: 'center' },
        4: { cellWidth: 12, halign: 'center' },
        5: { cellWidth: 18, halign: 'center' },
        6: { cellWidth: 12, halign: 'center' },
        7: { cellWidth: 12, halign: 'center' },
        8: { cellWidth: 12, halign: 'center' }
      }
    });

    return (doc as any).lastAutoTable.finalY + 5;
  }

  private static prepareBowlingData(match: Match, bowlingTeam: any, innings: number): any[][] {
    const bowlingData: any[][] = [];
    
    bowlingTeam.players.forEach((player: any) => {
      const playerBalls = match.balls.filter((b: any) => 
        b.bowler.id === player.id && b.innings === innings
      );
      
      // Only include players who bowled at least one ball
      if (playerBalls.length === 0) return;

      let runs = 0;
      let ballsBowled = 0;
      let wickets = 0;
      let maidens = 0;
      let dots = 0;
      let fours = 0;
      let sixes = 0;

      // Calculate per-over stats for maidens
      const overStats = new Map<number, { runs: number, balls: number }>();

      playerBalls.forEach((ball: any) => {
        runs += ball.runs;
        
        if (!ball.isWide && !ball.isNoBall) {
          ballsBowled++;
          if (ball.runs === 0) dots++;
        }
        
        if (ball.isWicket && ball.wicketType !== 'run_out') wickets++;
        if (ball.runs === 4) fours++;
        if (ball.runs === 6) sixes++;

        // Track over stats for maiden calculation
        const overKey = ball.overNumber;
        if (!overStats.has(overKey)) {
          overStats.set(overKey, { runs: 0, balls: 0 });
        }
        const overStat = overStats.get(overKey)!;
        overStat.runs += ball.runs;
        if (!ball.isWide && !ball.isNoBall) {
          overStat.balls++;
        }
      });

      // Count maiden overs
      overStats.forEach(stat => {
        if (stat.balls === 6 && stat.runs === 0) {
          maidens++;
        }
      });

      const overs = Math.floor(ballsBowled / 6);
      const remainingBalls = ballsBowled % 6;
      const oversStr = remainingBalls > 0 ? `${overs}.${remainingBalls}` : overs.toString();
      const economy = ballsBowled > 0 ? ((runs / ballsBowled) * 6).toFixed(2) : '0.00';

      bowlingData.push([
        player.name,
        oversStr,
        maidens.toString(),
        runs.toString(),
        wickets.toString(),
        economy,
        dots.toString(),
        fours.toString(),
        sixes.toString()
      ]);
    });

    return bowlingData;
  }

  private static addManOfTheMatchSection(doc: jsPDF, match: Match, y: number): number {
    if (!match.manOfTheMatch || !match.isCompleted) return y;

    // MOTM header
    doc.setFillColor(255, 193, 7);
    doc.setTextColor(0, 0, 0);
    doc.rect(14, y, 182, 10, 'F');
    doc.setFontSize(11);
    doc.text('🏆 MAN OF THE MATCH 🏆', doc.internal.pageSize.width / 2, y + 7, { align: 'center' });
    
    y += 15;

    // Player name
    doc.setFontSize(12);
    doc.text(match.manOfTheMatch.name, doc.internal.pageSize.width / 2, y, { align: 'center' });
    
    y += 8;

    // Performance details
    const motmStats = this.getPlayerPerformanceDetails(match, match.manOfTheMatch);
    
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    
    if (motmStats.battingPerformance) {
      doc.text(`Batting: ${motmStats.battingPerformance}`, doc.internal.pageSize.width / 2, y, { align: 'center' });
      y += 6;
    }
    
    if (motmStats.bowlingPerformance) {
      doc.text(`Bowling: ${motmStats.bowlingPerformance}`, doc.internal.pageSize.width / 2, y, { align: 'center' });
      y += 6;
    }
    
    if (motmStats.fieldingPerformance) {
      doc.text(`Fielding: ${motmStats.fieldingPerformance}`, doc.internal.pageSize.width / 2, y, { align: 'center' });
      y += 6;
    }

    return y + 10;
  }

  private static getPlayerPerformanceDetails(match: Match, player: any): any {
    const allBalls = match.balls;
    const battingBalls = allBalls.filter(b => b.striker.id === player.id);
    const bowlingBalls = allBalls.filter(b => b.bowler.id === player.id);
    const fieldingWickets = allBalls.filter(b => 
      b.isWicket && 
      (b.wicketType === 'caught' || b.wicketType === 'run_out' || b.wicketType === 'stumped') &&
      b.fielder?.id === player.id
    );

    let battingPerformance = '';
    let bowlingPerformance = '';
    let fieldingPerformance = '';

    // Batting performance
    if (battingBalls.length > 0) {
      const runs = battingBalls.reduce((sum, ball) => {
        if (!ball.isWide && !ball.isNoBall && !ball.isBye && !ball.isLegBye) {
          return sum + ball.runs;
        }
        return sum;
      }, 0);
      
      const ballsFaced = battingBalls.filter(b => !b.isWide && !b.isNoBall).length;
      const fours = battingBalls.filter(b => b.runs === 4).length;
      const sixes = battingBalls.filter(b => b.runs === 6).length;
      const strikeRate = ballsFaced > 0 ? ((runs / ballsFaced) * 100).toFixed(1) : '0.0';
      
      battingPerformance = `${runs}${runs >= 50 ? '*' : ''} (${ballsFaced}b, ${fours}×4, ${sixes}×6, SR: ${strikeRate})`;
    }

    // Bowling performance
    if (bowlingBalls.length > 0) {
      const runs = bowlingBalls.reduce((sum, ball) => sum + ball.runs, 0);
      const ballsBowled = bowlingBalls.filter(b => !b.isWide && !b.isNoBall).length;
      const wickets = bowlingBalls.filter(b => b.isWicket && b.wicketType !== 'run_out').length;
      const overs = Math.floor(ballsBowled / 6);
      const remainingBalls = ballsBowled % 6;
      const oversStr = remainingBalls > 0 ? `${overs}.${remainingBalls}` : overs.toString();
      const economy = ballsBowled > 0 ? ((runs / ballsBowled) * 6).toFixed(2) : '0.00';
      
      bowlingPerformance = `${wickets}/${runs} (${oversStr} overs, Econ: ${economy})`;
    }

    // Fielding performance
    if (fieldingWickets.length > 0) {
      const catches = fieldingWickets.filter(w => w.wicketType === 'caught').length;
      const runOuts = fieldingWickets.filter(w => w.wicketType === 'run_out').length;
      const stumpings = fieldingWickets.filter(w => w.wicketType === 'stumped').length;
      
      const parts = [];
      if (catches > 0) parts.push(`${catches} catch${catches > 1 ? 'es' : ''}`);
      if (runOuts > 0) parts.push(`${runOuts} run out${runOuts > 1 ? 's' : ''}`);
      if (stumpings > 0) parts.push(`${stumpings} stumping${stumpings > 1 ? 's' : ''}`);
      
      fieldingPerformance = parts.join(', ');
    }

    return { battingPerformance, bowlingPerformance, fieldingPerformance };
  }

  private static addFooter(doc: jsPDF): void {
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Generated by ScoreWise Cricket Scorer', 14, pageHeight - 10);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 
             doc.internal.pageSize.width - 14, pageHeight - 10, { align: 'right' });
  }

  private static getDismissalInfo(match: Match, player: any, innings: number): string {
    const wicketBall = match.balls.find(b => 
      b.isWicket && b.striker.id === player.id && b.innings === innings
    );
    
    if (!wicketBall) return 'not out';
    
    return this.getWicketType(wicketBall);
  }

  private static getWicketType(ball: any): string {
    switch (ball.wicketType) {
      case 'caught':
        return `c ${ball.wicketFielder?.name || ''} b ${ball.bowler.name}`;
      case 'bowled':
        return `b ${ball.bowler.name}`;
      case 'lbw':
        return `lbw b ${ball.bowler.name}`;
      case 'run_out':
        return `run out (${ball.wicketFielder?.name || ''})`;
      case 'stumped':
        return `st ${ball.wicketFielder?.name || ''} b ${ball.bowler.name}`;
      case 'hit_wicket':
        return `hit wicket b ${ball.bowler.name}`;
      default:
        return 'out';
    }
  }

  // Keep existing methods for backward compatibility
  static async generateScoreboardPDF(match: Match): Promise<Blob> {
    return this.generateDetailedScorecard(match);
  }

  static async shareScoreboard(match: Match): Promise<void> {
    try {
      const blob = await this.generateDetailedScorecard(match);
      
      const file = new File([blob], `cricket_scorecard_${match.team1.name}_vs_${match.team2.name}.pdf`, {
        type: 'application/pdf'
      });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Cricket Match Scorecard',
          text: `Professional cricket scorecard for ${match.team1.name} vs ${match.team2.name}!`,
          files: [file]
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to share scorecard:', error);
      throw error;
    }
  }

  static async shareToWhatsApp(match: Match): Promise<void> {
    try {
      const result = match.isCompleted ? CricketEngine.getMatchResult(match) : 'Match in progress';
      
      const text = `🏏 CRICKET MATCH SCORECARD\n\n` +
        `${match.team1.name} vs ${match.team2.name}\n\n` +
        `📊 FINAL SCORES:\n` +
        `${match.team1.name}: ${match.team1.score}/${match.team1.wickets} (${match.team1.overs}.${match.team1.balls})\n` +
        `${match.team2.name}: ${match.team2.score}/${match.team2.wickets} (${match.team2.overs}.${match.team2.balls})\n\n` +
        `🏆 RESULT: ${result}\n\n` +
        `🎯 Toss: ${match.tossWinner} elected to ${match.tossDecision === 'bat' ? 'bat first' : 'bowl first'}\n\n` +
        `${match.manOfTheMatch ? `⭐ Man of the Match: ${match.manOfTheMatch.name}\n\n` : ''}` +
        `📱 Generated by ScoreWise Cricket Scorer`;
      
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(whatsappUrl, '_blank');
    } catch (error) {
      console.error('Failed to share to WhatsApp:', error);
      throw error;
    }
  }
} 