import { db } from '../config/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit,
  where,
  Timestamp,
  serverTimestamp,
  onSnapshot,
  enableNetwork,
  disableNetwork
} from 'firebase/firestore';
import { Match, Player } from '../types/cricket';

const MATCHES_COLLECTION = 'matches';
const PLAYERS_COLLECTION = 'players';
const MATCH_STATES_COLLECTION = 'match_states';

// Simple helper to check if we're online
const isOnline = () => navigator.onLine;

// Check if Firebase is working properly
const isFirebaseWorking = () => {
  try {
    return db && typeof db.collection === 'function';
  } catch (error) {
    console.warn('⚠️ Firebase not working properly:', error);
    return false;
  }
};

// Prepare match data for Firestore with complete information
const prepareMatchForFirestore = (match: Match) => {
  try {
    return {
      // Basic match info
      id: match.id,
      totalOvers: match.totalOvers || 20,
      isCompleted: match.isCompleted || false,
      isSecondInnings: match.isSecondInnings || false,
      firstInningsScore: match.firstInningsScore || null,
      winner: match.winner || null,
      resultMargin: match.resultMargin || null,
      startTime: match.startTime ? Timestamp.fromDate(new Date(match.startTime)) : serverTimestamp(),
      endTime: match.endTime ? Timestamp.fromDate(new Date(match.endTime)) : null,
      lastUpdated: serverTimestamp(),
      
      // Complete team data
      team1: {
        name: match.team1?.name || '',
        score: match.team1?.score || 0,
        wickets: match.team1?.wickets || 0,
        overs: match.team1?.overs || 0,
        balls: match.team1?.balls || 0,
        extras: match.team1?.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
        fallOfWickets: match.team1?.fallOfWickets || [],
        players: match.team1?.players?.map(p => ({
          id: p.id,
          name: p.name,
          shortId: p.shortId,
          photoUrl: p.photoUrl,
          isGroupMember: p.isGroupMember,
          isGuest: p.isGuest
        })) || []
      },
      
      team2: {
        name: match.team2?.name || '',
        score: match.team2?.score || 0,
        wickets: match.team2?.wickets || 0,
        overs: match.team2?.overs || 0,
        balls: match.team2?.balls || 0,
        extras: match.team2?.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
        fallOfWickets: match.team2?.fallOfWickets || [],
        players: match.team2?.players?.map(p => ({
          id: p.id,
          name: p.name,
          shortId: p.shortId,
          photoUrl: p.photoUrl,
          isGroupMember: p.isGroupMember,
          isGuest: p.isGuest
        })) || []
      },
      
      // Current match state
      battingTeam: {
        name: match.battingTeam?.name || '',
        score: match.battingTeam?.score || 0,
        wickets: match.battingTeam?.wickets || 0,
        overs: match.battingTeam?.overs || 0,
        balls: match.battingTeam?.balls || 0,
        extras: match.battingTeam?.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
        fallOfWickets: match.battingTeam?.fallOfWickets || []
      },
      
      bowlingTeam: {
        name: match.bowlingTeam?.name || '',
        score: match.bowlingTeam?.score || 0,
        wickets: match.bowlingTeam?.wickets || 0,
        overs: match.bowlingTeam?.overs || 0,
        balls: match.bowlingTeam?.balls || 0,
        extras: match.bowlingTeam?.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
        fallOfWickets: match.bowlingTeam?.fallOfWickets || []
      },
      
      // Current players
      currentStriker: match.currentStriker ? {
        id: match.currentStriker.id,
        name: match.currentStriker.name,
        shortId: match.currentStriker.shortId,
        photoUrl: match.currentStriker.photoUrl,
        isGroupMember: match.currentStriker.isGroupMember,
        isGuest: match.currentStriker.isGuest
      } : null,
      
      currentNonStriker: match.currentNonStriker ? {
        id: match.currentNonStriker.id,
        name: match.currentNonStriker.name,
        shortId: match.currentNonStriker.shortId,
        photoUrl: match.currentNonStriker.photoUrl,
        isGroupMember: match.currentNonStriker.isGroupMember,
        isGuest: match.currentNonStriker.isGuest
      } : null,
      
      currentBowler: match.currentBowler ? {
        id: match.currentBowler.id,
        name: match.currentBowler.name,
        shortId: match.currentBowler.shortId,
        photoUrl: match.currentBowler.photoUrl,
        isGroupMember: match.currentBowler.isGroupMember,
        isGuest: match.currentBowler.isGuest
      } : null,
      
      previousBowler: match.previousBowler ? {
        id: match.previousBowler.id,
        name: match.previousBowler.name,
        shortId: match.previousBowler.shortId,
        photoUrl: match.previousBowler.photoUrl,
        isGroupMember: match.previousBowler.isGroupMember,
        isGuest: match.previousBowler.isGuest
      } : null,
      
      manOfTheMatch: match.manOfTheMatch ? {
        id: match.manOfTheMatch.id,
        name: match.manOfTheMatch.name,
        shortId: match.manOfTheMatch.shortId,
        photoUrl: match.manOfTheMatch.photoUrl,
        isGroupMember: match.manOfTheMatch.isGroupMember,
        isGuest: match.manOfTheMatch.isGuest
      } : null,
      
      // Ball by ball data (limited to last 100 balls for performance)
      balls: (match.balls || []).slice(-100).map(ball => ({
        id: ball.id,
        ballNumber: ball.ballNumber,
        overNumber: ball.overNumber,
        bowler: {
          id: ball.bowler.id,
          name: ball.bowler.name
        },
        striker: {
          id: ball.striker.id,
          name: ball.striker.name
        },
        nonStriker: ball.nonStriker ? {
          id: ball.nonStriker.id,
          name: ball.nonStriker.name
        } : null,
        runs: ball.runs,
        isWide: ball.isWide,
        isNoBall: ball.isNoBall,
        isBye: ball.isBye,
        isLegBye: ball.isLegBye,
        isWicket: ball.isWicket,
        wicketType: ball.wicketType,
        fielder: ball.fielder ? {
          id: ball.fielder.id,
          name: ball.fielder.name
        } : null,
        commentary: ball.commentary,
        timestamp: ball.timestamp,
        innings: ball.innings,
        battingTeamId: ball.battingTeamId
      })),
      
      // Match status
      tossWinner: match.tossWinner || '',
      tossDecision: match.tossDecision || 'bat',
      currentInnings: match.currentInnings || 1,
      
      // Backup metadata
      backupVersion: '1.0',
      deviceInfo: {
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      }
    };
  } catch (error) {
    console.error('❌ Error preparing match data for Firestore:', error);
    throw new Error('Failed to prepare match data');
  }
};

// Convert Firestore data back to Match object
const convertFirestoreToMatch = (data: any): Match => {
  return {
    id: data.id,
    team1: {
      name: data.team1.name,
      players: data.team1.players || [],
      score: data.team1.score || 0,
      wickets: data.team1.wickets || 0,
      overs: data.team1.overs || 0,
      balls: data.team1.balls || 0,
      extras: data.team1.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
      fallOfWickets: data.team1.fallOfWickets || []
    },
    team2: {
      name: data.team2.name,
      players: data.team2.players || [],
      score: data.team2.score || 0,
      wickets: data.team2.wickets || 0,
      overs: data.team2.overs || 0,
      balls: data.team2.balls || 0,
      extras: data.team2.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
      fallOfWickets: data.team2.fallOfWickets || []
    },
    battingTeam: {
      name: data.battingTeam.name,
      players: data.battingTeam.players || [],
      score: data.battingTeam.score || 0,
      wickets: data.battingTeam.wickets || 0,
      overs: data.battingTeam.overs || 0,
      balls: data.battingTeam.balls || 0,
      extras: data.battingTeam.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
      fallOfWickets: data.battingTeam.fallOfWickets || []
    },
    bowlingTeam: {
      name: data.bowlingTeam.name,
      players: data.bowlingTeam.players || [],
      score: data.bowlingTeam.score || 0,
      wickets: data.bowlingTeam.wickets || 0,
      overs: data.bowlingTeam.overs || 0,
      balls: data.bowlingTeam.balls || 0,
      extras: data.bowlingTeam.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
      fallOfWickets: data.bowlingTeam.fallOfWickets || []
    },
    totalOvers: data.totalOvers || 20,
    balls: data.balls || [],
    isCompleted: data.isCompleted || false,
    isSecondInnings: data.isSecondInnings || false,
    firstInningsScore: data.firstInningsScore,
    winner: data.winner,
    resultMargin: data.resultMargin,
    startTime: data.startTime?.toDate?.() || new Date(data.startTime),
    endTime: data.endTime?.toDate?.() || (data.endTime ? new Date(data.endTime) : undefined),
    currentStriker: data.currentStriker,
    currentNonStriker: data.currentNonStriker,
    currentBowler: data.currentBowler,
    previousBowler: data.previousBowler,
    manOfTheMatch: data.manOfTheMatch,
    tossWinner: data.tossWinner || '',
    tossDecision: data.tossDecision || 'bat',
    currentInnings: data.currentInnings || 1
  } as Match;
};

export const cloudStorageService = {
  // Save match to cloud storage with complete backup
  async saveMatch(match: Match): Promise<void> {
    try {
      console.log('🔄 Saving match to cloud:', match.id);
      
      if (!isOnline() || !isFirebaseWorking()) {
        console.log('📱 Device offline or Firebase unavailable, skipping cloud save');
        return;
      }
      
      if (!match.id || !match.team1?.name || !match.team2?.name) {
        console.warn('⚠️ Match missing required data, skipping cloud save');
        return;
      }

      const matchData = prepareMatchForFirestore(match);
      const matchRef = doc(db, MATCHES_COLLECTION, match.id);
      
      await setDoc(matchRef, matchData, { merge: true });
      
      // Also save as a separate backup state for resumption
      const stateRef = doc(db, MATCH_STATES_COLLECTION, match.id);
      await setDoc(stateRef, {
        ...matchData,
        isBackup: true,
        backupTimestamp: serverTimestamp()
      }, { merge: true });
      
      console.log('✅ Successfully saved match to cloud with backup:', match.id);
    } catch (error: any) {
      console.warn('⚠️ Cloud save failed:', error?.message || error);
      throw error; // Re-throw for retry logic
    }
  },

  // Get match from cloud storage with full restoration
  async getMatch(matchId: string): Promise<Match | null> {
    try {
      console.log('🔄 Retrieving match from cloud:', matchId);
      
      if (!matchId || !isOnline() || !isFirebaseWorking()) {
        console.log('📱 Cannot fetch from cloud - offline or invalid ID');
        return null;
      }

      const matchRef = doc(db, MATCHES_COLLECTION, matchId);
      const matchDoc = await getDoc(matchRef);
      
      if (matchDoc.exists()) {
        const data = matchDoc.data();
        console.log('✅ Successfully retrieved match from cloud:', matchId);
        return convertFirestoreToMatch(data);
      }
      
      console.log('📭 Match not found in cloud:', matchId);
      return null;
    } catch (error: any) {
      console.warn('⚠️ Cloud retrieval failed:', error?.message || error);
      return null;
    }
  },

  // Get incomplete matches for resumption
  async getIncompleteMatches(): Promise<Match[]> {
    try {
      console.log('🔄 Searching for incomplete matches');
      
      if (!isOnline() || !isFirebaseWorking()) {
        console.log('📱 Device offline, cannot search for incomplete matches');
        return [];
      }
      
      const matchesQuery = query(
        collection(db, MATCHES_COLLECTION),
        where('isCompleted', '==', false),
        orderBy('lastUpdated', 'desc'),
        limit(10)
      );
      
      const querySnapshot = await getDocs(matchesQuery);
      const incompleteMatches = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return convertFirestoreToMatch(data);
      });
      
      console.log('✅ Found incomplete matches:', incompleteMatches.length);
      return incompleteMatches;
    } catch (error: any) {
      console.warn('⚠️ Failed to get incomplete matches:', error?.message || error);
      return [];
    }
  },

  // Save player data to cloud
  async savePlayer(player: Player): Promise<void> {
    try {
      if (!isOnline() || !isFirebaseWorking()) {
        console.log('📱 Device offline, skipping player cloud save');
        return;
      }

      const playerRef = doc(db, PLAYERS_COLLECTION, player.id);
      await setDoc(playerRef, {
        ...player,
        lastUpdated: serverTimestamp()
      }, { merge: true });
      
      console.log('✅ Player saved to cloud:', player.name);
    } catch (error: any) {
      console.warn('⚠️ Failed to save player to cloud:', error?.message || error);
    }
  },

  // Get all players from cloud
  async getAllPlayers(): Promise<Player[]> {
    try {
      if (!isOnline() || !isFirebaseWorking()) {
        console.log('📱 Device offline, cannot fetch players from cloud');
        return [];
      }

      const playersQuery = query(
        collection(db, PLAYERS_COLLECTION),
        orderBy('lastUpdated', 'desc')
      );
      
      const querySnapshot = await getDocs(playersQuery);
      const players = querySnapshot.docs.map(doc => doc.data() as Player);
      
      console.log('✅ Retrieved players from cloud:', players.length);
      return players;
    } catch (error: any) {
      console.warn('⚠️ Failed to get players from cloud:', error?.message || error);
      return [];
    }
  },

  // Real-time match synchronization
  subscribeToMatch(matchId: string, callback: (match: Match | null) => void): () => void {
    if (!isOnline() || !isFirebaseWorking()) {
      console.log('📱 Cannot subscribe - offline or Firebase unavailable');
      return () => {};
    }

    try {
      const matchRef = doc(db, MATCHES_COLLECTION, matchId);
      
      const unsubscribe = onSnapshot(matchRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          const match = convertFirestoreToMatch(data);
          callback(match);
        } else {
          callback(null);
        }
      }, (error) => {
        console.warn('⚠️ Match subscription error:', error);
        callback(null);
      });

      console.log('✅ Subscribed to match updates:', matchId);
      return unsubscribe;
    } catch (error) {
      console.warn('⚠️ Failed to subscribe to match:', error);
      return () => {};
    }
  },

  // Backup current match state
  async createBackup(match: Match, backupName?: string): Promise<string> {
    try {
      if (!isOnline() || !isFirebaseWorking()) {
        throw new Error('Cannot create backup - device offline');
      }

      const backupId = `backup_${match.id}_${Date.now()}`;
      const backupRef = doc(db, 'match_backups', backupId);
      
      const backupData = {
        ...prepareMatchForFirestore(match),
        backupId,
        backupName: backupName || `Backup ${new Date().toLocaleString()}`,
        originalMatchId: match.id,
        createdAt: serverTimestamp()
      };
      
      await setDoc(backupRef, backupData);
      
      console.log('✅ Backup created:', backupId);
      return backupId;
    } catch (error: any) {
      console.error('❌ Failed to create backup:', error);
      throw error;
    }
  },

  // Restore from backup
  async restoreFromBackup(backupId: string): Promise<Match | null> {
    try {
      if (!isOnline() || !isFirebaseWorking()) {
        throw new Error('Cannot restore backup - device offline');
      }

      const backupRef = doc(db, 'match_backups', backupId);
      const backupDoc = await getDoc(backupRef);
      
      if (backupDoc.exists()) {
        const data = backupDoc.data();
        const match = convertFirestoreToMatch(data);
        console.log('✅ Backup restored:', backupId);
        return match;
      }
      
      return null;
    } catch (error: any) {
      console.error('❌ Failed to restore backup:', error);
      throw error;
    }
  },

  // Get recent matches with pagination
  async getRecentMatches(limitCount: number = 10, lastDoc?: any): Promise<{ matches: Match[], lastDoc: any }> {
    try {
      if (!isOnline() || !isFirebaseWorking()) {
        return { matches: [], lastDoc: null };
      }
      
      let matchesQuery = query(
        collection(db, MATCHES_COLLECTION),
        orderBy('lastUpdated', 'desc'),
        limit(limitCount)
      );
      
      if (lastDoc) {
        matchesQuery = query(matchesQuery, startAfter(lastDoc));
      }
      
      const querySnapshot = await getDocs(matchesQuery);
      const matches = querySnapshot.docs.map(doc => convertFirestoreToMatch(doc.data()));
      const newLastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      
      console.log('✅ Retrieved recent matches:', matches.length);
      return { matches, lastDoc: newLastDoc };
    } catch (error: any) {
      console.warn('⚠️ Failed to get recent matches:', error?.message || error);
      return { matches: [], lastDoc: null };
    }
  },

  // Check connection and sync status
  async checkConnection(): Promise<{ online: boolean, firebaseWorking: boolean, lastSync?: Date }> {
    const online = isOnline();
    const firebaseWorking = isFirebaseWorking();
    
    let lastSync;
    try {
      if (online && firebaseWorking) {
        // Test connection with a simple read
        const testRef = doc(db, 'connection_test', 'test');
        await getDoc(testRef);
        lastSync = new Date();
      }
    } catch (error) {
      console.warn('⚠️ Connection test failed:', error);
    }
    
    return { online, firebaseWorking, lastSync };
  },

  // Force offline mode
  async goOffline(): Promise<void> {
    try {
      await disableNetwork(db);
      console.log('📱 Forced offline mode');
    } catch (error) {
      console.warn('⚠️ Failed to go offline:', error);
    }
  },

  // Force online mode
  async goOnline(): Promise<void> {
    try {
      await enableNetwork(db);
      console.log('📱 Forced online mode');
    } catch (error) {
      console.warn('⚠️ Failed to go online:', error);
    }
  },

  // Sync local data with cloud
  async syncLocalData(localMatches: Match[], localPlayers: Player[]): Promise<{ synced: number, errors: number }> {
    let synced = 0;
    let errors = 0;
    
    try {
      if (!isOnline() || !isFirebaseWorking()) {
        throw new Error('Cannot sync - device offline');
      }
      
      // Sync matches
      for (const match of localMatches) {
        try {
          await this.saveMatch(match);
          synced++;
        } catch (error) {
          console.warn('⚠️ Failed to sync match:', match.id, error);
          errors++;
        }
      }
      
      // Sync players
      for (const player of localPlayers) {
        try {
          await this.savePlayer(player);
          synced++;
        } catch (error) {
          console.warn('⚠️ Failed to sync player:', player.id, error);
          errors++;
        }
      }
      
      console.log(`✅ Sync completed: ${synced} items synced, ${errors} errors`);
    } catch (error) {
      console.error('❌ Sync failed:', error);
      errors++;
    }
    
    return { synced, errors };
  }
};