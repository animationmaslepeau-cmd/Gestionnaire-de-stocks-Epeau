// supabase/functions/validate-orders/index.ts

// Fix: Add type declaration for the Deno global object to resolve TypeScript errors.
declare const Deno: any;

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Crée un client Supabase qui peut effectuer des opérations d'administration
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // La clé de service est nécessaire pour les opérations sécurisées
    );

    const { orderIds } = await req.json();
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
        return new Response(JSON.stringify({ error: 'Aucun ID de commande fourni.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        });
    }

    // Appelle la fonction de base de données pour effectuer la transaction
    const { error: rpcError } = await supabaseClient.rpc('validate_and_deduct_stock', {
        p_order_ids: orderIds
    });

    if (rpcError) {
        console.error('Erreur RPC:', rpcError);
        throw rpcError;
    }

    return new Response(JSON.stringify({ success: true, message: 'Commandes validées et stock mis à jour.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
    });

  } catch (error) {
    console.error('Erreur dans la fonction:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
