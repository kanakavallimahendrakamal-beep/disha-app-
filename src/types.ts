export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export interface SOSAlert {
  id: string;
  userName: string;
  userPhone: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  audioVideoBase64?: string;
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

export interface ActiveCitizen {
  phone: string;
  name: string;
  latitude: number;
  longitude: number;
  lastUpdated: string;
  isSharingLocation: boolean;
  batteryLevel: number;
}

export interface SafetyResource {
  title: string;
  subtitle: string;
  number: string;
  category: string;
}

export const AP_HELPLINES: SafetyResource[] = [
  { title: "Disha Police Support", subtitle: "24/7 dedicated response unit", number: "1091", category: "Police" },
  { title: "Women Helpline (AP)", subtitle: "Immediate counselling & rescue", number: "181", category: "Emergency" },
  { title: "General Emergency Service", subtitle: "Unified assistance team", number: "112", category: "Dispatch" },
  { title: "AP Cyber Crime Cell", subtitle: "Digital harassment safety", number: "1930", category: "Cyber" },
  { title: "Child Helpline", subtitle: "Juvenile safety & support link", number: "1098", category: "Emergency" }
];

export const ANDHRA_DISTRICTS_COORD: Record<string, { lat: number, lng: number }> = {
  "Vijayawada": { lat: 16.5062, lng: 80.6480 },
  "Visakhapatnam": { lat: 17.6868, lng: 83.2185 },
  "Guntur": { lat: 16.3067, lng: 80.4365 },
  "Tirupati": { lat: 13.6288, lng: 79.4192 },
  "Kurnool": { lat: 15.8281, lng: 78.0373 },
  "Nellore": { lat: 14.4426, lng: 79.9865 },
  "Kakinada": { lat: 16.9890, lng: 82.2475 },
  "Anantapur": { lat: 14.6819, lng: 77.6006 },
};
