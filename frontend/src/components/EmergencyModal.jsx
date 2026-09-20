import { useState, useEffect } from 'react';
import { Phone, ShieldAlert, X, ExternalLink } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export default function EmergencyModal({ isOpen, onClose }) {
  const [resources, setResources] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('All');

  useEffect(() => {
    if (isOpen) {
      fetchResources();
    }
  }, [isOpen]);

  async function fetchResources() {
    try {
      const res = await fetch(`${API_BASE_URL}/emergency/resources`);
      if (res.ok) {
        const data = await res.json();
        setResources(data);
        return;
      }
    } catch {
    }

    setResources([
      {
        id: 'hotline-sejiwa',
        name: 'Sejiwa Service (Ministry of Health & HIMPSI)',
        category: 'National Hotline',
        phone: '119 ext 8',
        description: 'Official government toll-free emergency counseling service for emotional crises.',
        availability: '24 Hours Toll-Free',
        location: 'National',
        website: 'https://kemkes.go.id',
      },
      {
        id: 'hotline-kemenkes',
        name: 'Ministry of Health Mental Health Hotline',
        category: 'National Hotline',
        phone: '1500-567',
        description: 'Crisis call center for suicide prevention and emergency mental health support.',
        availability: '24 Hours',
        location: 'National',
        website: 'https://kemkes.go.id',
      },
      {
        id: 'campus-unjani-yk',
        name: 'UNJANI Yogyakarta Counseling Center',
        category: 'Campus Counseling',
        phone: '(0274) 4342000',
        description: 'Counseling guidance and mental health services for students of Jenderal Achmad Yani University Yogyakarta.',
        availability: 'Monday - Friday (08:00 - 16:00 WIB)',
        location: 'Gamping, Sleman, D.I. Yogyakarta',
        website: 'https://unjaya.ac.id',
      },
      {
        id: 'campus-ugm',
        name: 'UGM Student GMC & Counseling',
        category: 'Campus Counseling',
        phone: '(0274) 551412',
        description: 'Integrated clinical psychologist services for the academic community in Yogyakarta.',
        availability: 'Monday - Friday (08:00 - 16:00 WIB)',
        location: 'Sekip Block L-3, Yogyakarta',
        website: 'https://gmc.ugm.ac.id',
      },
      {
        id: 'campus-ui',
        name: 'UI Student Counseling Center',
        category: 'Campus Counseling',
        phone: '0812-9292-1200',
        description: 'Psychological support and peer counseling at the UI Depok campus.',
        availability: 'Monday - Friday (08:30 - 16:30 WIB)',
        location: 'UI Depok Campus',
        website: 'https://kemahasiswaan.ui.ac.id',
      },
      {
        id: 'campus-itb',
        name: 'ITB Counseling Guidance',
        category: 'Campus Counseling',
        phone: '(022) 2504244',
        description: 'Academic and emotional counseling services for ITB students.',
        availability: 'Monday - Friday (09:00 - 16:00 WIB)',
        location: 'West CC Building 2nd Floor, Bandung',
        website: 'https://karir.itb.ac.id',
      },
    ]);
  }

  if (!isOpen) return null;

  const filteredResources = resources.filter((item) => {
    if (selectedFilter === 'All') return true;
    return item.category === selectedFilter;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white/95 backdrop-blur-2xl border border-white/60 shadow-2xl rounded-3xl p-6 sm:p-8 max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 shadow-sm border border-red-100">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 tracking-tight">
                Emergency Direct Route
              </h3>
              <p className="text-sm text-gray-500">
                Quick access to crisis support & campus counseling (Toll-Free / Confidential)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 py-4">
          {['All', 'National Hotline', 'Campus Counseling'].map((category) => (
            <button
              key={category}
              onClick={() => setSelectedFilter(category)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all ${
                selectedFilter === category
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {category === 'All' ? 'All Contacts' : category === 'National Hotline' ? 'National Hotline (119)' : 'Campus Counseling'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {filteredResources.map((res) => (
            <div
              key={res.id}
              className="p-4 rounded-2xl bg-gray-50/80 border border-gray-200/70 hover:bg-white hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md ${
                      res.category === 'National Hotline'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {res.category === 'National Hotline' ? '24-Hour Emergency' : 'Campus'}
                  </span>
                  <span className="text-xs text-gray-400 font-medium">{res.location}</span>
                </div>
                <h4 className="font-semibold text-gray-900 text-sm sm:text-base">{res.name}</h4>
                <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{res.description}</p>
                <div className="text-[11px] text-gray-500 font-medium">⏰ {res.availability}</div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`tel:${res.phone.replace(/[^0-9+]/g, '')}`}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#007AFF] hover:bg-blue-600 text-white font-medium text-xs rounded-xl shadow-sm transition-transform active:scale-95"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call {res.phone}</span>
                </a>
                {res.website && (
                  <a
                    href={res.website}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 bg-gray-200/80 hover:bg-gray-300 text-gray-700 rounded-xl transition-colors"
                    title="Open Website"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            Your privacy is protected. Phone calls are handled directly by mental health professionals or certified counselors.
          </p>
        </div>
      </div>
    </div>
  );
}
