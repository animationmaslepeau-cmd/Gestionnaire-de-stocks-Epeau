# Instructions de Configuration du Projet

Ce document détaille les étapes manuelles nécessaires pour configurer l'environnement Supabase pour cette application de gestion de stock.

## 1. Configuration de la Base de Données

La structure de la base de données, les données initiales et la logique de validation des commandes doivent être créées manuellement via l'éditeur SQL de Supabase.

### Étape 1.1 : Création des Tables et Données

Copiez et exécutez l'intégralité du script SQL ci-dessous dans l'éditeur SQL de votre projet Supabase. Ce script va :
- Créer les tables `services`, `categories`, `items`, `orders`, et `order_items`.
- Créer une table de liaison `item_service_assignments` pour gérer les articles spécifiques à plusieurs services (relation plusieurs-à-plusieurs).
- Insérer la liste des services et des articles par défaut.
- Activer la Row Level Security (RLS) et créer des policies de base pour autoriser la lecture et l'écriture.

```sql
-- 1. TABLE DES SERVICES
CREATE TABLE IF NOT EXISTS public.services (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 2. TABLE DES CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    sub_category text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_categories_name ON public.categories USING btree (name);

-- 3. TABLE DES ARTICLES (ITEMS)
CREATE TABLE IF NOT EXISTS public.items (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
    stock_quantity integer NOT NULL DEFAULT 0,
    alert_threshold integer,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 4. TABLE DES COMMANDES (ORDERS)
CREATE TABLE IF NOT EXISTS public.orders (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    delivery_date date NOT NULL,
    status text NOT NULL DEFAULT 'pending'::text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'validated'::text]))),
    UNIQUE(service_id, delivery_date)
);

-- 5. TABLE DES ARTICLES DE COMMANDE (ORDER_ITEMS)
CREATE TABLE IF NOT EXISTS public.order_items (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    quantity integer NOT NULL,
    CONSTRAINT order_items_quantity_check CHECK ((quantity > 0)),
    UNIQUE(order_id, item_id)
);

-- SUPPRESSION DE L'ANCIENNE COLONNE service_id SI ELLE EXISTE
DO $$
BEGIN
   IF EXISTS (
      SELECT 1
      FROM   information_schema.columns
      WHERE  table_schema = 'public'
      AND    table_name = 'items'
      AND    column_name = 'service_id'
   ) THEN
      ALTER TABLE public.items DROP COLUMN service_id;
   END IF;
END;
$$;

-- 6. TABLE DE LIAISON POUR LES ARTICLES SPÉCIFIQUES À DES SERVICES (MANY-TO-MANY)
CREATE TABLE IF NOT EXISTS public.item_service_assignments (
    item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, service_id)
);


-- Insertion des services
INSERT INTO public.services (name) VALUES
('Maison 1'), ('Maison 2'), ('Maison 3'), ('Maison 4'), ('Maison 5'), ('Maison 6'), ('Maison 7'),
('Accueil de jour'), ('Equipe de nuit'), ('Lingerie'), ('Animation'), ('Ménage')
ON CONFLICT (name) DO NOTHING;

-- Insertion des catégories et sous-catégories
INSERT INTO public.categories (name, sub_category) VALUES
('Hygiène et Entretien', '🧼 ENTRETIEN'),
('Hygiène et Entretien', '🚿 HYGIÈNE'),
('Hygiène et Entretien', '🗑️ SACS POUBELLES'),
('Hygiène et Entretien', '📝 Autres'),
('Alimentaire', '🧈 ALIMENTATION / PETIT-DÉJEUNER'),
('Alimentaire', '🍵 BOISSONS CHAUDES'),
('Alimentaire', '🍹 BOISSONS / SIROPS'),
('Alimentaire', '🥤 AUTRES BOISSONS'),
('Alimentaire', '🍷 DIVERS')
ON CONFLICT DO NOTHING;

-- Insertion des articles avec la bonne catégorie
DO $$
DECLARE
    entretien_id uuid; hygiene_id uuid; sacs_poubelles_id uuid; autres_hygiene_id uuid; petit_dej_id uuid;
    boissons_chaudes_id uuid; sirops_id uuid; autres_boissons_id uuid; divers_id uuid;
BEGIN
    SELECT id INTO entretien_id FROM public.categories WHERE sub_category = '🧼 ENTRETIEN';
    SELECT id INTO hygiene_id FROM public.categories WHERE sub_category = '🚿 HYGIÈNE';
    SELECT id INTO sacs_poubelles_id FROM public.categories WHERE sub_category = '🗑️ SACS POUBELLES';
    SELECT id INTO autres_hygiene_id FROM public.categories WHERE sub_category = '📝 Autres';
    SELECT id INTO petit_dej_id FROM public.categories WHERE sub_category = '🧈 ALIMENTATION / PETIT-DÉJEUNER';
    SELECT id INTO boissons_chaudes_id FROM public.categories WHERE sub_category = '🍵 BOISSONS CHAUDES';
    SELECT id INTO sirops_id FROM public.categories WHERE sub_category = '🍹 BOISSONS / SIROPS';
    SELECT id INTO autres_boissons_id FROM public.categories WHERE sub_category = '🥤 AUTRES BOISSONS';
    SELECT id INTO divers_id FROM public.categories WHERE sub_category = '🍷 DIVERS';
    INSERT INTO public.items (name, category_id, stock_quantity) VALUES
    ('Liquide vaisselle', entretien_id, 100), ('Surodorant', entretien_id, 100), ('Gants Vinyl (S)', hygiene_id, 100),
    ('Gants Vinyl (M)', hygiene_id, 100), ('Gants Vinyl (L)', hygiene_id, 100), ('Gants Vinyl (XL)', hygiene_id, 100),
    ('Tablettes lave-vaisselle', hygiene_id, 100), ('Sopalin (paquet de 2)', hygiene_id, 100), ('Mouchoirs papier', hygiene_id, 100),
    ('Papier hygiénique (paquet)', hygiene_id, 100), ('Petit flacon savon corps', hygiene_id, 100), ('Savon corps en 1L', hygiene_id, 100),
    ('Sacs poubelles SDB 10 L', sacs_poubelles_id, 100), ('Sacs poubelles déchets (cuisine) 50 L', sacs_poubelles_id, 100),
    ('Sacs poubelles déchets (changes) 110 L', sacs_poubelles_id, 100), ('Sacs poubelles tri (emballages) 110 L', sacs_poubelles_id, 100),
    ('Beurre', petit_dej_id, 100), ('Biscottes', petit_dej_id, 100), ('Blédine chocolat', petit_dej_id, 100),
    ('Blédine miel', petit_dej_id, 100), ('Blédine vanille', petit_dej_id, 100), ('Blédine biscuitée/briochée', petit_dej_id, 100),
    ('Blédine multi-céréales', petit_dej_id, 100), ('Chocolat en poudre', petit_dej_id, 100), ('Corn-flakes', petit_dej_id, 100),
    ('Farine', petit_dej_id, 100), ('Levure', petit_dej_id, 100), ('Sucre vanillé', petit_dej_id, 100),
    ('Sucre en morceaux', petit_dej_id, 100), ('Sucre en poudre', petit_dej_id, 100), ('Thé menthe ou citron', boissons_chaudes_id, 100),
    ('Tisane', boissons_chaudes_id, 100), ('Café', boissons_chaudes_id, 100), ('Filtres à café', boissons_chaudes_id, 100),
    ('Sirop fraise', sirops_id, 100), ('Sirop grenadine', sirops_id, 100), ('Sirop menthe', sirops_id, 100),
    ('Sirop citron', sirops_id, 100), ('Sirop sans sucre citron', sirops_id, 100), ('Sirop sans sucre grenadine', sirops_id, 100),
    ('Sirop sans sucre menthe', sirops_id, 100), ('Coca-Cola', autres_boissons_id, 100), ('Coca-Cola sans sucre', autres_boissons_id, 100),
    ('1 bouteille de vin / semaine', divers_id, 100), ('Vaisselle hors assiettes', autres_hygiene_id, 100)
    ON CONFLICT (name) DO NOTHING;
END $$;

-- Active RLS et crée des policies de base
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_service_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.services;
CREATE POLICY "Allow public read access" ON public.services FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public read access" ON public.categories;
CREATE POLICY "Allow public read access" ON public.categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public read access" ON public.items;
CREATE POLICY "Allow public read access" ON public.items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public read access" ON public.orders;
CREATE POLICY "Allow public read access" ON public.orders FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public read access" ON public.order_items;
CREATE POLICY "Allow public read access" ON public.order_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public write access" ON public.orders;
CREATE POLICY "Allow public write access" ON public.orders FOR ALL WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public write access" ON public.order_items;
CREATE POLICY "Allow public write access" ON public.order_items FOR ALL WITH CHECK (true);
DROP POLICY IF EXISTS "Allow full public access for items" ON public.items;
CREATE POLICY "Allow full public access for items" ON public.items FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public read access" ON public.item_service_assignments;
CREATE POLICY "Allow public read access" ON public.item_service_assignments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow full public access for item_service_assignments" ON public.item_service_assignments;
CREATE POLICY "Allow full public access for item_service_assignments" ON public.item_service_assignments FOR ALL USING (true) WITH CHECK (true);


```

### Étape 1.2 : Création de la Fonction de Base de Données

Cette fonction `validate_and_deduct_stock` est cruciale pour la validation des commandes. Elle garantit que la déduction du stock et la mise à jour du statut des commandes se font en une seule opération atomique, évitant ainsi les incohérences de données. Exécutez ce script dans l'éditeur SQL après le premier.

```sql
CREATE OR REPLACE FUNCTION public.validate_and_deduct_stock(p_order_ids uuid[])
RETURNS void AS $$
DECLARE
    item_record RECORD;
    item_totals JSONB;
BEGIN
    -- Étape 1: Agréger toutes les quantités d'articles pour les commandes spécifiées
    -- et vérifier qu'elles sont bien en statut 'pending'
    SELECT jsonb_object_agg(item_id, total_quantity)
    INTO item_totals
    FROM (
        SELECT
            oi.item_id,
            sum(oi.quantity) as total_quantity
        FROM public.order_items oi
        JOIN public.orders o ON oi.order_id = o.id
        WHERE o.id = ANY(p_order_ids) AND o.status = 'pending'
        GROUP BY oi.item_id
    ) AS aggregated_items;

    IF item_totals IS NULL THEN
        RAISE NOTICE 'Aucun article trouvé pour les commandes en attente fournies.';
        RETURN;
    END IF;

    -- Étape 2: Boucler sur chaque article agrégé et déduire la quantité du stock
    FOR item_record IN SELECT key::uuid AS item_id, value::int AS quantity FROM jsonb_each_text(item_totals)
    LOOP
        UPDATE public.items
        SET stock_quantity = stock_quantity - item_record.quantity
        WHERE id = item_record.item_id;
    END LOOP;

    -- Étape 3: Mettre à jour le statut des commandes à 'validated'
    UPDATE public.orders
    SET status = 'validated'
    WHERE id = ANY(p_order_ids) AND status = 'pending';

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 2. Configuration des Secrets

Le mot de passe du gestionnaire ne doit pas être stocké dans le code. Nous utilisons les "Secrets" de Supabase pour cela.

1.  Allez dans le tableau de bord de votre projet Supabase.
2.  Allez dans **Settings** (icône roue crantée) > **Secrets**.
3.  Cliquez sur **"+ Add new secret"**.
4.  **Name** : `MANAGER_PASSWORD`
5.  **Value** : `stock_manager_2024` (ou le mot de passe de votre choix).
6.  Sauvegardez.

## 3. Déploiement des Edge Functions

Le code de l'application s'appuie sur deux Edge Functions pour les opérations sécurisées. Le code de ces fonctions est sauvegardé dans le dossier `supabase/functions` de ce projet.

Vous devez les déployer sur votre projet Supabase.

1.  Allez dans le tableau de bord de votre projet Supabase.
2.  Allez dans **Edge Functions** (icône éclair).
3.  Créez une nouvelle fonction nommée `manager-login`.
    -   Copiez le contenu de `supabase/functions/manager-login/index.ts`.
    -   Collez-le dans l'éditeur de la fonction sur Supabase.
    -   Sauvegardez et déployez.
4.  Créez une nouvelle fonction nommée `validate-orders`.
    -   Copiez le contenu de `supabase/functions/validate-orders/index.ts`.
    -   Collez-le dans l'éditeur.
    -   Sauvegardez et déployez.

Une fois ces 3 étapes complétées, l'application devrait être entièrement fonctionnelle.