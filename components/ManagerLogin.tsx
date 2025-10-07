
import React, { useState } from 'react';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

interface ManagerLoginProps {
  onLogin: (password: string) => void;
  onBack: () => void;
  error: string | null;
  loading: boolean;
}

export const ManagerLogin: React.FC<ManagerLoginProps> = ({ onLogin, onBack, error, loading }) => {
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(password);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <button onClick={onBack} className="absolute top-4 left-4 text-primary hover:underline">&larr; Retour à la sélection</button>
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-primary mb-6">Accès Gestionnaire</h1>
        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              id="password"
              label="Mot de passe"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" isLoading={loading}>
              Se connecter
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
