import { useState, useEffect } from 'react';
import { Phone, ShieldAlert, X, ExternalLink } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export default function EmergencyModal({ isOpen, onClose }) {
  const [resources, setResources] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('All');

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/immutability
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
      // Offline fallback directory
    }

    // Default curated directory if offline
    setResources([
      {
        id: 'hotline-sejiwa',
        name: 'Layanan Sejiwa (Kemenkes & HIMPSI)',
        category: 'National Hotline',
        phone: '119 ext 8',
        description: 'Layanan konseling darurat resmi pemerintah bebas pulsa untuk krisis emosional.',
        availability: '24 Jam Bebas Pulsa',
        location: 'Nasional',
        website: 'https://kemkes.go.id',
      },
      {
        id: 'hotline-kemenkes',
        name: 'Hotline Kesehatan Jiwa Kemenkes RI',
        category: 'National Hotline',
        phone: '1500-567',
        description: 'Pusat panggilan krisis untuk pencegahan bunuh diri dan pendampingan mental darurat.',
        availability: '24 Jam',
        location: 'Nasional',
        website: 'https://kemkes.go.id',
      },
      {
        id: 'campus-unjani-yk',
        name: 'Pusat Konseling UNJANI Yogyakarta',
        category: 'Campus Counseling',
        phone: '(0274) 4342000',
        description: 'Layanan bimbingan konseling dan kesehatan mental mahasiswa Universitas Jenderal Achmad Yani Yogyakarta.',
        availability: 'Senin - Jumat (08.00 - 16.00 WIB)',
        location: 'Gamping, Sleman, D.I. Yogyakarta',
        website: 'https://unjaya.ac.id',
      },
      {
        id: 'campus-ugm',
        name: 'GMC & Konseling Mahasiswa UGM',
        category: 'Campus Counseling',
        phone: '(0274) 551412',
        description: 'Layanan psikolog klinis terpadu untuk sivitas akademika di Yogyakarta.',
        availability: 'Senin - Jumat (08.00 - 16.00 WIB)',
        location: 'Sekip Blok L-3, Yogyakarta',
        website: 'https://gmc.ugm.ac.id',
      },
      {
        id: 'campus-ui',
        name: 'Pusat Konseling Mahasiswa UI',
        category: 'Campus Counseling',
        phone: '0812-9292-1200',
        description: 'Pendampingan psikologis dan konseling sebaya kampus UI Depok.',
        availability: 'Senin - Jumat (08.30 - 16.30 WIB)',
        location: 'Kampus UI Depok',
        website: 'https://kemahasiswaan.ui.ac.id',
      },
      {
        id: 'campus-itb',
        name: 'Bimbingan Konseling ITB',
        category: 'Campus Counseling',
        phone: '(022) 2504244',
        description: 'Layanan konseling akademik dan emosional bagi mahasiswa ITB.',
        availability: 'Senin - Jumat (09.00 - 16.00 WIB)',
        location: 'Gedung CC Barat Lt. 2, Bandung',
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
        {/* Header */}
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
                Akses cepat bantuan krisis & konseling kampus (Bebas Pulsa / Rahasia)
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

        {/* Filter Pills */}
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
              {category === 'All' ? 'Semua Kontak' : category === 'National Hotline' ? 'Hotline Nasional (119)' : 'Konseling Kampus'}
            </button>
          ))}
        </div>

        {/* Resource List */}
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
                    {res.category === 'National Hotline' ? 'Darurat 24 Jam' : 'Kampus'}
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
                  <span>Hubungi {res.phone}</span>
                </a>
                {res.website && (
                  <a
                    href={res.website}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 bg-gray-200/80 hover:bg-gray-300 text-gray-700 rounded-xl transition-colors"
                    title="Buka Website"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Note */}
        <div className="mt-4 pt-3 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            Privasi terlindungi. Panggilan telepon langsung ditangani oleh profesional kesehatan jiwa atau konselor resmi.
          </p>
        </div>
      </div>
    </div>
  );
}
