/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Share2, X, BookOpen, Flame, Users, Cross, Heart, Zap, Check, ExternalLink } from 'lucide-react';
import { jsPDF } from 'jspdf';

const pillars = [
  {
    id: 1,
    title: "The Trinity",
    icon: "🤝",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    statement: "We believe in one true God, eternally existing in three equal persons: God the Father, God the Son (Jesus Christ), and God the Holy Spirit.",
    scriptures: [
      { ref: "Matthew 28:19", text: "Therefore go and make disciples of all nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit." },
      { ref: "Deuteronomy 6:4", text: "Hear, O Israel: The LORD our God, the LORD is one." },
      { ref: "2 Corinthians 13:14", text: "May the grace of the Lord Jesus Christ, and the love of God, and the fellowship of the Holy Spirit be with you all." }
    ]
  },
  {
    id: 2,
    title: "The Bible",
    icon: "📖",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    statement: "We believe the Holy Bible is fully inspired by God, infallible, and the final authority for all faith, teaching, and conduct.",
    scriptures: [
      { ref: "2 Timothy 3:16–17", text: "All Scripture is God-breathed and is useful for teaching, rebuking, correcting and training in righteousness, so that the servant of God may be thoroughly equipped for every good work." },
      { ref: "2 Peter 1:20–21", text: "Above all, you must understand that no prophecy of Scripture came about by the prophet’s own interpretation of things." },
      { ref: "Hebrews 4:12", text: "For the word of God is alive and active. Sharper than any double-edged sword, it penetrates even to dividing soul and spirit, joints and marrow; it judges the thoughts and attitudes of the heart." }
    ]
  },
  {
    id: 3,
    title: "The Holy Spirit",
    icon: "🔥",
    iconBg: "bg-orange-50",
    iconColor: "text-[#F26522]",
    statement: "We believe in the baptism of the Holy Spirit for every believer, with spiritual gifts and His ongoing power, guidance, and presence in our lives.",
    scriptures: [
      { ref: "Acts 1:8", text: "But you will receive power when the Holy Spirit comes on you; and you will be my witnesses in Jerusalem, and in all Judea and Samaria, and to the ends of the earth." },
      { ref: "Acts 2:38–39", text: "Peter replied, 'Repent and be baptized, every one of you, in the name of Jesus Christ for the forgiveness of your sins. And you will receive the gift of the Holy Spirit.'" },
      { ref: "John 14:16–17", text: "And I will ask the Father, and he will give you another advocate to help you and be with you forever— the Spirit of truth." }
    ]
  },
  {
    id: 4,
    title: "Prayer, Worship & Fasting",
    icon: "🙌",
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    statement: "We believe prayer connects us to God, worship is our lifestyle, and fasting releases spiritual breakthrough and alignment with His will.",
    scriptures: [
      { ref: "Jeremiah 33:3", text: "'Call to me and I will answer you and tell you great and unsearchable things you do not know.'" },
      { ref: "Matthew 6:5–6, 16–18", text: "But when you pray, go into your room, close the door and pray to your Father, who is unseen. Then your Father, who sees what is done in secret, will reward you." },
      { ref: "James 5:16", text: "Therefore confess your sins to each other and pray for each other so that you may be healed. The prayer of a righteous person is powerful and effective." }
    ]
  },
  {
    id: 5,
    title: "Redemption & Healing",
    icon: "✨",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    statement: "We believe salvation comes through faith in Jesus Christ alone. He also heals the sick, delivers the oppressed, restores broken lives, and sets captives free.",
    scriptures: [
      { ref: "Isaiah 53:5", text: "But he was pierced for our transgressions, he was crushed for our iniquities; the punishment that brought us peace was on him, and by his wounds we are healed." },
      { ref: "Mark 16:17–18", text: "And these signs will accompany those who believe: In my name they will drive out demons; they will speak in new tongues..." },
      { ref: "Joel 2:25–26", text: "'I will repay you for the years the locusts have eaten... You will have plenty to eat, until you are full, and you will praise the name of the LORD your God.'" }
    ],
    cta: true
  },
  {
    id: 6,
    title: "Family & Relationships",
    icon: "👨‍👩‍👧‍👦",
    iconBg: "bg-rose-50",
    iconColor: "text-rose-600",
    statement: "We value strong, godly families and healthy relationships. We are committed to building homes, loving one another, and reflecting God’s love in our communities.",
    scriptures: [
      { ref: "Joshua 24:15", text: "But as for me and my household, we will serve the LORD." },
      { ref: "Psalm 127:1", text: "Unless the LORD builds the house, the builders labor in vain. Unless the LORD watches over the city, the guards stand watch in vain." },
      { ref: "Ephesians 4:2–3", text: "Be completely humble and gentle; be patient, bearing with one another in love." }
    ]
  }
];

export default function Believe() {
  const [selectedScripture, setSelectedScripture] = useState<{ ref: string; text: string } | null>(null);
  const [copiedPillarId, setCopiedPillarId] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownloadPDF = () => {
    setIsGenerating(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Dark Blue Header Box
      doc.setFillColor(26, 31, 60);
      doc.rect(0, 0, 210, 32, 'F');

      // Accent Line
      doc.setFillColor(242, 101, 34);
      doc.rect(0, 31, 210, 1.5, 'F');

      doc.setTextColor(242, 101, 34);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('LIGHT UP PRAYER HOUSE', 14, 14);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('STATEMENT OF FAITH', 14, 22);

      let y = 42;

      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      const intro = "Our beliefs are rooted firmly in the Word of God. These six pillars form the foundation of our ministry and life in Christ.";
      const splitIntro = doc.splitTextToSize(intro, 180);
      doc.text(splitIntro, 14, y);
      y += splitIntro.length * 5 + 6;

      pillars.forEach((pillar, index) => {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }

        // Accent indicator bar
        doc.setFillColor(242, 101, 34);
        doc.rect(14, y, 2.5, 8, 'F');

        doc.setTextColor(26, 31, 60);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(`${index + 1}. ${pillar.title}`, 19, y + 6);

        y += 11;

        // Pillar Statement
        doc.setTextColor(55, 65, 81);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        const splitStatement = doc.splitTextToSize(pillar.statement, 180);
        doc.text(splitStatement, 14, y);
        y += splitStatement.length * 4.8 + 4;

        // Scriptures Header
        doc.setTextColor(242, 101, 34);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text('SCRIPTURE REFERENCES:', 14, y);
        y += 4.5;

        pillar.scriptures.forEach((scripture) => {
          if (y > 265) {
            doc.addPage();
            y = 20;
          }

          doc.setTextColor(26, 31, 60);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          const refPrefix = `• ${scripture.ref}: `;
          doc.text(refPrefix, 16, y);

          const refWidth = doc.getTextWidth(refPrefix);
          doc.setTextColor(80, 80, 80);
          doc.setFont('helvetica', 'normal');

          const textLines = doc.splitTextToSize(`"${scripture.text}"`, 175 - refWidth);
          if (textLines.length > 0) {
            doc.text(textLines[0], 16 + refWidth, y);
            for (let i = 1; i < textLines.length; i++) {
              y += 4;
              if (y > 265) {
                doc.addPage();
                y = 20;
              }
              doc.text(textLines[i], 16 + refWidth, y);
            }
          }
          y += 5;
        });

        y += 5; // Spacing between pillars
      });

      // Footer on all pages
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(230, 230, 230);
        doc.line(14, 283, 196, 283);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.setFont('helvetica', 'normal');
        doc.text('Light Up Prayer House • Statement of Faith', 14, 288);
        doc.text(`Page ${i} of ${pageCount}`, 196, 288, { align: 'right' });
      }

      doc.save('Light_Up_Prayer_House_Statement_of_Faith.pdf');
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSharePillar = (pillar: typeof pillars[0]) => {
    const textToShare = `${pillar.title} - Statement of Faith (Light Up Prayer House):\n"${pillar.statement}"\n\nScriptures: ${pillar.scriptures.map(s => s.ref).join(', ')}`;
    
    if (navigator.share) {
      navigator.share({
        title: `Statement of Faith: ${pillar.title}`,
        text: textToShare,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(textToShare);
      setCopiedPillarId(pillar.id);
      setTimeout(() => setCopiedPillarId(null), 2500);
    }
  };

  return (
    <div className="pb-24">
      {/* Header */}
      <section className="bg-[#1A1F3C] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h1 className="text-5xl font-black text-white uppercase tracking-tight">Statement of <span className="text-[#F26522]">Faith</span></h1>
          <p className="text-gray-400 max-w-2xl mx-auto font-medium">
            Our beliefs are rooted firmly in the Word of God. These six pillars form the foundation of our ministry and life in Christ.
          </p>
          <button 
            onClick={handleDownloadPDF}
            disabled={isGenerating}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-[#F26522] text-white rounded-lg font-bold hover:shadow-lg hover:shadow-[#F26522]/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <Download className="w-5 h-5" />
            <span>{isGenerating ? 'Generating PDF...' : 'Download Statement of Faith (PDF)'}</span>
          </button>
        </div>
      </section>

      {/* Pillars Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {pillars.map((pillar) => (
            <motion.div 
              key={pillar.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 flex flex-col h-full group relative"
            >
              <div className="flex justify-between items-start mb-6">
                <div className={`w-16 h-16 ${pillar.iconBg} rounded-2xl flex items-center justify-center text-3xl shadow-inner`}>
                  {pillar.icon}
                </div>
                <button 
                  onClick={() => handleSharePillar(pillar)}
                  title="Share or copy pillar"
                  className="text-gray-300 hover:text-[#F26522] transition-colors p-2 rounded-lg hover:bg-gray-50 flex items-center space-x-1"
                >
                  {copiedPillarId === pillar.id ? (
                    <span className="text-xs text-emerald-600 font-bold flex items-center space-x-1">
                      <Check className="w-4 h-4" />
                      <span>Copied!</span>
                    </span>
                  ) : (
                    <Share2 className="w-5 h-5" />
                  )}
                </button>
              </div>
              
              <h3 className="text-2xl font-black text-[#1A1F3C] mb-4">{pillar.title}</h3>
              <p className="text-gray-600 font-medium leading-relaxed mb-8 flex-grow">
                {pillar.statement}
              </p>
              
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F26522]">Scripture References</h4>
                <div className="flex flex-wrap gap-2">
                  {pillar.scriptures.map((scripture) => (
                    <button
                      key={scripture.ref}
                      onClick={() => setSelectedScripture(scripture)}
                      className="px-3 py-1.5 bg-gray-50 hover:bg-[#F26522]/10 text-gray-500 hover:text-[#F26522] rounded-md text-xs font-bold transition-all border border-gray-100 flex items-center space-x-1.5"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{scripture.ref}</span>
                    </button>
                  ))}
                </div>
              </div>

              {pillar.cta && (
                <div className="mt-8 pt-8 border-t border-gray-100">
                  <a href="/join#testimony" className="text-sm font-bold text-[#F26522] hover:underline flex items-center space-x-2">
                    <span>Submit Your Testimony</span>
                    <Zap className="w-4 h-4" />
                  </a>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* Scripture Modal */}
      <AnimatePresence>
        {selectedScripture && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedScripture(null)}
              className="absolute inset-0 bg-[#1A1F3C]/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden"
            >
              <div className="bg-[#F26522] p-6 text-white flex justify-between items-center">
                <h3 className="text-xl font-black uppercase tracking-tight">{selectedScripture.ref}</h3>
                <button 
                  onClick={() => setSelectedScripture(null)} 
                  className="p-1 hover:bg-white/20 rounded-full transition-transform cursor-pointer"
                  title="Close"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-8 sm:p-10 space-y-6">
                <p className="text-xl sm:text-2xl font-serif italic text-[#1A1F3C] leading-relaxed">
                  "{selectedScripture.text}"
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => setSelectedScripture(null)}
                    className="w-full sm:w-auto px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#1A1F3C] font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                  <a 
                    href={`https://www.biblegateway.com/passage/?search=${encodeURIComponent(selectedScripture.ref)}&version=NIV`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-black uppercase tracking-widest text-[#F26522] flex items-center space-x-2 hover:underline cursor-pointer"
                  >
                    <span>View on Bible Gateway</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
