// supabase/functions/manager-login/index.ts

// Fix: Add type declaration for the Deno global object to resolve TypeScript errors.
declare const Deno: any;

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Headers CORS pour autoriser les requêtes depuis votre application
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Gère la requête preflight CORS qui est envoyée par le navigateur
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { password } = await req.json();

    // Récupère le mot de passe gestionnaire depuis les Secrets Supabase
    const managerPassword = Deno.env.get('MANAGER_PASSWORD');

    if (!managerPassword) {
      console.error('Le secret MANAGER_PASSWORD n\'est pas configuré dans le projet Supabase.');
      return new Response(JSON.stringify({ error: 'Erreur de configuration du serveur.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (password === managerPassword) {
      // Le mot de passe est correct
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else {
      // Le mot de passe est incorrect
      return new Response(JSON.stringify({ success: false, error: 'Mot de passe incorrect.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401, // 401 Unauthorized
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400, // Mauvaise requête (ex: JSON mal formé)
    });
  }
});
