/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { ZoomProvider } from './lib/ZoomContext';
import Layout from './components/Layout';
import { trackWhatsAppUrlSource } from './lib/whatsapp';

// Pages
import Home from './pages/Home';
import About from './pages/About';
import Believe from './pages/Believe';
import Schedule from './pages/Schedule';
import Themes from './pages/Themes';
import Outreach from './pages/Outreach';
import Media from './pages/Media';
import Join from './pages/Join';
import Contact from './pages/Contact';
import ReadingPlan from './pages/ReadingPlan';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  useEffect(() => {
    trackWhatsAppUrlSource();
  }, []);

  return (
    <AuthProvider>
      <ZoomProvider>
        <Router>
          <Routes>
            {/* Admin routes without standard layout */}
            <Route path="/admin" element={<AdminDashboard />} />
            
            {/* Public routes with standard layout */}
            <Route path="/*" element={
              <Layout>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/beliefs" element={<Believe />} />
                  <Route path="/schedule" element={<Schedule />} />
                  <Route path="/themes" element={<Themes />} />
                  <Route path="/reading-plan" element={<ReadingPlan />} />
                  <Route path="/scriptures" element={<ReadingPlan />} />
                  <Route path="/outreach" element={<Outreach />} />
                  <Route path="/media" element={<Media />} />
                  <Route path="/join" element={<Join />} />
                  <Route path="/contact" element={<Contact />} />
                </Routes>
              </Layout>
            } />
          </Routes>
        </Router>
      </ZoomProvider>
    </AuthProvider>
  );
}
