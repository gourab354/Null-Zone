import React, { useState, useEffect, useRef } from 'react';
import { LEVELS, FREQUENCIES, checkVisibility, getDistance, generateRandomLevel, generateDescriptiveHint } from './game/engine';
import { playPlaceSound, playRemoveSound, playErrorSound, playWinSound, playHintSound } from './game/audio';
import { Zap, Radio, AlertTriangle, RefreshCcw, ArrowRight, Play, RotateCcw, Clock, Target, Star, Lightbulb, Unlock, LogIn, LogOut, User } from 'lucide-react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from './firebase';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [level, setLevel] = useState(LEVELS[0]);
  const [placedDevices, setPlacedDevices] = useState([]);
  const [selectedFreq, setSelectedFreq] = useState('RED');
  const [message, setMessage] = useState('Place devices to connect the source to the destination.');
  const [isError, setIsError] = useState(false);
  const [isWin, setIsWin] = useState(false);
  const [stars, setStars] = useState(0);
  const [hintUnlocked, setHintUnlocked] = useState(false);
  const [powerPenalty, setPowerPenalty] = useState(0);
  
  const canvasRef = useRef(null);
  const TILE_SIZE = 50;

  const obstaclesSet = new Set(level.obstacles.map(o => `${o.x},${o.y}`));

  // Handle Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch saved level
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.currentLevelIndex !== undefined) {
              setCurrentLevelIndex(data.currentLevelIndex);
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setCurrentLevelIndex(0);
      }
      setAuthChecking(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Reset state when level changes
  useEffect(() => {
    if (currentLevelIndex < LEVELS.length) {
      setLevel(LEVELS[currentLevelIndex]);
    } else {
      setLevel(generateRandomLevel(currentLevelIndex));
    }
    setPlacedDevices([]);
    setIsWin(false);
    setIsError(false);
    setStars(0);
    setHintUnlocked(false);
    setPowerPenalty(0);
    setMessage('Place devices to connect the source to the destination.');
  }, [currentLevelIndex]);

  const currentPowerBudget = level.powerBudget - powerPenalty;

  // Recalculate game state when devices change
  useEffect(() => {
    checkGameState();
    drawBoard();
  }, [placedDevices, selectedFreq, level]);

  const drawBoard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Clear board
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= level.cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * TILE_SIZE, 0);
      ctx.lineTo(x * TILE_SIZE, level.rows * TILE_SIZE);
      ctx.stroke();
    }
    for (let y = 0; y <= level.rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * TILE_SIZE);
      ctx.lineTo(level.cols * TILE_SIZE, y * TILE_SIZE);
      ctx.stroke();
    }

    // Draw obstacles (rock emoji)
    ctx.font = `${TILE_SIZE * 0.7}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    level.obstacles.forEach(obs => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(obs.x * TILE_SIZE, obs.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      ctx.fillText('🧱', obs.x * TILE_SIZE + TILE_SIZE/2, obs.y * TILE_SIZE + TILE_SIZE/2);
    });

    // Draw jammers
    level.jammers.forEach(jam => {
      // Draw jammer radius
      const baseColor = FREQUENCIES[jam.frequency];
      // Convert hex to rgba
      let r = parseInt(baseColor.slice(1, 3), 16);
      let g = parseInt(baseColor.slice(3, 5), 16);
      let b = parseInt(baseColor.slice(5, 7), 16);
      
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.15)`;
      
      ctx.beginPath();
      ctx.arc(jam.x * TILE_SIZE + TILE_SIZE/2, jam.y * TILE_SIZE + TILE_SIZE/2, jam.radius * TILE_SIZE, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw jammer symbol
      ctx.fillText('🚫', jam.x * TILE_SIZE + TILE_SIZE/2, jam.y * TILE_SIZE + TILE_SIZE/2);
    });
    
    // Draw connections and devices
    drawConnectionsAndDevices(ctx);

    // Draw Source (Transmitter) - Huge glowing green beacon
    const sx = level.source.x * TILE_SIZE + TILE_SIZE/2;
    const sy = level.source.y * TILE_SIZE + TILE_SIZE/2;
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 35;
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(sx, sy, TILE_SIZE * 0.7, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    const sGrad = ctx.createRadialGradient(sx, sy, 5, sx, sy, TILE_SIZE * 0.7);
    sGrad.addColorStop(0, '#a7f3d0');
    sGrad.addColorStop(1, '#059669');
    ctx.fillStyle = sGrad;
    ctx.fill();
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.stroke();
    
    ctx.fillStyle = '#000000';
    ctx.font = `${TILE_SIZE * 0.8}px serif`;
    ctx.fillText('📡', sx, sy + 4);

    // Draw Destination (Receiver) - Huge glowing cyan beacon
    const dx = level.destination.x * TILE_SIZE + TILE_SIZE/2;
    const dy = level.destination.y * TILE_SIZE + TILE_SIZE/2;
    ctx.shadowColor = '#0ea5e9';
    ctx.shadowBlur = 35;
    ctx.fillStyle = '#0ea5e9';
    ctx.beginPath();
    ctx.arc(dx, dy, TILE_SIZE * 0.7, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    const dGrad = ctx.createRadialGradient(dx, dy, 5, dx, dy, TILE_SIZE * 0.7);
    dGrad.addColorStop(0, '#bae6fd');
    dGrad.addColorStop(1, '#0284c7');
    ctx.fillStyle = dGrad;
    ctx.fill();
    
    ctx.stroke();
    
    ctx.fillStyle = '#000000';
    ctx.font = `${TILE_SIZE * 0.8}px serif`;
    ctx.fillText('📡', dx, dy + 4);
  };

  const drawConnectionsAndDevices = (ctx) => {
    // Find jammed devices
    const jammedDevices = new Set();
    placedDevices.forEach(dev => {
      level.jammers.forEach(jam => {
        if (jam.frequency === dev.freq && getDistance(dev.x, dev.y, jam.x, jam.y) <= jam.radius) {
          jammedDevices.add(`${dev.x},${dev.y}`);
        }
      });
    });

    const activeDevices = placedDevices.filter(dev => !jammedDevices.has(`${dev.x},${dev.y}`));

    const nodes = [
      { ...level.source, isSource: true, freq: null },
      ...activeDevices,
      { ...level.destination, isDest: true, freq: null }
    ];

    ctx.lineWidth = 4;
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const n1 = nodes[i];
        const n2 = nodes[j];
        
        if ((n1.isSource && n2.isDest) || (n2.isSource && n1.isDest)) {
            if (activeDevices.length === 0 && checkVisibility(n1.x, n1.y, n2.x, n2.y, obstaclesSet)) {
                ctx.strokeStyle = '#fff';
                ctx.beginPath();
                ctx.moveTo(n1.x * TILE_SIZE + TILE_SIZE/2, n1.y * TILE_SIZE + TILE_SIZE/2);
                ctx.lineTo(n2.x * TILE_SIZE + TILE_SIZE/2, n2.y * TILE_SIZE + TILE_SIZE/2);
                ctx.stroke();
            }
            continue;
        }

        let isValidFreq = false;
        let connectionColor = '#fff';
        let connectionFreq = null;

        if (n1.isSource || n2.isSource || n1.isDest || n2.isDest) {
            isValidFreq = true;
            connectionFreq = n1.freq || n2.freq;
            connectionColor = connectionFreq ? FREQUENCIES[connectionFreq] : '#fff';
        } else if (n1.freq === n2.freq) {
            isValidFreq = true;
            connectionFreq = n1.freq;
            connectionColor = FREQUENCIES[connectionFreq];
        }

        if (isValidFreq) {
          if (checkVisibility(n1.x, n1.y, n2.x, n2.y, obstaclesSet, level.jammers, connectionFreq)) {
            ctx.strokeStyle = connectionColor;
            ctx.beginPath();
            ctx.moveTo(n1.x * TILE_SIZE + TILE_SIZE/2, n1.y * TILE_SIZE + TILE_SIZE/2);
            ctx.lineTo(n2.x * TILE_SIZE + TILE_SIZE/2, n2.y * TILE_SIZE + TILE_SIZE/2);
            ctx.stroke();
            
            // Add stroke outline for visibility
            ctx.lineWidth = 8;
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.stroke();
            ctx.lineWidth = 4;
            ctx.strokeStyle = connectionColor;
            ctx.stroke();
          }
        }
      }
    }

    // Draw devices
    placedDevices.forEach(dev => {
      const centerX = dev.x * TILE_SIZE + TILE_SIZE/2;
      const centerY = dev.y * TILE_SIZE + TILE_SIZE/2;
      const color = FREQUENCIES[dev.freq];
      const isJammed = jammedDevices.has(`${dev.x},${dev.y}`);
      
      const r = TILE_SIZE * 0.45; 

      // Outer Glow
      ctx.shadowColor = isJammed ? '#ff0000' : color;
      ctx.shadowBlur = 20;
      ctx.fillStyle = isJammed ? '#333333' : color;
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0; // reset shadow

      // Thick Border
      ctx.strokeStyle = isJammed ? '#ff0000' : '#ffffff';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Emoji
      ctx.fillStyle = '#000000';
      ctx.font = `${TILE_SIZE * 0.6}px serif`;
      ctx.fillText(isJammed ? '💥' : '🗼', centerX, centerY + 2);
    });
  };

  const handleCanvasClick = (e) => {
    if (isWin) return;
    const rect = canvasRef.current.getBoundingClientRect();
    
    // Calculate scale ratio because CSS might scale the canvas down
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const x = Math.floor(((e.clientX - rect.left) * scaleX) / TILE_SIZE);
    const y = Math.floor(((e.clientY - rect.top) * scaleY) / TILE_SIZE);

    if (x < 0 || x >= level.cols || y < 0 || y >= level.rows) return;

    if (obstaclesSet.has(`${x},${y}`) || 
        (level.source.x === x && level.source.y === y) ||
        (level.destination.x === x && level.destination.y === y)) {
      setMessage("Cannot place device here.");
      setIsError(true);
      playErrorSound();
      return;
    }

    const existingIdx = placedDevices.findIndex(d => d.x === x && d.y === y);
    if (existingIdx >= 0) {
      setPlacedDevices(prev => prev.filter((_, i) => i !== existingIdx));
      setMessage("Device removed.");
      setIsError(false);
      playRemoveSound();
      return;
    }

    if (placedDevices.length >= currentPowerBudget) {
      setMessage("Out of power! Remove a device.");
      setIsError(true);
      playErrorSound();
      return;
    }

    setPlacedDevices(prev => [...prev, { x, y, freq: selectedFreq }]);
    setMessage("Device placed.");
    setIsError(false);
    playPlaceSound();
  };

  const checkGameState = () => {
    for (let dev of placedDevices) {
      for (let jam of level.jammers) {
        if (jam.frequency === dev.freq && getDistance(dev.x, dev.y, jam.x, jam.y) <= jam.radius) {
          setMessage(`Jammer interference! Blocking ${dev.freq} frequency.`);
          setIsError(true);
          setIsWin(false);
          return;
        }
      }
    }

    const nodes = [
      { id: 'source', ...level.source, freq: 'ANY' },
      ...placedDevices.map((d, i) => ({ id: `dev_${i}`, ...d })),
      { id: 'dest', ...level.destination, freq: 'ANY' }
    ];

    const edges = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const n1 = nodes[i];
        const n2 = nodes[j];
        
        let canConnect = false;
        let connectionFreq = null;
        if (n1.id === 'source' || n2.id === 'source' || n1.id === 'dest' || n2.id === 'dest') {
            canConnect = true;
            connectionFreq = (n1.freq !== 'ANY') ? n1.freq : ((n2.freq !== 'ANY') ? n2.freq : null);
        } else if (n1.freq === n2.freq) {
            canConnect = true;
            connectionFreq = n1.freq;
        }

        if (canConnect && checkVisibility(n1.x, n1.y, n2.x, n2.y, obstaclesSet, level.jammers, connectionFreq)) {
            edges.push([n1.id, n2.id]);
        }
      }
    }

    const graph = {};
    nodes.forEach(n => graph[n.id] = []);
    edges.forEach(([u, v]) => {
      graph[u].push(v);
      graph[v].push(u);
    });

    const visited = new Set();
    const queue = ['source'];
    visited.add('source');
    
    while(queue.length > 0) {
      const curr = queue.shift();
      if (curr === 'dest') {
        const remainingPower = currentPowerBudget - placedDevices.length;
        let calculatedStars = 1;
        if (remainingPower >= 2 || placedDevices.length === 0) calculatedStars = 3;
        else if (remainingPower === 1) calculatedStars = 2;
        
        setStars(calculatedStars);
        setIsWin(true);
        setMessage("Connection Established!");
        setIsError(false);
        playWinSound();
        return;
      }
      for (let neighbor of graph[curr]) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    setIsWin(false);
  };

  const nextLevel = async () => {
    const nextIndex = currentLevelIndex + 1;
    setCurrentLevelIndex(nextIndex);
    
    if (user) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, { currentLevelIndex: nextIndex }, { merge: true });
      } catch (error) {
        console.error("Error saving level:", error);
      }
    }
  };

  const retryLevel = () => {
    setPlacedDevices([]);
    setIsWin(false);
  };

  if (authChecking) {
    return (
      <div className="app-container" style={{justifyContent: 'center', alignItems: 'center'}}>
        <div className="ribbon" style={{fontSize: '2rem'}}>Checking Login...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-container" style={{justifyContent: 'center', alignItems: 'center'}}>
        <div className="scoreboard-modal" style={{position: 'relative', transform: 'none', top: 'auto', left: 'auto', width: '400px', textAlign: 'center'}}>
          <div className="scoreboard-ribbon">NULL ZONE</div>
          <h2 style={{color: '#92400e', marginTop: '2rem', marginBottom: '1rem', fontSize: '1.5rem'}}>Welcome to Null Zone</h2>
          <p style={{color: '#a16207', marginBottom: '2rem', fontWeight: 'bold'}}>You must log in to play and save your progress!</p>
          <button className="btn green" style={{width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem', fontSize: '1.2rem'}} onClick={handleLogin}>
            <LogIn size={24} style={{marginRight: '10px'}} /> Login with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header>
        <div className="ribbon" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Radio size={32} color="#fef08a" />
          <span>NULL ZONE</span>
          <Target size={32} color="#fef08a" />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div className="level-indicator">Level {currentLevelIndex + 1}</div>
          
          <div className="auth-container">
              <div className="user-profile">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="user-avatar" />
                ) : (
                  <User size={24} color="#fff" />
                )}
                <span className="user-name">{user.displayName?.split(' ')[0]}</span>
                <button className="auth-btn logout" onClick={handleLogout} title="Logout">
                  <LogOut size={18} />
                </button>
              </div>
          </div>
        </div>
      </header>
      
      <div className="game-layout">
        <div className="board-container">
          <canvas 
            ref={canvasRef} 
            width={level.cols * TILE_SIZE} 
            height={level.rows * TILE_SIZE}
            onClick={handleCanvasClick}
          ></canvas>
          {isWin && (
            <div className="scoreboard-modal">
              <div className="scoreboard-ribbon">You Win</div>
              <div className="stars-container">
                <Star size={48} className={stars >= 1 ? "star filled" : "star empty"} fill={stars >= 1 ? "#eab308" : "none"} />
                <Star size={64} className={stars >= 2 ? "star filled main" : "star empty main"} fill={stars >= 2 ? "#eab308" : "none"} />
                <Star size={48} className={stars >= 3 ? "star filled" : "star empty"} fill={stars >= 3 ? "#eab308" : "none"} />
              </div>
              <div className="stats-container">
                <div className="stat-row">
                  <div className="stat-icon-wrapper blue"><Target size={20} color="#fff" /></div>
                  <div className="stat-bar">{placedDevices.length} / {currentPowerBudget} Devices</div>
                </div>
                <div className="stat-row">
                  <div className="stat-icon-wrapper teal"><Zap size={20} color="#fff" /></div>
                  <div className="stat-bar">{currentPowerBudget - placedDevices.length} Energy Left</div>
                </div>
              </div>
              <div className="buttons-container">
                <button className="circle-btn red" onClick={retryLevel}><RotateCcw size={28} /></button>
                <button className="circle-btn green" onClick={nextLevel}><Play size={32} /></button>
              </div>
            </div>
          )}
        </div>

        <div className="ui-panel casual-panel">
          <div className="stat-box">
            <h3><Zap size={20} className="inline mr-2 text-yellow-500" /> Energy</h3>
            <div className="value">
              {currentPowerBudget - placedDevices.length}
            </div>
          </div>

          <div className="stat-box">
            <h3><Radio size={20} className="inline mr-2 text-blue-500" /> Frequency</h3>
            <div className="frequency-selector">
              {Object.keys(FREQUENCIES).map(freq => (
                <button 
                  key={freq}
                  className={`freq-btn ${selectedFreq === freq ? 'active' : ''}`}
                  style={{ backgroundColor: FREQUENCIES[freq], color: '#fff' }}
                  onClick={() => setSelectedFreq(freq)}
                >
                  {freq.charAt(0)}
                </button>
              ))}
            </div>
          </div>

          <button className="btn red w-full mt-4" onClick={() => setPlacedDevices([])}>
            <RotateCcw size={18} /> Reset
          </button>

          <div className="suggestion-box mt-4 bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 text-yellow-300 opacity-20"><Lightbulb size={64}/></div>
            <h3 className="flex items-center text-yellow-700 font-bold mb-2">
              <Lightbulb size={20} className="mr-2" /> Suggestion
            </h3>
            
            {!hintUnlocked ? (
               <div className="flex flex-col gap-2">
                 <div className={`font-semibold text-gray-700 ${isError ? 'text-red-500' : ''}`}>
                    {isError && <AlertTriangle size={18} className="inline mr-1 -mt-1" />}
                    {message}
                 </div>
                 <button 
                   onClick={() => {
                     if (currentPowerBudget - placedDevices.length > 3) {
                       setPowerPenalty(3);
                       setHintUnlocked(true);
                       playHintSound();
                     } else {
                       setMessage("Not enough energy to unlock hint! Free up devices first.");
                       setIsError(true);
                       playErrorSound();
                     }
                   }}
                   className="mt-2 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold py-2 px-3 rounded-lg flex items-center justify-center transition-colors shadow-sm"
                 >
                   <Unlock size={16} className="mr-2" /> Unlock Hint (-3 Energy)
                 </button>
               </div>
            ) : (
               <div className="font-semibold text-gray-700 italic">
                 {generateDescriptiveHint(level)}
               </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
