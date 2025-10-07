import React, { useState, useEffect } from 'react';
import type { Service } from '../types';
import { supabase } from '../services/supabase';
import { Card } from './ui/Card';
import { ManagerIcon, HouseIcon, SunIcon, MoonIcon, ShirtIcon, DicesIcon, SparklesIcon, UsersIcon } from './ui/Icons';

interface ServiceSelectorProps {
  onSelectService: (service: Service) => void;
  onManagerAccess: () => void;
}

const getServiceIcon = (serviceName: string) => {
  const lowerCaseName = serviceName.toLowerCase();
  if (lowerCaseName.startsWith('maison')) return <HouseIcon />;
  if (lowerCaseName.includes('jour')) return <SunIcon />;
  if (lowerCaseName.includes('nuit')) return <MoonIcon />;
  if (lowerCaseName.includes('lingerie')) return <ShirtIcon />;
  if (lowerCaseName.includes('animation')) return <DicesIcon />;
  if (lowerCaseName.includes('ménage')) return <SparklesIcon />;
  return <UsersIcon />;
};


export const ServiceSelector: React.FC<ServiceSelectorProps> = ({ onSelectService, onManagerAccess }) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchServices = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('services').select('*').order('name');
      if (error) {
        setError('Impossible de charger les services.');
        console.error(error);
      } else {
        setServices(data || []);
      }
      setLoading(false);
    };
    fetchServices();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <header className="text-center mb-10">
        <h1 className="text-4xl font-bold text-primary">Gestion des Commandes</h1>
        <p className="text-lg text-gray-600 mt-2">Veuillez sélectionner votre service pour commencer.</p>
      </header>
      
      <main className="w-full max-w-4xl">
        <Card className="w-full">
          {loading && <p className="text-center">Chargement des services...</p>}
          {error && <p className="text-center text-red-500">{error}</p>}
          {!loading && !error && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {services.map((service) => (
                <button
                  key={service.id}
                  onClick={() => onSelectService(service)}
                  className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-lg hover:border-primary hover:bg-primary/5 transition-all duration-200 text-center flex flex-col items-center justify-center gap-2"
                >
                  {getServiceIcon(service.name)}
                  <span className="text-lg font-semibold text-neutral">{service.name}</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </main>

      <footer className="mt-10">
        <button onClick={onManagerAccess} className="text-sm text-gray-500 hover:text-primary flex items-center transition-colors">
          <ManagerIcon />
          Accès Gestionnaire
        </button>
      </footer>
    </div>
  );
};