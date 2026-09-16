/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Mail, Phone, MapPin, Send, Share2, Camera, Video, MessageCircle } from 'lucide-react';

export default function Contact() {
  return (
    <div className="pb-24">
      {/* Header */}
      <section className="bg-[#1A1F3C] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <h1 className="text-5xl font-black text-white uppercase tracking-tight">Contact <span className="text-[#F26522]">Us</span></h1>
          <p className="text-gray-400 max-w-2xl mx-auto font-medium">
            Have a prayer request, inquiry, or suggestion? We're here to listen and pray with you.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
          {/* Left: Contact Info */}
          <div className="space-y-12">
            <div className="space-y-6">
              <h2 className="text-3xl font-black text-[#1A1F3C]">Get in Touch</h2>
              <p className="text-gray-600 text-lg font-medium leading-relaxed">
                Connect with our global coordination team. We operate across 12 countries and are ready to assist you.
              </p>
            </div>

            <div className="space-y-8">
              {[
                { icon: Phone, title: "Phone", detail: "+234 123 456 7890", sub: "Available 9am - 5pm WAT" },
                { icon: Mail, title: "Email", detail: "ligtupprayerhouse@gmail.com", sub: "We'll respond within 24 hours" },
                { icon: MapPin, title: "Global Head Office", detail: "Lagos, Nigeria", sub: "Serving believers in 12+ nations" },
                { icon: MessageCircle, title: "WhatsApp Communities", detail: "Members-Only Prayer Cells", sub: "Added by Admin upon registration" }
              ].map((item, idx) => (
                <div key={idx} className="flex items-start space-x-6 group">
                  <div className="bg-white p-4 rounded-2xl shadow-md text-[#F26522] group-hover:bg-[#F26522] group-hover:text-white transition-all">
                    <item.icon size={24} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-black text-[#1A1F3C] uppercase tracking-widest text-xs">{item.title}</h3>
                    <p className="text-lg font-bold text-[#1A1F3C]">{item.detail}</p>
                    <p className="text-sm text-gray-400 font-medium">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-8 border-t border-gray-100">
              <h3 className="text-sm font-black text-[#1A1F3C] uppercase tracking-widest mb-6">Follow Our Fire</h3>
              <div className="flex space-x-4">
                <a href="https://www.facebook.com/profile.php?id=61585056902769&mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" className="w-12 h-12 bg-white rounded-xl shadow-md flex items-center justify-center text-[#1A1F3C] hover:text-[#F26522] transition-colors">
                  <Share2 size={20} />
                </a>
                <a href="https://www.instagram.com/lightupprayerhousefamily" target="_blank" rel="noopener noreferrer" className="w-12 h-12 bg-white rounded-xl shadow-md flex items-center justify-center text-[#1A1F3C] hover:text-[#F26522] transition-colors">
                  <Camera size={20} />
                </a>
                <a href="https://www.youtube.com/@lightupprayerhouse" target="_blank" rel="noopener noreferrer" className="w-12 h-12 bg-white rounded-xl shadow-md flex items-center justify-center text-[#1A1F3C] hover:text-[#F26522] transition-colors">
                  <Video size={20} />
                </a>
              </div>
            </div>
          </div>

          {/* Right: Contact Form */}
          <div className="bg-white rounded-3xl shadow-2xl p-12 border border-gray-100">
            <h2 className="text-3xl font-black text-[#1A1F3C] mb-8">Send a Message</h2>
            <form className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">Your Name</label>
                  <input type="text" placeholder="Full Name" className="w-full px-6 py-4 rounded-xl border-2 border-gray-100 outline-none focus:border-[#F26522] font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">Email Address</label>
                  <input type="email" placeholder="email@example.com" className="w-full px-6 py-4 rounded-xl border-2 border-gray-100 outline-none focus:border-[#F26522] font-medium" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Subject</label>
                <input type="text" placeholder="How can we help?" className="w-full px-6 py-4 rounded-xl border-2 border-gray-100 outline-none focus:border-[#F26522] font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Message</label>
                <textarea 
                  placeholder="Type your message here..." 
                  className="w-full px-6 py-4 rounded-xl border-2 border-gray-100 outline-none focus:border-[#F26522] font-medium h-48"
                ></textarea>
              </div>
              <button className="w-full py-5 bg-[#1A1F3C] text-white rounded-2xl font-black uppercase tracking-[0.2em] flex items-center justify-center space-x-3 hover:bg-[#252b4d] transition-all shadow-xl">
                <span>Send Message</span>
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
