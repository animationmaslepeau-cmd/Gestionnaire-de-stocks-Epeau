import React, { useState, useCallback, createContext, useContext } from 'react';
import type { Service } from './types';
import { ServiceSelector } from './components/ServiceSelector';
import { OrderForm } from './components/OrderForm';
import { ManagerLogin } from './components/ManagerLogin';
import { ManagerDashboard } from './components/ManagerDashboard';
import { supabase } from './services/supabase';
import { Toast, ToastProps } from './components/ui/Toast';

type AppView = 'service-selection' | 'order-form' | 'manager-login' | 'manager-dashboard';

type NotificationContextType = {
  addNotification: (message: string, type: 'success' | 'error') => void;
};

const NotificationContext = createContext<NotificationContextType | null>(null);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('service-selection');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [notifications, setNotifications] = useState<ToastProps[]>([]);

  const addNotification = useCallback((message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
  }, []);
  
  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleSelectService = (service: Service) => {
    setSelectedService(service);
    setView('order-form');
  };

  const handleBackToSelection = () => {
    setSelectedService(null);
    setView('service-selection');
  };

  const handleManagerAccess = () => {
    setView('manager-login');
  };
  
  const handleManagerLogin = async (password: string) => {
    setLoginLoading(true);
    setLoginError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('manager-login', {
        body: { password },
      });

      if (error) {
        throw new Error(error.message);
      }
      
      if (data.success) {
        setIsManager(true);
        setView('manager-dashboard');
        addNotification('Connexion réussie !', 'success');
      } else {
        setLoginError(data.error || 'Mot de passe incorrect.');
      }

    } catch (err: any) {
      console.error("Login error:", err);
      setLoginError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoginLoading(false);
    }
  };
  
  const handleManagerLogout = () => {
    setIsManager(false);
    setView('service-selection');
  };

  const renderContent = () => {
    if (isManager) {
      return <ManagerDashboard onLogout={handleManagerLogout} />;
    }

    switch (view) {
      case 'order-form':
        return selectedService ? <OrderForm service={selectedService} onBack={handleBackToSelection} /> : <ServiceSelector onSelectService={handleSelectService} onManagerAccess={handleManagerAccess} />;
      case 'manager-login':
        return <ManagerLogin onLogin={handleManagerLogin} onBack={handleBackToSelection} error={loginError} loading={loginLoading} />;
      case 'service-selection':
      default:
        return <ServiceSelector onSelectService={handleSelectService} onManagerAccess={handleManagerAccess} />;
    }
  };

  return (
    <NotificationContext.Provider value={{ addNotification }}>
      <div className="font-sans">
        {renderContent()}
        <div className="fixed top-4 right-4 z-50 space-y-2">
            {notifications.map(notification => (
                <Toast key={notification.id} {...notification} onClose={() => removeNotification(notification.id!)} />
            ))}
        </div>
      </div>
    </NotificationContext.Provider>
  );
};

export default App;