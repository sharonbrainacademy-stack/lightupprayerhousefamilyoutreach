/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Shield, Target, History, Users, Globe, Flame } from 'lucide-react';

export default function About() {
  return (
    <div className="pb-24">
      {/* Header */}
      <section className="bg-[#1A1F3C] py-24 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
          <img 
            src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80" 
            alt="Worship" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-6xl font-black text-white mb-6 uppercase tracking-tight"
          >
            Our <span className="text-[#F26522]">Vision</span> & Purpose
          </motion.h1>
          <p className="text-gray-300 text-xl max-w-3xl mx-auto font-medium">
            Building a global family united by fire, prayer, and excellence for the glory of God.
          </p>
        </div>
      </section>

      {/* Goal Statement with Floral Frame */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 -mt-16 relative z-20">
        <div className="bg-white p-1 md:p-4 rounded-2xl shadow-2xl">
          <div className="border-[12px] border-double border-[#F26522]/20 rounded-xl p-12 text-center relative overflow-hidden group">
            {/* Decorative "Floral" Accents (Abstracted with CSS/Icons) */}
            <div className="absolute top-2 left-2 text-[#F26522]/30"><Flame size={48} /></div>
            <div className="absolute bottom-2 right-2 text-[#F26522]/30"><Flame size={48} /></div>
            
            <h2 className="text-sm font-black text-[#F26522] uppercase tracking-[0.5em] mb-8">Our Sacred Goal</h2>
            <p className="text-4xl md:text-5xl font-serif italic text-[#1A1F3C] leading-tight">
              "Heaven Is Our Goal. <br />
              As We Aspire For <span className="text-[#F26522]">Excellence</span>."
            </p>
            <div className="mt-8 w-24 h-1 bg-[#F26522] mx-auto rounded-full"></div>
          </div>
        </div>
      </section>

      {/* Mission, Vision, History */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              title: "Our Mission",
              icon: Target,
              text: "To ignite the fire of prayer in the hearts of believers worldwide, restoring spiritual authority and fostering transformation through the Word of God."
            },
            {
              title: "Our Vision",
              icon: Shield,
              text: "A world where every home is a prayer house, and every believer is equipped with the excellence of Christ to influence their generation."
            },
            {
              title: "Our History",
              icon: History,
              text: "Born out of a divine mandate, Light Up Prayer House began as a small prayer gathering that has now spread across 12 countries, touching thousands of lives through fire and prayer."
            }
          ].map((item, idx) => (
            <div key={idx} className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-gray-100 space-y-4">
              <div className="bg-[#1A1F3C] w-14 h-14 rounded-xl flex items-center justify-center text-[#F26522] mb-4">
                <item.icon size={28} />
              </div>
              <h3 className="text-2xl font-black text-[#1A1F3C]">{item.title}</h3>
              <p className="text-gray-600 leading-relaxed font-medium">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Global Reach Map placeholder */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <div className="space-y-4 mb-16">
          <h2 className="text-4xl font-black text-[#1A1F3C]">Connecting the Continents</h2>
          <p className="text-gray-500 font-medium">Spreading the fire of prayer across 12 countries and counting.</p>
        </div>
        <div className="bg-[#1A1F3C] rounded-3xl p-12 aspect-[2/1] relative flex items-center justify-center overflow-hidden">
          <Globe className="w-64 h-64 text-white opacity-5 absolute animate-spin-slow" />
          <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-8">
            {['Nigeria', 'United Kingdom', 'USA', 'Canada', 'Netherlands', 'Germany', 'Italy', 'Trinidad'].map(country => (
              <div key={country} className="flex items-center space-x-2 text-white font-bold">
                <div className="w-2 h-2 rounded-full bg-[#F26522]"></div>
                <span>{country}</span>
              </div>
            ))}
            <div className="col-span-full mt-8">
              <span className="text-[#F26522] font-black italic">+ 4 More Nations</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
