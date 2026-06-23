import React, { useState, useEffect } from 'react';
import { MapPin, ZoomIn, ZoomOut, Compass, Navigation, RefreshCw } from 'lucide-react';
import { ANDHRA_DISTRICTS_COORD } from '../types';

interface MapPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'citizen' | 'alert_pending' | 'alert_dispatched' | 'alert_other';
  label?: string;
}

interface MapControlProps {
  centerLat: number;
  centerLng: number;
  points: MapPoint[];
  onMoveMap?: (lat: number, lng: number) => void;
  interactive?: boolean;
}

export default function MapControl({ centerLat, centerLng, points, onMoveMap, interactive = true }: MapControlProps) {
  const [zoom, setZoom] = useState(1);
  const [manualOffset, setManualOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [activeDistrict, setActiveDistrict] = useState("Vijayawada");

  // Base coordinates for mapping calculations (AP Central: Vijayawada range)
  const baseLat = 16.5062;
  const baseLng = 80.6480;

  // Conversion rates (approximate for pixel plotting)
  const latToY = (lat: number) => {
    const diff = lat - baseLat;
    return 200 - diff * 1100 * zoom + manualOffset.y;
  };

  const lngToX = (lng: number) => {
    const diff = lng - baseLng;
    return 250 + diff * 1100 * zoom + manualOffset.x;
  };

  const resetMap = () => {
    setZoom(1);
    setManualOffset({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!interactive) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - manualOffset.x, y: e.clientY - manualOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !interactive) return;
    setManualOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleQuickLocate = (cityName: string) => {
    const coord = ANDHRA_DISTRICTS_COORD[cityName];
    if (coord && onMoveMap) {
      setActiveDistrict(cityName);
      onMoveMap(coord.lat, coord.lng);
      setManualOffset({ x: 0, y: 0 });
    }
  };

  // Ensure active district aligns when external center changes
  useEffect(() => {
    const matched = Object.entries(ANDHRA_DISTRICTS_COORD).find(
      ([_, coord]) => Math.abs(coord.lat - centerLat) < 0.05 && Math.abs(coord.lng - centerLng) < 0.05
    );
    if (matched) {
      setActiveDistrict(matched[0]);
    }
  }, [centerLat, centerLng]);

  return (
    <div className="relative bg-emerald-950/20 rounded-2xl border border-emerald-900/40 p-1 overflow-hidden h-96 select-none shadow-inner" id="map-container">
      {/* Background Grid Pattern resembling actual HUD tracking maps */}
      <div 
        className="absolute inset-0 cursor-grab active:cursor-grabbing overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ backgroundImage: 'radial-gradient(#14532d 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }}
      >
        {/* SVG Drawing of Andhra Map contours & references */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {/* Compass radar loops around targeted coordinates */}
          <circle 
            cx={lngToX(centerLng)} 
            cy={latToY(centerLat)} 
            r={60 * zoom} 
            className="stroke-emerald-500/30 stroke-1 fill-none animate-pulse" 
          />
          <circle 
            cx={lngToX(centerLng)} 
            cy={latToY(centerLat)} 
            r={120 * zoom} 
            className="stroke-emerald-600/10 stroke-1 fill-none" 
          />

          {/* Reference Lines crossing at Target Center */}
          <line 
            x1={0} 
            y1={latToY(centerLat)} 
            x2={800} 
            y2={latToY(centerLat)} 
            className="stroke-emerald-500/10 stroke-1" 
          />
          <line 
            x1={lngToX(centerLng)} 
            y1={0} 
            x2={lngToX(centerLng)} 
            y2={600} 
            className="stroke-emerald-500/10 stroke-1" 
          />

          {/* Connecting lines between point and dispatch indicators */}
          {points.map((pt) => {
            if (pt.type.startsWith('alert_')) {
              return (
                <path
                  key={`line-${pt.id}`}
                  d={`M ${lngToX(centerLng)} ${latToY(centerLat)} L ${lngToX(pt.lng)} ${latToY(pt.lat)}`}
                  className="stroke-red-500/20 stroke-1 stroke-dasharray-[4,4] fill-none animate-[dash_10s_linear_infinite]"
                  style={{ strokeDasharray: '4 4' }}
                />
              );
            }
            return null;
          })}
        </svg>

        {/* Dynamic Map Pins plotted over coordinate conversions */}
        {points.map((pt) => {
          const x = lngToX(pt.lng);
          const y = latToY(pt.lat);

          const isMainTarget = Math.abs(pt.lat - centerLat) < 0.0001 && Math.abs(pt.lng - centerLng) < 0.0001;

          return (
            <div
              key={pt.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
              style={{ left: `${x}px`, top: `${y}px` }}
              id={`map-pin-${pt.id}`}
            >
              {pt.type === 'citizen' && (
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <span className="absolute inline-flex h-8 w-8 rounded-full bg-emerald-400 opacity-60 animate-ping" />
                    <div className="relative p-2 rounded-full bg-emerald-600 text-white border border-emerald-300 shadow-md">
                      <Navigation className="h-4 w-4 rotate-45 transform" />
                    </div>
                  </div>
                  <span className="mt-1 px-2 py-0.5 rounded bg-emerald-950/90 text-emerald-300 text-[10px] font-mono border border-emerald-800 tracking-tight shadow">
                    {pt.name} (Live)
                  </span>
                </div>
              )}

              {pt.type === 'alert_pending' && (
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <span className="absolute inline-flex h-10 w-10 rounded-full bg-red-500 opacity-75 animate-ping" />
                    <div className="relative p-2 rounded-full bg-red-600 text-white border-2 border-white shadow-xl">
                      <MapPin className="h-5 w-5 animate-bounce" />
                    </div>
                  </div>
                  <span className="mt-1 px-2 py-0.5 rounded bg-red-950 text-red-200 text-[10px] font-bold border border-red-700 tracking-tight shadow-md">
                    🚨 SOS: {pt.name}
                  </span>
                </div>
              )}

              {pt.type === 'alert_dispatched' && (
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <span className="absolute inline-flex h-8 w-8 rounded-full bg-amber-500 opacity-50 animate-pulse" />
                    <div className="relative p-2 rounded-full bg-amber-600 text-white border border-amber-300 shadow">
                      <MapPin className="h-4 w-4" />
                    </div>
                  </div>
                  <span className="mt-1 px-2 py-0.5 rounded bg-amber-950 text-amber-200 text-[10px] font-mono border border-amber-800 tracking-tight shadow">
                    🚨 PATROL DISPATCHED - {pt.name}
                  </span>
                </div>
              )}

              {pt.type === 'alert_other' && (
                <div className="flex flex-col items-center">
                  <div className="p-1.5 rounded-full bg-slate-600 text-white shadow">
                    <MapPin className="h-3 w-3" />
                  </div>
                  <span className="mt-0.5 px-1 py-0.5 rounded bg-slate-800 text-slate-300 text-[9px] font-sans">
                    {pt.name}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {/* Center Target Indicator HUD */}
        <div 
          className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: `${lngToX(centerLng)}px`, top: `${latToY(centerLat)}px` }}
        >
          <Compass className="h-10 w-10 text-emerald-400/40 animate-[spin_20s_linear_infinite]" />
        </div>
      </div>

      {/* Floating Controls */}
      <div className="absolute top-3 left-3 flex flex-col gap-1.5 p-1 rounded-xl bg-slate-900/95 border border-slate-800 shadow-xl" id="map-floating-controls">
        <button 
          onClick={() => setZoom(z => Math.min(z + 0.2, 3))}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button 
          onClick={() => setZoom(z => Math.max(z - 0.2, 0.4))}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button 
          onClick={resetMap}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors border-t border-slate-800"
          title="Recenter Map View"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="absolute bottom-3 left-3 bg-slate-900/95 border border-slate-800 rounded-xl px-2.5 py-1.5 text-[11px] font-mono text-emerald-400 shadow-xl" id="map-telemetry">
        <div className="font-bold border-b border-slate-800 pb-0.5 mb-1 text-slate-300">Target Coordinates</div>
        <div>LAT: {centerLat.toFixed(6)}</div>
        <div>LNG: {centerLng.toFixed(6)}</div>
      </div>

      {/* Quick District Location Switcher to test alerts across Andhra Pradesh */}
      <div className="absolute right-3 top-3 bottom-3 w-40 flex flex-col p-2 bg-slate-900/95 border border-slate-800 rounded-xl shadow-xl overflow-y-auto gap-1" id="map-district-selector">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 border-b border-slate-800 pb-1 px-1">AP Districts</span>
        {Object.keys(ANDHRA_DISTRICTS_COORD).map((city) => (
          <button
            key={city}
            onClick={() => handleQuickLocate(city)}
            className={`w-full text-left px-2 py-1 text-[11px] rounded transition-all flex justify-between items-center ${
              activeDistrict === city 
                ? 'bg-emerald-800/80 text-white font-medium shadow-sm' 
                : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
            }`}
          >
            <span>{city}</span>
            {activeDistrict === city && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
          </button>
        ))}
      </div>
    </div>
  );
}
