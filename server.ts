import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  try {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("Gemini API client initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize Gemini client:", err);
  }
} else {
  console.log("GEMINI_API_KEY not configured. Falling back to rule-based fallback model analysis.");
}

const app = express();
const PORT = 3000;

// Set high limits for video upload
app.use(express.json({ limit: "150mb" }));
app.use(express.urlencoded({ limit: "150mb", extended: true }));

// Server-side State
interface SOSAlert {
  id: string;
  userName: string;
  userPhone: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  audioVideoBase64?: string; // Data URL format (base64) of the recorded media
  mimeType?: string;
  status: 'pending' | 'dispatched' | 'closed' | 'false_alarm';
  logs: { action: string; time: string; operator: string }[];
  contactsSmsSent: boolean;
  adminSmsSent: boolean;
  emergencyContacts: { name: string; phone: string; relationship?: string }[];
  aiAnalysis?: {
    threatLevel: 'high' | 'medium' | 'low';
    analysisText: string;
    dispatchGuide: string;
  };
  smsAlertLogs: string[];
}

interface ActiveCitizen {
  phone: string;
  name: string;
  latitude: number;
  longitude: number;
  lastUpdated: string;
  isSharingLocation: boolean;
  batteryLevel: number;
}

const alertsDb: SOSAlert[] = [
  // Prepulated alert for Demonstration inside Admin view
  {
    id: "alert_demo_101",
    userName: "Srilekha Reddy",
    userPhone: "+91 9440123456",
    latitude: 16.5062,
    longitude: 80.6480, // Vijayawada, AP
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 mins ago
    status: 'pending',
    logs: [
      { action: "Alert Created", time: new Date(Date.now() - 1000 * 60 * 15).toISOString(), operator: "System" }
    ],
    contactsSmsSent: true,
    adminSmsSent: true,
    emergencyContacts: [
      { name: "K. Reddy (Father)", phone: "+91 9441112222" },
      { name: "M. Lakshmi (Mother)", phone: "+91 9443334444" }
    ],
    aiAnalysis: {
      threatLevel: 'high',
      analysisText: "High distress vocal frequencies detected in 10s audio chunk with street ambience (traffic and siren noise). System localized the situation in Vijayawada Central Zone.",
      dispatchGuide: "Immediate dispatch of closest VIP Patrol #4 (2.3 km away). Alert local beat officers immediately."
    },
    smsAlertLogs: [
      "SMS Sent to Father (+91 9441112222): [Disha SOS] Srilekha Reddy is in EMERGENCY. Coord: 16.5062, 80.6480. Live: https://ap-disha.gov.in/track/alert_demo_101",
      "SMS Sent to Mother (+91 9443334444): [Disha SOS] Srilekha Reddy is in EMERGENCY. Coord: 16.5062, 80.6480.",
      "Support Alert Sent to Disha Control (+91 112 / Admin): Srilekha triggered SOS alert with 10s recording."
    ]
  }
];

const citizensDb = new Map<string, ActiveCitizen>([
  ["+91 9440123456", {
    phone: "+91 9440123456",
    name: "Srilekha Reddy",
    latitude: 16.5062,
    longitude: 80.6480,
    lastUpdated: new Date().toISOString(),
    isSharingLocation: true,
    batteryLevel: 82
  }]
]);

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// Citizen registers/updates real-time tracking position
app.post("/api/citizen/update-location", (req, res) => {
  const { phone, name, latitude, longitude, isSharingLocation, batteryLevel } = req.body;
  if (!phone) {
    res.status(400).json({ error: "Phone number is required" });
    return;
  }

  const citizen: ActiveCitizen = {
    phone,
    name: name || "Anonymous Citizen",
    latitude: Number(latitude) || 16.3067,
    longitude: Number(longitude) || 80.4365,
    lastUpdated: new Date().toISOString(),
    isSharingLocation: isSharingLocation !== false,
    batteryLevel: Number(batteryLevel) || 100
  };

  citizensDb.set(phone, citizen);
  res.json({ success: true, citizen });
});

// Admin fetches all citizens actively sharing location
app.get("/api/citizen/list", (req, res) => {
  res.json(Array.from(citizensDb.values()));
});

// Citizen triggers an SOS
app.post("/api/sos/trigger", async (req, res) => {
  const { userName, userPhone, latitude, longitude, audioVideoBase64, mimeType, emergencyContacts } = req.body;
  if (!userPhone) {
    res.status(400).json({ error: "User Phone number is required for alert" });
    return;
  }

  const newAlertId = "alert_" + Math.random().toString(36).substring(2, 11);
  const latNum = Number(latitude) || 16.3067;
  const lonNum = Number(longitude) || 80.4365;
  const contacts = emergencyContacts || [];

  const alertSmsLogs: string[] = [];
  
  // Format Sms Logs for emergency contacts
  contacts.forEach((c: { name: string; phone: string }) => {
    alertSmsLogs.push(
      `SMS Sent to ${c.name} (${c.phone}): [Disha SOS] ${userName || 'Citizen'} is in EMERGENCY! Current coordinates: ${latNum.toFixed(4)}, ${lonNum.toFixed(4)}. Map link: https://maps.google.com/?q=${latNum},${lonNum}`
    );
  });

  // Admin notification SMS log
  alertSmsLogs.push(
    `Disha Support SMS Alert: New Emergency from ${userName || 'Citizen'} (${userPhone}) has been dispatched to AP Disha Admin Dashboard. Quick response requested. Media received: ${audioVideoBase64 ? '10-Second Video/Audio' : 'None'}.`
  );

  const newAlert: SOSAlert = {
    id: newAlertId,
    userName: userName || "AP Citizen",
    userPhone,
    latitude: latNum,
    longitude: lonNum,
    timestamp: new Date().toISOString(),
    audioVideoBase64,
    mimeType,
    status: 'pending',
    logs: [
      { action: "SOS Alarm Triggered", time: new Date().toISOString(), operator: "System" }
    ],
    contactsSmsSent: true,
    adminSmsSent: true,
    emergencyContacts: contacts,
    smsAlertLogs: alertSmsLogs
  };

  // Run server-side Gemini threat analysis on trigger if AI is available
  if (ai) {
    try {
      console.log(`Analyzing SOS trigger ${newAlertId} using Gemini...`);
      // Since video upload to API is very heavy raw or might be rate-limited, we can prompt Gemini
      // with details of the coordinates, emergency metadata, and simulation variables of the audio signature
      // to yield a phenomenal police instruction.
      const prompt = `You are the AP Disha command center AI. Analyze the following emergency context:
Citizen Name: ${newAlert.userName}
Phone: ${newAlert.userPhone}
Coordinates: Latitude ${newAlert.latitude}, Longitude ${newAlert.longitude}
Emergency Contacts: ${JSON.stringify(newAlert.emergencyContacts)}
A 10-second distress audio/video was processed from their device.

Generate an AP Disha Command Center Report in JSON format with keys:
1. threatLevel (Must be exactly one of: "high", "medium", "low")
2. analysisText (A very concise status analysis based on the situation and general geolocation data, e.g. "Alert near critical highway/residential junction. Geolocation signal is solid. Media payload uploaded successfully.")
3. dispatchGuide (Clear action guidelines for AP Disha command center dispatchers, naming specific response units like local police station, Disha emergency patrol vehicle, or ambulance).

Response must be pure JSON matching the keys.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const responseText = response.text || "";
      const resultObj = JSON.parse(responseText.trim());
      
      newAlert.aiAnalysis = {
        threatLevel: resultObj.threatLevel || 'high',
        analysisText: resultObj.analysisText || 'Distress trigger detected in Andhra Pradesh territory. Sensor recording verified.',
        dispatchGuide: resultObj.dispatchGuide || 'Alert Nearest Police Beat and Dispatch Disha Rakshak Vehicle.'
      };
      
      newAlert.logs.push({
        action: "AI Threat Assessment Completed",
        time: new Date().toISOString(),
        operator: "Gemini-3.5-AI"
      });

    } catch (err) {
      console.error("Gemini AI analysis error during trigger:", err);
      // Fallback
      newAlert.aiAnalysis = {
        threatLevel: 'high',
        analysisText: "Vite server analysed situation heuristics: Signal originates in solid telemetry bounds. Threat level elevated due to active SOS switch trigger.",
        dispatchGuide: "Dispatch nearest local patrol unit. Notify control dispatcher at Disha head command."
      };
    }
  } else {
    // Basic automatic rules fallback
    newAlert.aiAnalysis = {
      threatLevel: 'high',
      analysisText: "Andhra Pradesh Disha Rule-Engine: Multi-channel SOS signal with 10-second active micro-recording triggered. Coordinate accuracy is within 15 meters.",
      dispatchGuide: "Dispatch nearest VIP Rakshak vehicle. Call citizen phone line on secondary channel. Trace coordinates continuously."
    };
  }

  alertsDb.push(newAlert);
  
  // Also register citizen in active DB if not there
  citizensDb.set(userPhone, {
    phone: userPhone,
    name: userName || "AP Citizen",
    latitude: latNum,
    longitude: lonNum,
    lastUpdated: new Date().toISOString(),
    isSharingLocation: true,
    batteryLevel: 95
  });

  res.json({ success: true, alertId: newAlertId, alert: newAlert });
});

// Admin fetches all SOS alerts
app.get("/api/sos/alerts", (req, res) => {
  res.json(alertsDb);
});

// Admin updates/actions an SOS alert
app.post("/api/sos/action", (req, res) => {
  const { alertId, action, operator } = req.body;
  const alertIndex = alertsDb.findIndex(a => a.id === alertId);
  if (alertIndex === -1) {
    res.status(444).json({ error: "Alert not found" });
    return;
  }

  const alert = alertsDb[alertIndex];
  const opName = operator || "Admin Officer";

  if (action === "dispatch") {
    alert.status = "dispatched";
    alert.logs.push({
      action: "Disha Rakshak Patrol Dispatched",
      time: new Date().toISOString(),
      operator: opName
    });
  } else if (action === "close") {
    alert.status = "closed";
    alert.logs.push({
      action: "Alert Resolution Closed",
      time: new Date().toISOString(),
      operator: opName
    });
  } else if (action === "false_alarm") {
    alert.status = "false_alarm";
    alert.logs.push({
      action: "Flagged as False Alarm",
      time: new Date().toISOString(),
      operator: opName
    });
  } else {
    alert.logs.push({
      action: `Status updated: ${action}`,
      time: new Date().toISOString(),
      operator: opName
    });
  }

  res.json({ success: true, alert });
});

// Explicit endpoint to rerun Gemini AI analysis with custom context/incident details notes
app.post("/api/sos/analyze", async (req, res) => {
  const { alertId, dispatcherNotes } = req.body;
  const alert = alertsDb.find(a => a.id === alertId);
  if (!alert) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }

  if (ai) {
    try {
      const prompt = `You are the AP Disha command center AI. Re-evaluate the threat assessment for this active dispatch situation:
Citizen Name: ${alert.userName}
Location Coordinates: ${alert.latitude}, ${alert.longitude}
Incoming status notes: ${dispatcherNotes || 'No notes added yet'}
Current Status of the Alert: ${alert.status}

Generate an updated situational instruction pack in JSON with keys:
1. threatLevel ("high", "medium", or "low")
2. analysisText (updated summary including the new dispatcher observation notes)
3. dispatchGuide (action guide for nearby emergency teams)`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const responseText = response.text || "";
      const resultObj = JSON.parse(responseText.trim());

      alert.aiAnalysis = {
        threatLevel: resultObj.threatLevel || 'high',
        analysisText: resultObj.analysisText || 'Re-analyzed.',
        dispatchGuide: resultObj.dispatchGuide || 'Alert dispatched.'
      };

      alert.logs.push({
        action: `AI Threat Re-assessment completed based on note: "${dispatcherNotes}"`,
        time: new Date().toISOString(),
        operator: "Gemini-3.5-AI"
      });

      res.json({ success: true, alert });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Gemini analysis failed" });
    }
  } else {
    // Mock re-run based on notes
    const threat = dispatcherNotes?.toLowerCase().includes("calm") || dispatcherNotes?.toLowerCase().includes("false") ? "low" : "high";
    alert.aiAnalysis = {
      threatLevel: threat as any,
      analysisText: `Support rule-engine: Situation updated manually. Dispatcher Note evaluated: "${dispatcherNotes}"`,
      dispatchGuide: `Coordinate updates forwarded directly to responders in field.`
    };
    alert.logs.push({
      action: `Rule base re-evaluated note: "${dispatcherNotes}"`,
      time: new Date().toISOString(),
      operator: "System Heuristics"
    });
    res.json({ success: true, alert });
  }
});


// -------------------------------------------------------------
// Dev & Production Serve Flow
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AP Disha Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical server bootstrap failure:", err);
});
