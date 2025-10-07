import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Service, Item, Category, Order, OrderItem } from '../types';
import { supabase } from '../services/supabase';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { useNotification } from '../App';
import { Input } from './ui/Input';
import { QuantityInput } from './ui/QuantityInput';
import { Modal } from './ui/Modal';
import { ShoppingCartIcon } from './ui/Icons';

interface OrderFormProps {
  service: Service;
  onBack: () => void;
}

const getNextWednesday = () => {
  // Fix: Correct `new Date()` instantiation syntax.
  const date = new Date();
  date.setDate(date.getDate() + ((3 + 7 - date.getDay()) % 7 || 7));
  date.setHours(12, 0, 0, 0);
  return date.toISOString().split('T')[0];
};

export const OrderForm: React.FC<OrderFormProps> = ({ service, onBack }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [order, setOrder] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isOrderValidated, setIsOrderValidated] = useState(false); // For this service's order
  const [isCycleValidated, setIsCycleValidated] = useState(false); // Global status for the week
  const [hasExistingOrder, setHasExistingOrder] = useState(false); // Does this service have an order this cycle?
  const [searchTerm, setSearchTerm] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  const { addNotification } = useNotification();
  const deliveryDate = getNextWednesday();

  const fetchOrderData = useCallback(async () => {
    setLoading(true);

    // 1. Check if cycle is globally validated
    const { data: validatedCheck } = await supabase
      .from('orders')
      .select('id')
      .eq('delivery_date', deliveryDate)
      .eq('status', 'validated')
      .limit(1)
      .maybeSingle();
    
    setIsCycleValidated(!!validatedCheck);

    // 2. Fetch all available items
    const { data: itemsData, error: itemsError } = await supabase
      .from('items')
      .select('*, categories(*), item_service_assignments(service_id)')
      .order('name', { foreignTable: 'categories' })
      .order('name');
      
    if (itemsError) {
      addNotification('Impossible de charger les articles.', 'error');
      console.error(itemsError);
      setLoading(false);
      return;
    }
    
    const availableItems = itemsData.filter((item: any) => 
        !item.item_service_assignments || 
        item.item_service_assignments.length === 0 || 
        item.item_service_assignments.some((a: any) => a.service_id === service.id)
    );

    const typedItems = availableItems as (Item & { categories: Category | null })[];
    const formattedItems = typedItems.map(item => ({...item, category: item.categories || undefined }));
    setItems(formattedItems);

    // 3. Fetch this specific service's order for the current cycle
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('service_id', service.id)
      .eq('delivery_date', deliveryDate)
      .single();

    if (orderError && orderError.code !== 'PGRST116') {
      addNotification('Impossible de charger la commande existante.', 'error');
      console.error(orderError);
    } else if (orderData) {
      setHasExistingOrder(true);
      const existingOrderItems = orderData.order_items.reduce((acc, item) => {
        acc[item.item_id] = item.quantity;
        return acc;
      }, {} as Record<string, number>);
      setOrder(existingOrderItems);
      if (orderData.status === 'validated') {
        setIsOrderValidated(true);
      }
    }

    setLoading(false);
  }, [service.id, deliveryDate, addNotification]);

  useEffect(() => {
    fetchOrderData();
  }, [fetchOrderData]);

  const handleQuantityChange = (itemId: string, quantity: number) => {
    if (isOrderValidated || isCycleValidated) return;
    setOrder(prev => ({ ...prev, [itemId]: Math.max(0, quantity) }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    
    const orderItems = Object.entries(order)
      .filter(([, quantity]) => Number(quantity) > 0)
      .map(([item_id, quantity]) => ({ item_id, quantity: Number(quantity) }));

    if (orderItems.length === 0) {
      setSaving(false);
      addNotification("Votre commande est vide. Veuillez ajouter au moins un article.", 'error');
      return;
    }
      
    const { data: existingOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('service_id', service.id)
        .eq('delivery_date', deliveryDate)
        .single();

    if (existingOrder) {
        const { error: deleteError } = await supabase.from('order_items').delete().eq('order_id', existingOrder.id);
        if (deleteError) {
            addNotification('Erreur lors de la mise à jour de la commande.', 'error');
            setSaving(false);
            return;
        }

        const itemsToInsert = orderItems.map(item => ({...item, order_id: existingOrder.id}));
        const { error: insertError } = await supabase.from('order_items').insert(itemsToInsert);
        if (insertError) {
             addNotification('Erreur lors de la mise à jour des articles de la commande.', 'error');
        } else {
             addNotification('Commande mise à jour avec succès !', 'success');
        }

    } else {
        const { data: newOrder, error: orderError } = await supabase
            .from('orders')
            .insert({ service_id: service.id, delivery_date: deliveryDate, status: 'pending' })
            .select('id')
            .single();
        
        if (orderError || !newOrder) {
            addNotification('Erreur lors de la création de la commande.', 'error');
        } else {
            const itemsToInsert = orderItems.map(item => ({...item, order_id: newOrder.id}));
            const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
            if (itemsError) {
                addNotification("Erreur lors de l'ajout des articles à la commande.", 'error');
            } else {
                addNotification('Commande enregistrée avec succès !', 'success');
            }
        }
    }
    setSaving(false);
    fetchOrderData(); // Refresh to get latest status
  };
  
  const filteredItems = useMemo(() => items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase())), [items, searchTerm]);
  
  const groupedItems = useMemo(() => filteredItems.reduce((acc, item) => {
    const mainCategory = item.category?.name || 'Autres';
    const subCategory = item.category?.sub_category || 'Divers';
    if (!acc[mainCategory]) acc[mainCategory] = {};
    if (!acc[mainCategory][subCategory]) acc[mainCategory][subCategory] = [];
    acc[mainCategory][subCategory].push(item);
    return acc;
  }, {} as Record<string, Record<string, Item[]>>), [filteredItems]);

  const orderedItemsForCart: OrderItem[] = useMemo(() => {
    return Object.entries(order)
      .filter(([, quantity]) => Number(quantity) > 0)
      .map(([itemId, quantity]) => {
          const item = items.find(i => i.id === itemId);
          return { item_id: itemId, quantity, item };
      })
      .filter(oi => oi.item);
  }, [order, items]);


  if (loading) return <div className="text-center p-10">Chargement...</div>;

  const isReadOnly = isOrderValidated || isCycleValidated;

  return (
    <div className="container mx-auto p-4">
      <button onClick={onBack} className="mb-4 text-primary hover:underline">&larr; Changer de service</button>
      <Card>
        <h1 className="text-3xl font-bold text-primary mb-2">Commande pour {service.name}</h1>
        <p className="text-gray-600 mb-6">Livraison prévue pour le Mercredi {new Date(deliveryDate).toLocaleDateString('fr-FR')}</p>

        {isOrderValidated && (
          <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-6" role="alert">
            <p className="font-bold">Commande Validée</p>
            <p>Cette commande a été validée par le gestionnaire. Vous ne pouvez plus la modifier.</p>
          </div>
        )}

        {isCycleValidated && !hasExistingOrder && (
            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6" role="alert">
                <p className="font-bold">Commandes clôturées</p>
                <p>Les commandes pour cette période ont été traitées. Vous pourrez passer votre prochaine commande lors du prochain cycle.</p>
            </div>
        )}

        {(hasExistingOrder || !isCycleValidated) && (
            <>
            <div className="mb-6">
                <Input 
                    type="search"
                    placeholder="Rechercher un article..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    disabled={isReadOnly}
                />
            </div>
            
            <div className="space-y-6">
                {Object.keys(groupedItems).length === 0 && searchTerm && <p>Aucun article ne correspond à votre recherche.</p>}
                {Object.entries(groupedItems).map(([mainCat, subCats]) => (
                    <details key={mainCat} open className="details-marker-hidden">
                        <summary className="text-2xl font-semibold text-neutral border-b-2 border-primary pb-2 mb-4 cursor-pointer flex justify-between items-center">
                          <span>{mainCat}</span>
                          <span className="text-lg text-primary transition-transform transform details-open:rotate-180">&#9660;</span>
                        </summary>
                        <div className="space-y-6 pt-4">
                            {Object.entries(subCats).map(([subCat, catItems]) => (
                                <div key={subCat} className="mb-6">
                                    <h3 className="text-lg font-bold text-gray-700 mb-3">{subCat}</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {catItems.map(item => (
                                            <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${(order[item.id] || 0) > 0 ? 'bg-primary/10 border-primary' : 'bg-gray-50'}`}>
                                                <label htmlFor={`item-${item.id}`} className="font-medium text-gray-800 flex-1 mr-2">{item.name}</label>
                                                <QuantityInput
                                                    id={`item-${item.id}`}
                                                    value={order[item.id] || 0}
                                                    onValueChange={quantity => handleQuantityChange(item.id, quantity)}
                                                    disabled={isReadOnly}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </details>
                ))}
            </div>
            </>
        )}


        {!isReadOnly && (
          <div className="mt-8 flex justify-end">
            <Button onClick={handleSubmit} isLoading={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer la commande'}
            </Button>
          </div>
        )}
      </Card>
      {orderedItemsForCart.length > 0 && !isReadOnly && (
            <button
                onClick={() => setIsCartOpen(true)}
                className="fixed bottom-6 right-6 bg-primary text-white rounded-full p-4 shadow-lg hover:bg-primary-focus focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-transform hover:scale-110"
                aria-label="Voir la commande"
            >
                <ShoppingCartIcon />
                <span className="absolute -top-1 -right-1 bg-accent text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                    {orderedItemsForCart.length}
                </span>
            </button>
      )}

      <Modal isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} title="Récapitulatif de la commande">
        {orderedItemsForCart.length > 0 ? (
            <ul className="space-y-2 max-h-96 overflow-y-auto">
                {orderedItemsForCart.sort((a,b) => a.item!.name.localeCompare(b.item!.name)).map(oi => (
                    <li key={oi.item_id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="font-medium">{oi.item!.name}</span>
                        <span className="font-bold text-primary">{oi.quantity}</span>
                    </li>
                ))}
            </ul>
        ) : (
            <p>Votre commande est vide.</p>
        )}
      </Modal>

    </div>
  );
};
