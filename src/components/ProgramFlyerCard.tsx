/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Calendar, Clock, MapPin, Maximize2, Loader2, RefreshCw, AlertTriangle, Sparkles } from 'lucide-react';
import { ProgramItem } from '../types';
import { isProgramExpired } from '../lib/programs';

interface ProgramFlyerCardProps {
  program: ProgramItem;
  onSelectFlyer?: (program: ProgramItem) => void;
  showDetails?: boolean;
  className?: string;
}

export const ProgramFlyerCard: React.FC<ProgramFlyerCardProps> = ({
  program,
  onSelectFlyer,
  showDetails = true,
  className = ''
}) => {
  const expired = isProgramExpired(program.date);

  return (
    <div className={`group bg-white rounded-3xl overflow-hidden shadow-lg border border-gray-100 transition-all hover:shadow-2xl flex flex-col justify-between ${className}`}>
      <div>
        {/* Flyer Image or Expired Loading Indicator */}
        <div 
          onClick={() => onSelectFlyer && onSelectFlyer(program)}
          className="aspect-[4/5] relative overflow-hidden bg-[#1A1F3C] cursor-pointer group"
        >
          <img 
            src={program.imageUrl || '/flyer_lagos.jpg'} 
            alt={program.title} 
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${expired ? 'opacity-75 grayscale-[25%]' : ''}`}
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/flyer_lagos.jpg';
            }}
          />
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <span className="px-4 py-2.5 bg-[#F26522] text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-xl flex items-center space-x-2 transform translate-y-2 group-hover:translate-y-0 transition-all">
              <Maximize2 size={16} />
              <span>View Program Flyer</span>
            </span>
          </div>

          {/* Date / Status Badge */}
          <div className="absolute top-4 left-4 flex flex-col gap-1">
            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md ${
              expired ? 'bg-gray-800/90 text-gray-200 backdrop-blur-sm' : 'bg-[#F26522] text-white'
            }`}>
              {program.date}
            </span>
            {expired && (
              <span className="px-2.5 py-0.5 bg-amber-500 text-slate-950 text-[9px] font-black uppercase tracking-wider rounded-md w-max shadow">
                Past Event
              </span>
            )}
          </div>
        </div>

        {/* Program Details Section */}
        {showDetails && (
          <div className="p-6 md:p-8 space-y-4">
            <div className="flex justify-between items-start">
              <div className="inline-block px-3 py-1 bg-[#F26522]/10 text-[#F26522] text-[10px] font-black uppercase tracking-widest rounded">
                {program.title}
              </div>
              {expired ? (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[9px] font-black uppercase rounded">
                  Concluded
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase rounded flex items-center space-x-1">
                  <Sparkles size={10} className="text-emerald-600" />
                  <span>Upcoming</span>
                </span>
              )}
            </div>
            
            <div className="space-y-1">
              <h3 className="text-xl font-black text-[#1A1F3C] uppercase tracking-tight">{program.series || 'Back to Eden'}</h3>
              <p className="text-[#F26522] font-bold text-xs italic">{program.theme}</p>
            </div>

            <div className="pt-4 border-t border-gray-50 space-y-2 text-xs font-medium text-gray-500">
              <p className="flex items-center space-x-2">
                <Calendar className="w-3.5 h-3.5 text-[#F26522]" />
                <span className={expired ? 'text-gray-400' : 'text-gray-700 font-bold'}>{program.date}</span>
                {expired && <span className="text-amber-600 font-bold text-[10px]">(Concluded)</span>}
              </p>
              {program.time && (
                <p className="flex items-center space-x-2">
                  <Clock className="w-3.5 h-3.5 text-[#F26522]" />
                  <span>{program.time}</span>
                </p>
              )}
              {program.location && (
                <p className="flex items-center space-x-2">
                  <MapPin className="w-3.5 h-3.5 text-[#F26522]" />
                  <span className="line-clamp-1">{program.location}</span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="px-6 pb-6 md:px-8 md:pb-8">
        <button 
          onClick={() => {
            if (onSelectFlyer) onSelectFlyer(program);
          }}
          className={`w-full py-3.5 font-black uppercase tracking-widest text-[10px] rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer ${
            expired
              ? 'bg-gray-100 text-gray-700 hover:bg-[#1A1F3C] hover:text-white'
              : 'bg-[#1A1F3C] text-white hover:bg-[#F26522]'
          }`}
        >
          <Maximize2 size={14} />
          <span>{expired ? 'View Past Flyer' : 'View Program Flyer'}</span>
        </button>
      </div>
    </div>
  );
};
