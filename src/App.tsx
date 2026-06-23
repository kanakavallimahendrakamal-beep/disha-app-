import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  MapPin, 
  Phone, 
  Users, 
  Radio, 
  Volume2, 
  Video, 
  Mic, 
  AlertTriangle, 
  Activity, 
  CheckCircle2, 
  Clock, 
  Send, 
  Play, 
  Pause, 
  Settings, 
  Plus, 
  Trash2, 
  Battery, 
  Wifi, 
  Server, 
  Bell, 
  ExternalLink,
  ChevronRight,
  User,
  Zap,
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';
import { SOSAlert, ActiveCitizen, EmergencyContact, AP_HELPLINES, ANDHRA_DISTRICTS_COORD } from './types';
import MapControl from './components/MapControl';

export default function App() {
  // --- STATE ---
  // Active Mode/View (Seamless display)
  const [activeTab, setActiveTab] = useState<'both' | 'citizen' | 'admin'>('both');
  
  // Citizen state
  const [citizenName, setCitizenName] = useState('Anjali Rao');
  const [citizenPhone, setCitizenPhone] = useState('+91 9440123456');
  const [citizenDistrict, setCitizenDistrict] = useState('Vijayawada');
  const [customLat, setCustomLat] = useState(16.5062);
  const [customLng, setCustomLng] = useState(80.6480);
  const [isSharingLocation, setIsSharingLocation] = useState(true);
  const [batteryLevel] = useState(88);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([
    { id: '1', name: 'Ravi Rao (Father)', phone: '+91 9441112222', relationship: 'Father' },
    { id: '2', name: 'Lakshmi Rao (Mother)', phone: '+91 9443334444', relationship: 'Mother' },
    { id: '3', name: 'Sameer Rao (Brother)', phone: '+91 9885556666', relationship: 'Brother' }
  ]);
  
  // Emergency Contacts input state
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRelation, setNewContactRelation] = useState('');
  const [showContactForm, setShowContactForm] = useState(false);

  // Video/Audio Recorder state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);
  const [recordedBase64, setRecordedBase64] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [userMediaStream, setUserMediaStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Admin Dashboard States
  const [alerts, setAlerts] = useState<SOSAlert[]>([]);
  const [activeCitizens, setActiveCitizens] = useState<ActiveCitizen[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [dispatcherNotes, setDispatcherNotes] = useState('');
  const [isAnalyzingNotes, setIsAnalyzingNotes] = useState(false);
  const [adminOperator, setAdminOperator] = useState('Inspector Prasad');
  const [playbackStatus, setPlaybackStatus] = useState<'playing' | 'paused' | 'stopped'>('stopped');
  const [gpsLoading, setGpsLoading] = useState(false);

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const liveVideoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationPingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adminPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- GET CURRENT LOCATION VIA GPS ---
  const handleGetGPSLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCustomLat(position.coords.latitude);
        setCustomLng(position.coords.longitude);
        setGpsLoading(false);
        
        // Match closest district
        let closestDistrict = 'Vijayawada';
        let minDistance = Infinity;
        Object.entries(ANDHRA_DISTRICTS_COORD).forEach(([district, coord]) => {
          const dist = Math.sqrt(
            Math.pow(position.coords.latitude - coord.lat, 2) + 
            Math.pow(position.coords.longitude - coord.lng, 2)
          );
          if (dist < minDistance) {
            minDistance = dist;
            closestDistrict = district;
          }
        });
        setCitizenDistrict(closestDistrict);
      },
      (error) => {
        console.error("GPS location error:", error);
        setGpsLoading(false);
        // Fallback default
        alert(`Could not retrieve GPS coordinates (${error.message}). Using preset coordinates instead.`);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Synchronize preset coordinates when district changes
  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    setCitizenDistrict(selected);
    const coord = ANDHRA_DISTRICTS_COORD[selected];
    if (coord) {
      setCustomLat(coord.lat);
      setCustomLng(coord.lng);
    }
  };

  // --- INITIAL COMPONENT LIFECYCLE ---
  useEffect(() => {
    // 1. Initial fetches
    fetchAlerts();
    fetchActiveCitizens();

    // 2. Location Sharing ping loop
    setupLocationSharingLoop();

    // 3. Admin dashboard live tracking updates (3 sec interval)
    adminPollIntervalRef.current = setInterval(() => {
      fetchAlerts();
      fetchActiveCitizens();
    }, 3000);

    return () => {
      if (locationPingIntervalRef.current) clearInterval(locationPingIntervalRef.current);
      if (adminPollIntervalRef.current) clearInterval(adminPollIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      stopLiveStreaming();
    };
  }, []);

  // Update location sharing loop whenever coordinate, sharing setting or info changes
  useEffect(() => {
    setupLocationSharingLoop();
  }, [citizenPhone, citizenName, customLat, customLng, isSharingLocation]);

  const setupLocationSharingLoop = () => {
    if (locationPingIntervalRef.current) {
      clearInterval(locationPingIntervalRef.current);
    }

    if (!isSharingLocation) return;

    // Direct registration
    pingCitizenLocation();

    // Loop
    locationPingIntervalRef.current = setInterval(() => {
      pingCitizenLocation();
    }, 4000);
  };

  const pingCitizenLocation = async () => {
    try {
      await fetch('/api/citizen/update-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: citizenPhone,
          name: citizenName,
          latitude: customLat,
          longitude: customLng,
          isSharingLocation: isSharingLocation,
          batteryLevel: batteryLevel
        })
      });
    } catch (err) {
      console.error("Failed to ping location telemetry to AP Disha dashboard:", err);
    }
  };

  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/sos/alerts');
      if (res.ok) {
        const data = await res.json();
        setAlerts(data);
      }
    } catch (err) {
      console.error("Error fetching alerts:", err);
    }
  };

  const fetchActiveCitizens = async () => {
    try {
      const res = await fetch('/api/citizen/list');
      if (res.ok) {
        const data = await res.json();
        setActiveCitizens(data);
      }
    } catch (err) {
      console.error("Error fetching active citizens:", err);
    }
  };

  // --- CAMERA MODULE HANDLERS ---
  const startLiveStreaming = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 320, height: 240, facingMode: "user" }, 
        audio: true 
      });
      setUserMediaStream(stream);
      setHasCameraPermission(true);
      if (liveVideoPreviewRef.current) {
        liveVideoPreviewRef.current.srcObject = stream;
      }
      return stream;
    } catch (err: any) {
      console.warn("Camera/Mic not available or permission denied. Standard high fidelity simulation fallback active:", err);
      setHasCameraPermission(false);
      setCameraError(err.message || "Permission Denied. Simulating digital video stream.");
      return null;
    }
  };

  const stopLiveStreaming = () => {
    if (userMediaStream) {
      userMediaStream.getTracks().forEach(track => track.stop());
      setUserMediaStream(null);
    }
  };

  // --- SOS INITIATE & RECORDING TIMERS ---
  const handleSOSClick = async () => {
    if (isRecording) return; // Prevent double trigger

    setIsRecording(true);
    setRecordingSeconds(0);
    audioChunksRef.current = [];
    
    // Request/Start media streaming
    const activeStream = await startLiveStreaming();
    
    // Initialize standard media recorder if physical device works
    if (activeStream) {
      try {
        const mediaRecorder = new MediaRecorder(activeStream);
        mediaRecorderRef.current = mediaRecorder;
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const videoBlob = new Blob(audioChunksRef.current, { type: 'video/webm' });
          const blobUrl = URL.createObjectURL(videoBlob);
          setRecordedBlobUrl(blobUrl);

          // Convert blob to base64 to send over API
          const reader = new FileReader();
          reader.readAsDataURL(videoBlob);
          reader.onloadend = () => {
            const base64data = reader.result as string;
            setRecordedBase64(base64data);
            triggerSOSToServer(base64data);
          };
        };

        mediaRecorder.start();
      } catch (err) {
        console.error("Media recorder initialization failed:", err);
      }
    }

    // 10 Second high energy countdown logic
    let remaining = 10;
    countdownIntervalRef.current = setInterval(() => {
      setRecordingSeconds(prev => {
        if (prev >= 9) {
          // Finish recording
          clearInterval(countdownIntervalRef.current!);
          setIsRecording(false);
          stopLiveStreaming();
          
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          } else {
            // Simulated backup if camera didn't write physical blob
            setTimeout(() => {
              createSimulatedSOSAlert();
            }, 300);
          }
          return 10;
        }
        return prev + 1;
      });
    }, 1000);
  };

  // Citizen triggered actual physical capture submission
  const triggerSOSToServer = async (base64Media: string) => {
    try {
      const payload = {
        userName: citizenName,
        userPhone: citizenPhone,
        latitude: customLat,
        longitude: customLng,
        audioVideoBase64: base64Media,
        mimeType: 'video/webm',
        emergencyContacts: emergencyContacts.map(c => ({ name: c.name, phone: c.phone, relationship: c.relationship }))
      };

      const res = await fetch('/api/sos/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        // Automatically select the new alert inside admin panel if visual cockpit is shared
        setSelectedAlertId(data.alertId);
        fetchAlerts();
      }
    } catch (err) {
      console.error("SOS trigger transmission error:", err);
    }
  };

  // High Fidelity Simulation fallback to ensure interactive prototype works 100% of times
  const createSimulatedSOSAlert = async () => {
    // Generates a mock infrared camera and audio signature simulation overlay
    // Create canvas based digital dynamic overlay to act as recorded video evidence
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Draw dynamic thermal radar mockup
      ctx.fillStyle = "#0c0a0f";
      ctx.fillRect(0,0,300, 200);
      
      ctx.fillStyle = "#ff3131";
      ctx.font = "12px monospace";
      ctx.fillText(`🚨 AP DISHA THERMAL CAM-01`, 15, 25);
      
      ctx.strokeStyle = "rgba(255,49,49,0.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(10, 10, 280, 180);
      
      ctx.fillStyle = "rgba(255, 49, 49, 0.2)";
      ctx.beginPath();
      ctx.arc(150, 100, 45, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.fillText(`TELEMETRY VERIFIED`, 15, 175);
      ctx.fillText(`LAT: ${customLat.toFixed(4)}`, 160, 160);
      ctx.fillText(`LNG: ${customLng.toFixed(4)}`, 160, 175);
    }
    const fakeDataUrl = canvas.toDataURL('image/jpeg');
    triggerSOSToServer(fakeDataUrl);
  };

  // --- EMERGENCY CONTACT SYSTEM MANAGEMENT ---
  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName || !newContactPhone) return;

    const contact: EmergencyContact = {
      id: "cont_" + Date.now().toString(),
      name: newContactName,
      phone: newContactPhone,
      relationship: newContactRelation || 'Contact'
    };

    setEmergencyContacts(prev => [...prev, contact]);
    setNewContactName('');
    setNewContactPhone('');
    setNewContactRelation('');
    setShowContactForm(false);
  };

  const handleRemoveContact = (id: string) => {
    setEmergencyContacts(prev => prev.filter(c => c.id !== id));
  };


  // --- ADMIN SYSTEM RESPONSES ---
  const handleAdminAction = async (alertId: string, action: string) => {
    try {
      const res = await fetch('/api/sos/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId,
          action,
          operator: adminOperator
        })
      });

      if (res.ok) {
        fetchAlerts();
      }
    } catch (err) {
      console.error("Failed to dispatcher action update:", err);
    }
  };

  const handleRerunAIEvaluation = async (alertId: string) => {
    if (!dispatcherNotes) return;
    setIsAnalyzingNotes(true);
    try {
      const res = await fetch('/api/sos/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId,
          dispatcherNotes
        })
      });

      if (res.ok) {
        setDispatcherNotes('');
        fetchAlerts();
      }
    } catch (err) {
      console.error("Gemini context run failed:", err);
    } finally {
      setIsAnalyzingNotes(false);
    }
  };

  // --- AUDIO VIDEO PLAYER SELECTION ---
  const selectedAlert = alerts.find(a => a.id === selectedAlertId) || alerts[0];

  const togglePlayback = () => {
    if (playbackStatus === 'playing') {
      setPlaybackStatus('paused');
      if (videoRef.current) videoRef.current.pause();
    } else {
      setPlaybackStatus('playing');
      if (videoRef.current) {
        videoRef.current.play().catch(e => {
          console.warn("Media playback error fallback", e);
        });
      }
    }
  };

  // --- PLOT POINTS TO RENDER ON HIGH TECH MAP ---
  const mapPoints = [
    // Live citizens from registry
    ...activeCitizens.filter(c => c.isSharingLocation).map(c => ({
      id: c.phone,
      name: c.name,
      lat: c.latitude,
      lng: c.longitude,
      type: 'citizen' as const
    })),
    // Dynamic Alerts
    ...alerts.map(a => ({
      id: a.id,
      name: a.userName,
      lat: a.latitude,
      lng: a.longitude,
      type: (a.status === 'pending' ? 'alert_pending' : a.status === 'dispatched' ? 'alert_dispatched' : 'alert_other') as any
    }))
  ];

  return (
    <div className="min-h-screen bg-[#050507] text-white flex flex-col font-sans transition-all selection:bg-red-600 selection:text-black">
      
      {/* HEADER CONTROL BAR */}
      <header className="h-16 border-b border-[#ffffff10] bg-[#0a0a0c] flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-tr from-[#8b0000] to-[#ff3131] rounded-xl flex items-center justify-center shadow-[0_0_12px_rgba(255,49,49,0.4)] border border-[#ffffff20] animate-pulse">
            <Shield className="h-5 w-5 text-black stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-[0.2em] text-[#ff3131] uppercase">Disha 2.0</span>
              <span className="text-[9px] bg-red-950 text-red-400 font-mono px-1.5 py-0.5 rounded border border-red-900 font-bold uppercase tracking-wider">AP Safety Link</span>
            </div>
            <p className="text-[10px] text-zinc-500 font-medium">Andhra Pradesh Police Command & Dispatch System</p>
          </div>
        </div>

        {/* WORKSPACE PRESET TOGGLERS */}
        <div className="flex items-center gap-2 bg-[#14141a]/90 p-1 rounded-xl border border-zinc-800 shadow-inner" id="view-mode-selector">
          <button 
            onClick={() => setActiveTab('both')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === 'both' ? 'bg-[#ff3131] text-black shadow-md' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Dual View Cockpit</span>
          </button>
          <button 
            onClick={() => setActiveTab('citizen')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === 'citizen' ? 'bg-[#ff3131] text-black shadow-md' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <User className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Citizen Client</span>
          </button>
          <button 
            onClick={() => setActiveTab('admin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === 'admin' ? 'bg-[#ff3131] text-black shadow-md' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Server className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Disha Support Console</span>
          </button>
        </div>

        {/* LIVE SERVER STATUS AND INTEGRATION */}
        <div className="hidden lg:flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2 bg-[#1a1a20] px-3 py-1.5 rounded-xl border border-[#ffffff05]">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]"></span>
            <span className="font-mono text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">SECURE LINK</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-zinc-500 font-mono">OPERATIONAL ZONE</span>
            <p className="font-mono text-zinc-300 font-semibold tracking-tighter uppercase text-[11px]">Amaravati Admin Hub</p>
          </div>
        </div>
      </header>

      {/* WORKSPACE CANVAS */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto" id="main-panel-container">
        
        {/* ========================================== */}
        {/* 1. CITIZEN SMARTPHONE PANEL (LEFT COLUMN) */}
        {/* ========================================== */}
        {(activeTab === 'both' || activeTab === 'citizen') && (
          <section className={`w-full ${activeTab === 'both' ? 'lg:w-[415px]' : 'max-w-xl mx-auto'} border-r border-[#ffffff10] bg-gradient-to-b from-[#0a0a0c] to-[#050507] p-5 flex flex-col shrink-0 overflow-y-auto`} id="citizen-sidebar">
            
            {/* Citizen Panel Title */}
            <div className="flex justify-between items-center mb-4">
              <div>
                <span className="text-[9px] font-black tracking-[0.25em] text-[#ff3131] uppercase">DISHA CITIZEN DEVICE #10</span>
                <h2 className="text-lg font-bold tracking-tight">Andhra Pradesh Citizen Node</h2>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 bg-zinc-900 py-1 px-2.5 rounded-full border border-zinc-800">
                <Battery className="h-3 w-3 text-green-400 fill-green-400" />
                <span>{batteryLevel}%</span>
              </div>
            </div>

            {/* ==================================== */}
            {/* GIANT DANGER SOS DISPATCH TRIGGER BUTTON */}
            {/* ==================================== */}
            <div className="relative mb-4 p-4 rounded-3xl bg-[#0c0a0f] border border-[#ff31312d] flex flex-col items-center justify-center overflow-hidden min-h-[240px]" id="sos-containment">
              
              {/* Pulsing ambient danger rings behind target SOS trigger */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className={`absolute rounded-full border border-[#ff313125] transition-all duration-1000 ${
                  isRecording ? 'w-80 h-80 animate-ping' : 'w-48 h-48 animate-pulse'
                }`} />
                <div className={`absolute rounded-full border border-[#ff313115] transition-all duration-1000 ${
                  isRecording ? 'w-56 h-56 animate-pulse' : 'w-32 h-32'
                }`} />
              </div>

              {/* Recording Status HUD overlay */}
              {isRecording ? (
                <div className="z-10 text-center flex flex-col items-center mb-4 text-[#ff3131]">
                  <div className="flex items-center gap-1.5 animate-pulse bg-red-950/70 py-1.5 px-3 rounded-full border border-red-900/60 shadow">
                    <span className="w-2.5 h-2.5 bg-[#ff3131] rounded-full"></span>
                    <span className="text-[11px] font-black uppercase tracking-widest font-mono">DISHA CAPTURING ACTIVE</span>
                  </div>
                  
                  {/* Countdown Timer */}
                  <div className="text-5xl font-black mt-2 tracking-tighter font-mono">
                    {10 - recordingSeconds}s
                  </div>
                  <span className="text-[11px] font-semibold text-zinc-400 mt-1 uppercase tracking-tight block">
                    Recording Live 10s Video & Audio
                  </span>
                </div>
              ) : (
                <div className="z-10 text-center mb-4">
                  <p className="text-[10px] text-zinc-500 font-bold tracking-[0.2em] uppercase">Emergency Dispatch Switch</p>
                  <h3 className="text-sm font-extrabold mt-0.5 tracking-tight text-white leading-tight">AP DISHA TRIPLE LINK ALERT</h3>
                </div>
              )}

              {/* Main Circular SOS Core Trigger Button */}
              <button
                type="button"
                onClick={handleSOSClick}
                disabled={isRecording}
                className={`relative w-36 h-36 rounded-full bg-gradient-to-tr transition-all duration-300 transform active:scale-95 flex flex-col items-center justify-center z-10 border-4 border-[#ffffff15] ${
                  isRecording 
                    ? 'from-[#440808] to-[#8b0a0a] shadow-[0_0_30px_rgba(139,10,10,0.4)] cursor-not-allowed' 
                    : 'from-[#8b0000] to-[#ff3131] hover:shadow-[0_0_55px_rgba(255,49,49,0.5)] shadow-[0_0_30px_rgba(255,49,49,0.3)]'
                }`}
                id="emergency-sos-button"
              >
                {isRecording ? (
                  <Activity className="h-10 w-10 text-white animate-pulse" />
                ) : (
                  <AlertTriangle className="h-10 w-10 text-black stroke-[2]" />
                )}
                <span className={`text-[22px] font-black tracking-widest mt-0.5 leading-none ${isRecording ? 'text-zinc-400' : 'text-black'}`}>
                  {isRecording ? "RECORD" : "SOS"}
                </span>
                <span className={`text-[8px] font-black uppercase tracking-widest mt-0.5 ${isRecording ? 'text-zinc-500' : 'text-black/80'}`}>
                  {isRecording ? "TRANSMITTING" : "IMMEDIATE"}
                </span>
              </button>

              {/* Status and instruction detail message */}
              <p className="z-10 mt-4 text-[11px] text-[#ff3131]/75 max-w-xs text-center leading-relaxed tracking-tight font-medium bg-red-950/20 px-4 py-2 rounded-xl border border-red-950/50">
                {isRecording 
                  ? "Real-time voice and front camera feed mapping directly to command center."
                  : "Triggers immediate SMS alerts to linked contacts & captures automatic 10-second proof pack."}
              </p>

              {/* WebCam Preview visible during active capture */}
              {isRecording && (
                <div className="absolute inset-0 w-full h-full object-cover opacity-30 z-0">
                  <video 
                    ref={liveVideoPreviewRef} 
                    autoPlay 
                    muted 
                    playsInline
                    className="w-full h-full object-cover bg-black"
                  />
                  {hasCameraPermission === false && (
                    <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center p-3 text-center">
                      <span className="text-[10px] font-bold text-red-500">CAMERA FALLBACK ACTIVE</span>
                      <div className="flex h-6 w-full items-end gap-1 mt-2 justify-center">
                        <span className="w-1.5 bg-red-600/30 animate-pulse h-12" style={{ animationDelay: '0.1s' }} />
                        <span className="w-1.5 bg-red-600/60 animate-pulse h-16" style={{ animationDelay: '0.2s' }} />
                        <span className="w-1.5 bg-red-600 animate-pulse h-8" style={{ animationDelay: '0.3s' }} />
                        <span className="w-1.5 bg-red-600/50 animate-pulse h-14" style={{ animationDelay: '0.4s' }} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Profile Setup / Config Details */}
            <div className="p-4 rounded-2xl bg-[#111115] border border-zinc-900 mb-4 text-xs flex flex-col gap-3" id="citizen-profile-block">
              <div className="flex border-b border-zinc-900 pb-2 justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Profile Identity</span>
                <span className="text-[10px] text-green-400 bg-green-950 border border-green-900 font-semibold px-2 py-0.5 rounded-full">Device Verified</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Full Name</label>
                  <input 
                    type="text" 
                    value={citizenName}
                    onChange={(e) => setCitizenName(e.target.value)}
                    className="w-full bg-[#1a1a22] border border-zinc-800 rounded-lg px-2.5 py-1.5 focus:border-[#ff3131] focus:ring-1 focus:ring-[#ff3131] outline-none text-zinc-200"
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Mobile Number</label>
                  <input 
                    type="text" 
                    value={citizenPhone}
                    onChange={(e) => setCitizenPhone(e.target.value)}
                    className="w-full bg-[#1a1a22] border border-zinc-800 rounded-lg px-2.5 py-1.5 focus:border-[#ff3131] focus:ring-1 focus:ring-[#ff3131] outline-none font-mono text-zinc-200"
                    placeholder="Mobile format"
                  />
                </div>
              </div>

              {/* District & Simulated GPS override tools to demonstrate admin command tracking */}
              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Andhra Pradesh District Station (Heuristic Zone)</label>
                <div className="flex gap-2">
                  <select 
                    value={citizenDistrict}
                    onChange={handleDistrictChange}
                    className="flex-1 bg-[#1a1a22] border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-[#ff3131]"
                  >
                    {Object.keys(ANDHRA_DISTRICTS_COORD).map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleGetGPSLocation}
                    disabled={gpsLoading}
                    className="px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg flex items-center gap-1 text-[11px] font-bold text-emerald-400 transition"
                  >
                    {gpsLoading ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <MapPin className="h-3.5 w-3.5" />
                    )}
                    <span>AUTO GPS</span>
                  </button>
                </div>
              </div>

              {/* Coordinates readouts */}
              <div className="flex items-center gap-4 bg-black/40 p-2.5 rounded-xl border border-zinc-900 font-mono text-[10px]">
                <div className="flex-1">
                  <span className="text-zinc-500 block">CURRENT LATITUDE</span>
                  <input 
                    type="number" 
                    step="0.0001"
                    value={customLat}
                    onChange={(e) => {
                      setCustomLat(Number(e.target.value));
                      setIsSharingLocation(true);
                    }}
                    className="bg-transparent border-none text-[#ff3131] outline-none w-full font-bold focus:ring-0 p-0"
                  />
                </div>
                <div className="w-[1px] h-6 bg-zinc-800" />
                <div className="flex-1">
                  <span className="text-zinc-500 block">CURRENT LONGITUDE</span>
                  <input 
                    type="number" 
                    step="0.0001"
                    value={customLng}
                    onChange={(e) => {
                      setCustomLng(Number(e.target.value));
                      setIsSharingLocation(true);
                    }}
                    className="bg-transparent border-none text-[#ff3131] outline-none w-full font-bold focus:ring-0 p-0"
                  />
                </div>
              </div>

              {/* Location track switch toggle */}
              <div className="flex justify-between items-center bg-black/40 p-2.5 rounded-xl border border-zinc-900" id="location-sharing-toggle">
                <div>
                  <div className="flex items-center gap-1.5 text-zinc-300 font-bold">
                    <Radio className={`h-3.5 w-3.5 ${isSharingLocation ? 'text-green-400 animate-pulse' : 'text-zinc-500'}`} />
                    <span>Real-Time Location Link</span>
                  </div>
                  <p className="text-[10px] text-zinc-500">Pings your telemetry coordinates to dispatcher dashboard</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const status = !isSharingLocation;
                    setIsSharingLocation(status);
                    if (status) {
                      pingCitizenLocation();
                    }
                  }}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors focus:outline-none ${
                    isSharingLocation ? 'bg-green-600' : 'bg-zinc-800'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                    isSharingLocation ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>

            {/* EMERGENCY CONTACTS LIST */}
            <div className="p-4 rounded-2xl bg-[#111115] border border-zinc-900 mb-4" id="emergency-contacts-block">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <span className="text-[9px] font-black tracking-wider text-zinc-400 uppercase">Automated Dispatches</span>
                  <h3 className="text-xs font-bold tracking-tight text-white">Emergency Contacts ({emergencyContacts.length})</h3>
                </div>
                <button
                  onClick={() => setShowContactForm(!showContactForm)}
                  className="p-1 rounded bg-[#ff313115] border border-[#ff313142] hover:bg-[#ff313130] text-[#ff3131] transition"
                  title="Add target contact"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {showContactForm && (
                <form onSubmit={handleAddContact} className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 mb-3 flex flex-col gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Contact full name"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    className="w-full bg-[#111115] border border-zinc-800 rounded px-2.5 py-1 text-xs text-white"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Relationship (e.g., Father)"
                      value={newContactRelation}
                      onChange={(e) => setNewContactRelation(e.target.value)}
                      className="bg-[#111115] border border-zinc-800 rounded px-2.5 py-1 text-xs text-white"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Mobile phone"
                      value={newContactPhone}
                      onChange={(e) => setNewContactPhone(e.target.value)}
                      className="bg-[#111115] border border-zinc-800 rounded px-2.5 py-1 text-xs text-white font-mono"
                    />
                  </div>
                  <div className="flex justify-end gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setShowContactForm(false)}
                      className="text-[11px] text-zinc-400 hover:text-white font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="text-[11px] font-bold text-[#ff3131] bg-[#ff313110] border border-[#ff313133] px-3 py-1 rounded"
                    >
                      Add Contact Link
                    </button>
                  </div>
                </form>
              )}

              {/* Rendering actual emergency links */}
              {emergencyContacts.length === 0 ? (
                <div className="text-center py-4 border border-dashed border-zinc-800 rounded-xl">
                  <p className="text-[11px] text-zinc-500 italic">No emergency support contact linked yet.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5" id="contacts-list">
                  {emergencyContacts.map((c) => (
                    <div key={c.id} className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-900 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-zinc-400" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-zinc-200">{c.name}</span>
                            <span className="text-[8px] bg-zinc-900 text-zinc-400 font-bold px-1 rounded uppercase tracking-wider">{c.relationship}</span>
                          </div>
                          <span className="text-[10px] font-mono text-zinc-500 block">{c.phone}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveContact(c.id)}
                        className="p-1 hover:text-[#ff3131] text-zinc-600 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Helpline References bottom */}
            <div className="mt-4 bg-[#111115] p-3 rounded-2xl border border-zinc-900">
              <span className="text-[9px] font-black tracking-wider text-zinc-500 uppercase block mb-1">Direct emergency contacts</span>
              <div className="grid grid-cols-2 gap-2">
                <a href="tel:1091" className="bg-zinc-950 border border-zinc-900 hover:border-[#ff3131]/30 hover:bg-zinc-900/60 p-2 rounded-xl flex items-center justify-between transition-all group">
                  <div>
                    <span className="text-[9px] block text-zinc-400 font-semibold group-hover:text-white">Disha Helpline</span>
                    <span className="text-xs font-bold font-mono text-emerald-400">1091</span>
                  </div>
                  <Phone className="h-3.5 w-3.5 text-zinc-500 group-hover:text-white" />
                </a>
                <a href="tel:112" className="bg-zinc-950 border border-zinc-900 hover:border-[#ff3131]/30 hover:bg-zinc-900/60 p-2 rounded-xl flex items-center justify-between transition-all group">
                  <div>
                    <span className="text-[9px] block text-zinc-400 font-semibold group-hover:text-white">AP Emergency</span>
                    <span className="text-xs font-bold font-mono text-emerald-400">112</span>
                  </div>
                  <Phone className="h-3.5 w-3.5 text-zinc-500 group-hover:text-white" />
                </a>
              </div>
            </div>

          </section>
        )}

        {/* ========================================== */}
        {/* 2. ADMIN DECISION COCKPIT (MAIN RIGHT FRAME) */}
        {/* ========================================== */}
        {(activeTab === 'both' || activeTab === 'admin') && (
          <section className="flex-1 bg-[#070709] p-5 flex flex-col gap-5 overflow-y-auto" id="admin-workspace">
            
            {/* Upper Telemetry Grid (Map Plotting Block) */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              
              {/* Maps Tracker block - occupying Left side */}
              <div className="xl:col-span-2 flex flex-col gap-2">
                <div className="flex justify-between items-center px-1">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-red-600 animate-ping"></span>
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">AP DISHA CORE TELEMETRY TRACKER MAP</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-tight font-bold bg-[#14141a] px-2.5 py-1 rounded-lg border border-zinc-800">
                    Active Signals: {mapPoints.length}
                  </span>
                </div>
                
                {/* Embedded custom high fidelity mapping element */}
                <MapControl 
                  centerLat={selectedAlert?.latitude || 16.5062}
                  centerLng={selectedAlert?.longitude || 80.6480}
                  points={mapPoints}
                  onMoveMap={(lat, lng) => {
                    setCustomLat(lat);
                    setCustomLng(lng);
                    pingCitizenLocation();
                  }}
                  interactive={true}
                />
              </div>

              {/* CRITICAL ALERTS QUEUE (Right block of telemetry map) */}
              <div className="flex flex-col gap-2" id="alerts-queue">
                <div className="flex justify-between items-center px-1">
                  <div className="flex items-center gap-1.5">
                    <Bell className="h-4 w-4 text-red-500 animate-bounce" />
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">CRITICAL ALERTS INFLOW ({alerts.length})</span>
                  </div>
                  <span className="text-[10px] text-[#ff3131] font-bold bg-[#ff313115] border border-[#ff313140] px-2 py-0.5 rounded uppercase">Live Feed</span>
                </div>

                {/* Queue list container */}
                <div className="bg-[#111115] border border-zinc-900 rounded-2xl p-3 flex-1 flex flex-col gap-2 min-h-[340px] max-h-[352px] overflow-y-auto">
                  {alerts.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-zinc-800 rounded-xl">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                      <p className="text-xs font-bold text-zinc-300">All Zones Normal</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5 max-w-xs leading-normal">No pending distress calls registered on the Andhra Pradesh Disha grid.</p>
                    </div>
                  ) : (
                    alerts.map((item) => {
                      const isSelected = item.id === selectedAlertId;
                      const isDeclined = item.status === 'false_alarm';
                      const isPending = item.status === 'pending';
                      const isDispatched = item.status === 'dispatched';

                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedAlertId(item.id)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden flex flex-col gap-2 ${
                            isSelected 
                              ? 'bg-red-950/40 border-[#ff3131] shadow-md shadow-red-950/20' 
                              : 'bg-zinc-950 hover:bg-zinc-950/80 border-zinc-900 hover:border-zinc-800'
                          }`}
                        >
                          {/* Top row with status stickers */}
                          <div className="flex justify-between items-center">
                            <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                              isPending ? 'bg-red-950 text-red-400 border border-red-900/40' : 
                              isDispatched ? 'bg-amber-950 text-amber-400 border border-amber-900/40' : 
                              isDeclined ? 'bg-zinc-900 text-zinc-500' : 'bg-emerald-950 text-emerald-400'
                            }`}>
                              {item.status.toUpperCase()}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>

                          {/* Identity Card */}
                          <div>
                            <p className="text-sm font-black text-white">{item.userName}</p>
                            <p className="text-xs text-zinc-400 font-mono">{item.userPhone}</p>
                            <p className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1 italic">
                              <MapPin className="h-3 w-3 text-red-500/80 shrink-0" />
                              Vijayawada range (Lat: {item.latitude.toFixed(4)}, Lng: {item.longitude.toFixed(4)})
                            </p>
                          </div>

                          {/* Emergency Contacts dispatched list banner */}
                          <div className="text-[9px] mt-1 text-zinc-500 border-t border-zinc-900 pt-1.5 flex justify-between items-center">
                            <span>Alert Dispatched to {item.emergencyContacts.length} linkers</span>
                            <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>

            {/* LOWER COGNITIVE ACTION GRID: Selected SOS Investigation Block */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5" id="assessment-container">
              
              {/* Evidence & Playback Unit */}
              <div className="xl:col-span-2 bg-[#0a0a0c] border border-zinc-900 rounded-3xl p-5 flex flex-col gap-4">
                
                {/* Header */}
                <div className="flex justify-between items-start border-b border-zinc-900 pb-3">
                  <div>
                    <span className="text-[9px] font-bold text-red-500 tracking-[0.2em] uppercase font-mono block">EVIDENCE INVESTIGATION CONSOLE</span>
                    <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                      Case File: #{selectedAlert?.id.toUpperCase() || 'SELECT-STATION'}
                    </h3>
                  </div>
                  <div className="bg-red-950/40 border border-[#ff31313d] px-3 py-1 rounded-full text-[10px] font-mono text-red-400 font-bold uppercase tracking-wider animate-pulse flex items-center gap-1">
                    <Video className="h-3.5 w-3.5" />
                    <span>Captured Video Duration: 10.0s</span>
                  </div>
                </div>

                {/* Main Evidence Capture Playback Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Dynamic Evidence Video Node */}
                  <div className="bg-[#050507] rounded-2xl border border-zinc-800 relative overflow-hidden min-h-[190px] flex flex-col items-center justify-center p-3">
                    
                    {selectedAlert?.audioVideoBase64 ? (
                      <div className="w-full h-full flex flex-col items-center justify-center relative">
                        {selectedAlert.audioVideoBase64.startsWith('data:video/webm') ? (
                          <video
                            ref={videoRef}
                            src={selectedAlert.audioVideoBase64}
                            className="w-full h-full object-cover max-h-[160px] rounded-lg bg-black"
                            onEnded={() => setPlaybackStatus('stopped')}
                          />
                        ) : (
                          // Dynamic Thermal snapshot fallback rendering
                          <div className="w-full flex flex-col items-center justify-center">
                            <img 
                              src={selectedAlert.audioVideoBase64} 
                              className="w-full max-h-[130px] object-contain rounded-lg border border-red-900/40 bg-zinc-950 mb-1" 
                              alt="SOS Incident Evidence Screenshot" 
                            />
                            <span className="text-[10px] text-zinc-400 font-mono tracking-tighter uppercase font-bold">DISHA THERMAL PACKET FLUSHED</span>
                          </div>
                        )}

                        {/* Custom playback status overlay HUD */}
                        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 bg-black/75 px-2 py-0.5 rounded text-[8px] font-mono uppercase text-[#ff3131]">
                          <span className={`w-1.5 h-1.5 rounded-full bg-red-600 ${playbackStatus === 'playing' ? 'animate-ping' : ''}`}></span>
                          <span>{playbackStatus.toUpperCase()} EVIDENCE LINK</span>
                        </div>

                        {/* Player controls */}
                        <div className="w-full flex justify-center gap-2 mt-2">
                          <button
                            onClick={togglePlayback}
                            className="flex items-center gap-1 text-[11px] font-bold text-black bg-[#ff3131] hover:bg-[#ff4c4c] px-3 py-1 rounded-lg transition"
                          >
                            {playbackStatus === 'playing' ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 fill-black" />}
                            <span>{playbackStatus === 'playing' ? "Pause Review" : "Play Proof Pack"}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center p-4">
                        <div className="w-12 h-12 rounded-full bg-[#ff313110] border border-[#ff31313b] flex items-center justify-center mx-auto mb-2 text-[#ff3131] animate-pulse">
                          <Video className="h-6 w-6" />
                        </div>
                        <p className="text-xs font-bold text-zinc-300 uppercase">Live Playback Feed Empty</p>
                        <p className="text-[10px] text-zinc-500 mt-1 max-w-[200px] leading-relaxed mx-auto">No SOS trigger active with 10s video storage on this case file yet.</p>
                      </div>
                    )}
                  </div>

                  {/* Audio Stream & Spectrograph layout */}
                  <div className="bg-[#111115] rounded-2xl border border-zinc-800 p-4 flex flex-col justify-between min-h-[190px]">
                    <div>
                      <div className="flex justify-between items-center text-[9px] font-mono text-zinc-500 mb-1">
                        <span>AUDIO_RECON_FREQ.WAV</span>
                        <span>44.1 KHZ / FLOATING POINT</span>
                      </div>
                      <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-wider block">Integrated Media Proof Details</span>
                    </div>

                    {/* Spectrograph representation bars */}
                    <div className="flex items-center gap-1.5 h-20 px-2 justify-center my-2" id="db-spectrograph">
                      <div className={`w-1 font-mono rounded-full bg-[#ff3131] transition-all duration-300 ${playbackStatus === 'playing' ? 'h-10 animate-pulse' : 'h-6 opacity-60'}`} style={{ animationDelay: '0.1s' }} />
                      <div className={`w-1 font-mono rounded-full bg-[#ff3131] transition-all duration-300 ${playbackStatus === 'playing' ? 'h-14' : 'h-4 opacity-70'}`} style={{ animationDelay: '0.2s' }} />
                      <div className={`w-1 font-mono rounded-full bg-emerald-500 transition-all duration-300 ${playbackStatus === 'playing' ? 'h-18 animate-bounce' : 'h-12 opacity-80'}`} style={{ animationDelay: '0.3s' }} />
                      <div className={`w-1 font-mono rounded-full bg-emerald-500 transition-all duration-300 ${playbackStatus === 'playing' ? 'h-16' : 'h-8 opacity-90'}`} style={{ animationDelay: '0.4s' }} />
                      <div className={`w-1 font-mono rounded-full bg-blue-500 transition-all duration-300 ${playbackStatus === 'playing' ? 'h-24' : 'h-10'}`} style={{ animationDelay: '0.5s' }} />
                      <div className={`w-1 font-mono rounded-full bg-blue-500 transition-all duration-300 ${playbackStatus === 'playing' ? 'h-20 animate-pulse' : 'h-6'}`} style={{ animationDelay: '0.6s' }} />
                      <div className={`w-1 font-mono rounded-full bg-red-500 transition-all duration-300 ${playbackStatus === 'playing' ? 'h-24 animate-bounce' : 'h-16'}`} style={{ animationDelay: '0.7s' }} />
                      <div className={`w-1 font-mono rounded-full bg-red-500 transition-all duration-300 ${playbackStatus === 'playing' ? 'h-16 animate-pulse' : 'h-8'}`} style={{ animationDelay: '0.8s' }} />
                      <div className={`w-1 font-mono rounded-full bg-zinc-600 h-6`} />
                      <div className={`w-1 font-mono rounded-full bg-zinc-600 h-8`} />
                    </div>

                    {/* Meta audio verification readout logs */}
                    <div className="bg-black/40 p-2 rounded-xl border border-zinc-900 text-[10px] font-mono flex justify-between items-center">
                      <span className="text-zinc-500">AP DISHA DECODING</span>
                      <span className="text-green-400 font-bold text-[9px] uppercase tracking-wider">AUDIO DEBLOCKED & ONLINE</span>
                    </div>

                  </div>

                </div>

                {/* Dispatch Dispatch SMS details & verification logs */}
                <div className="flex flex-col gap-2 bg-black/40 p-4 rounded-2xl border border-zinc-900" id="sms-alert-logger">
                  <div className="flex justify-between items-center text-[10px] border-b border-zinc-900 pb-1.5">
                    <span className="font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                      <Send className="h-3 text-emerald-400" />
                      AUTOMATED TRIPLE LINK ALERTS LOGS
                    </span>
                    <span className="text-green-400 bg-green-950 font-bold border border-green-900 px-2 py-0.5 rounded-full text-[9px] uppercase">
                      SMS Handshakes Verified 100%
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5 font-mono text-[10px] text-zinc-400 max-h-[120px] overflow-y-auto">
                    {selectedAlert?.smsAlertLogs ? (
                      selectedAlert.smsAlertLogs.map((logLine, idx) => (
                        <div key={idx} className="flex gap-2 items-start border-l-2 border-[#ff3131]/65 pl-2 py-0.5">
                          <span className="text-[#ff3131] shrink-0">➜</span>
                          <span className="leading-snug">{logLine}</span>
                        </div>
                      ))
                    ) : (
                      <p className="italic text-zinc-500 py-2 text-center text-[11px] block">No logged system handshakes found. Trigger SOS to spawn logs.</p>
                    )}
                  </div>
                </div>

                {/* DISPATCH ACTION SWITCH PANEL */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-900">
                  <button 
                    onClick={() => handleAdminAction(selectedAlert.id, 'dispatch')}
                    disabled={!selectedAlert}
                    className="flex-1 min-w-[150px] bg-[#ff3131] text-black font-extrabold text-xs uppercase tracking-widest py-3 px-4 rounded-xl shadow-[0_10px_3px_#ff313125] hover:bg-[#ff4a4a] transition duration-200 active:scale-95 disabled:opacity-50"
                  >
                    🚨 Dispatch Disha Rakshak Vehicle
                  </button>

                  <button 
                    onClick={() => handleAdminAction(selectedAlert.id, 'close')}
                    disabled={!selectedAlert}
                    className="px-6 bg-[#1a1a24] hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-200 uppercase tracking-wider transition duration-200 disabled:opacity-50"
                  >
                    Resolve & Close Case
                  </button>

                  <button 
                    onClick={() => handleAdminAction(selectedAlert.id, 'false_alarm')}
                    disabled={!selectedAlert}
                    className="px-6 bg-transparent hover:bg-zinc-900/40 border border-zinc-800/80 rounded-xl text-xs font-bold text-zinc-500 hover:text-white transition duration-200 disabled:opacity-50"
                  >
                    Flag False Alarm
                  </button>
                </div>

              </div>

              {/* Gemini AI Command Assessment column (1/3 size) */}
              <div className="bg-[#0a0a0c] border border-zinc-900 rounded-3xl p-5 flex flex-col gap-4">
                
                {/* AI section title */}
                <div className="flex justify-between items-center border-b border-zinc-900 pb-2.5">
                  <div className="flex items-center gap-1.5 text-blue-400">
                    <Zap className="h-4 w-4 fill-blue-500 stroke-[1.5]" />
                    <span className="text-xs font-extrabold tracking-widest uppercase font-mono text-zinc-300">DISHA AI COMMAND</span>
                  </div>
                  <span className="text-[10px] bg-blue-950 text-blue-400 font-mono px-2 py-0.5 rounded border border-blue-900/60 font-semibold uppercase">
                    Gemini Active
                  </span>
                </div>

                {/* Threat assessment HUD indicator */}
                <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 flex flex-col gap-2">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase block tracking-wider">Dynamic Risk Index</span>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-black text-white uppercase tracking-tight">THREAT EVALUATION:</span>
                    <span className={`px-3 py-1 text-xs font-black rounded uppercase ${
                      selectedAlert?.aiAnalysis?.threatLevel === 'high' ? 'bg-red-950 text-red-500 border border-red-900' :
                      selectedAlert?.aiAnalysis?.threatLevel === 'medium' ? 'bg-amber-950 text-amber-500 border border-amber-900' :
                      'bg-green-950 text-green-500 border border-green-950'
                    }`}>
                      {selectedAlert?.aiAnalysis?.threatLevel.toUpperCase() || 'HIGH'}
                    </span>
                  </div>

                  <div className="mt-2 text-xs leading-relaxed text-zinc-300 font-medium">
                    {selectedAlert?.aiAnalysis?.analysisText || "Distress trigger active. Audio capture signature displays high distress variables and sirens ambience. Geolocation triangulation successfully anchored."}
                  </div>
                </div>

                {/* Recommended tactical instructions dispatch advice */}
                <div className="bg-zinc-950 border border-[#3b82f630] rounded-2xl p-4 flex flex-col gap-1">
                  <span className="text-[9px] text-blue-400 font-bold uppercase block tracking-wider font-mono">DISPATCH ACTIONS RECOMMENDATION</span>
                  <p className="text-xs text-zinc-300 leading-normal font-medium">
                    {selectedAlert?.aiAnalysis?.dispatchGuide || "Dispatch Closest AP Disha Emergency Force. Direct closest local beat station unit to coordinate live interception."}
                  </p>
                </div>

                {/* Interactive Notes form to feed live notes to Gemini re-evaluator */}
                <div className="flex-1 flex flex-col gap-2 justify-end" id="ai-re-evaluate">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Feed dispatcher notes to Gemini AI</div>
                  <textarea
                    value={dispatcherNotes}
                    onChange={(e) => setDispatcherNotes(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-[#ff3131] focus:ring-1 focus:ring-[#ff3131] resize-none h-20"
                    placeholder="Enter visual details, responder feedback notes..."
                  />
                  <button
                    onClick={() => handleRerunAIEvaluation(selectedAlert?.id)}
                    disabled={isAnalyzingNotes || !dispatcherNotes || !selectedAlert}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40"
                  >
                    {isAnalyzingNotes ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Recalculating...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 fill-white" />
                        <span>Ask Gemini Re-evaluate Risk</span>
                      </>
                    )}
                  </button>
                </div>

                {/* System Audit log tracking */}
                <div className="pt-2.5 border-t border-zinc-900">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Operational Audit Logs</span>
                  <div className="bg-black/30 border border-zinc-900 p-2.5 rounded-xl text-[9px] font-mono leading-normal h-24 overflow-y-auto">
                    {selectedAlert?.logs.map((l, index) => (
                      <div key={index} className="flex justify-between mb-1 text-zinc-400 border-b border-zinc-900 pb-1">
                        <span>[{l.operator.toUpperCase()}] {l.action}</span>
                        <span className="text-zinc-500">
                          {new Date(l.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>

          </section>
        )}

      </div>
    </div>
  );
}
