import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import type { Item, Order, Service, Category } from '../types';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { useNotification } from '../App';
import { AlertTriangleIcon, PrinterIcon } from './ui/Icons';

interface ManagerDashboardProps {
  onLogout: () => void;
}

const getNextWednesday = () => {
    // Fix: Correct `new Date()` instantiation syntax.
    const date = new Date();
    date.setDate(date.getDate() + ((3 + 7 - date.getDay()) % 7 || 7));
    date.setHours(12, 0, 0, 0);
    return date.toISOString().split('T')[0];
};

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({ onLogout }) => {
  const [view, setView] = useState<'orders' | 'stock'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  
  // State for modals
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isValidateOrdersModalOpen, setIsValidateOrdersModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [stockSearchTerm, setStockSearchTerm] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [weeklyAverages, setWeeklyAverages] = useState<Record<string, number>>({});

  const { addNotification } = useNotification();
  
  const deliveryDate = getNextWednesday();
  const previousDeliveryDate = useMemo(() => {
    const prevDate = new Date(deliveryDate);
    prevDate.setDate(prevDate.getDate() - 7);
    return prevDate.toISOString().split('T')[0];
  }, [deliveryDate]);

  const [viewedCycleDate, setViewedCycleDate] = useState<string>(deliveryDate);


  const fetchData = useCallback(async (dateToFetch: string) => {
    setLoading(true);
    try {
        const servicesPromise = supabase.from('services').select('*').order('name');
        const categoriesPromise = supabase.from('categories').select('*').order('name').order('sub_category');
        const itemsPromise = supabase.from('items').select('*, categories(name, sub_category), item_service_assignments(*, services(id, name))').order('name');
        const ordersPromise = supabase.from('orders').select('*, service:services(name), order_items(*, item:items(name))').eq('delivery_date', dateToFetch);
        
        const [{ data: servicesData, error: servicesError }, {data: categoriesData, error: categoriesError}, { data: itemsData, error: itemsError }, { data: ordersData, error: ordersError }] = await Promise.all([servicesPromise, categoriesPromise, itemsPromise, ordersPromise]);

        if (servicesError) throw servicesError;
        if (categoriesError) throw categoriesError;
        if (itemsError) throw itemsError;
        if (ordersError) throw ordersError;

        setServices(servicesData || []);
        setCategories(categoriesData || []);
        setItems(itemsData.map((i: any) => ({...i, category: i.categories, services: i.item_service_assignments.map((isa: any) => isa.services)})) as Item[]);
        setOrders(ordersData as Order[]);

    } catch (err: any) {
        addNotification("Erreur lors de la récupération des données: " + err.message, "error");
    } finally {
        setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    fetchData(viewedCycleDate);
  }, [fetchData, viewedCycleDate]);

  useEffect(() => {
    const calculateAverages = async () => {
        const WEEKS_OF_HISTORY = 8;
        const historyStartDate = new Date();
        historyStartDate.setDate(historyStartDate.getDate() - WEEKS_OF_HISTORY * 7);

        const { data, error } = await supabase
            .from('orders')
            .select('order_items!inner(item_id, quantity)')
            .eq('status', 'validated')
            .gte('delivery_date', historyStartDate.toISOString().split('T')[0]);

        if (error || !data) {
            console.error("Could not fetch order history for averages", error);
            return;
        }
        
        const consumptionTotals = data
            .flatMap((o: any) => o.order_items)
            .reduce((acc, item) => {
                acc[item.item_id] = (acc[item.item_id] || 0) + item.quantity;
                return acc;
            }, {} as Record<string, number>);

        const averages: Record<string, number> = {};
        for (const itemId in consumptionTotals) {
            averages[itemId] = consumptionTotals[itemId] / WEEKS_OF_HISTORY;
        }
        setWeeklyAverages(averages);
    };
    calculateAverages();
  }, []);

  useEffect(() => {
    if (selectedItem) {
        setSelectedServices(selectedItem.services?.map(s => s.id) || []);
    }
  }, [selectedItem]);

  const confirmValidateOrders = async () => {
    setIsValidateOrdersModalOpen(false);
    setIsSubmitting(true);
    
    const pendingOrderIds = orders.filter(o => o.status === 'pending').map(o => o.id);

    if (pendingOrderIds.length === 0) {
        addNotification("Aucune commande en attente à valider.", "warning");
        setIsSubmitting(false);
        return;
    }

    const { error: functionError } = await supabase.functions.invoke('validate-orders', {
        body: { orderIds: pendingOrderIds },
    });
    
    if (functionError) {
        addNotification(`Erreur: ${functionError.message}. Le stock n'a pas été modifié.`, "error");
        console.error("Edge function error:", functionError);
    } else {
        addNotification("Commandes validées et stock mis à jour avec succès !", "success");
        fetchData(viewedCycleDate); // Refresh data
    }
    
    setIsSubmitting(false);
  };
  
  const handleUpdateItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedItem) return;
    setIsSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const updatedData = {
      stock_quantity: Number(formData.get('stock_quantity')),
      alert_threshold: formData.get('alert_threshold') ? Number(formData.get('alert_threshold')) : null,
    };

    const { error: itemError } = await supabase.from('items').update(updatedData).eq('id', selectedItem.id);

    if (itemError) {
        addNotification(`Erreur: ${itemError.message}`, "error");
        setIsSubmitting(false);
        return;
    }
    
    const { error: deleteAssignError } = await supabase.from('item_service_assignments').delete().eq('item_id', selectedItem.id);
    if(deleteAssignError) {
        addNotification(`Erreur lors de la mise à jour des services: ${deleteAssignError.message}`, "error");
        setIsSubmitting(false);
        return;
    }

    if (selectedServices.length > 0) {
        const assignments = selectedServices.map(service_id => ({ item_id: selectedItem.id, service_id }));
        const { error: insertAssignError } = await supabase.from('item_service_assignments').insert(assignments);
         if(insertAssignError) {
            addNotification(`Erreur lors de la mise à jour des services: ${insertAssignError.message}`, "error");
            setIsSubmitting(false);
            return;
        }
    }

    addNotification("Article mis à jour avec succès !", "success");
    setShowEditItemModal(false);
    setSelectedItem(null);
    fetchData(viewedCycleDate);
    setIsSubmitting(false);
  };
  
  const handleAddItem = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setIsSubmitting(true);
      
      const formData = new FormData(e.currentTarget);
      const newItemData = {
          name: formData.get('name'),
          category_id: formData.get('category_id'),
          stock_quantity: Number(formData.get('stock_quantity')),
          alert_threshold: formData.get('alert_threshold') ? Number(formData.get('alert_threshold')) : null,
      };

      const { data: newItem, error } = await supabase.from('items').insert([newItemData]).select().single();
      if (error || !newItem) {
          addNotification(`Erreur: ${error?.message || "Impossible de créer l'article"}`, "error");
          setIsSubmitting(false);
          return;
      }

      if (selectedServices.length > 0) {
        const assignments = selectedServices.map(service_id => ({ item_id: newItem.id, service_id }));
        const { error: assignError } = await supabase.from('item_service_assignments').insert(assignments);
        if (assignError) {
            addNotification(`Article créé, mais erreur lors de l'assignation des services: ${assignError.message}`, "error");
        } else {
             addNotification("Article ajouté avec succès !", "success");
            setShowAddItemModal(false);
            fetchData(viewedCycleDate);
        }
      } else {
        addNotification("Article ajouté avec succès !", "success");
        setShowAddItemModal(false);
        fetchData(viewedCycleDate);
      }
      setIsSubmitting(false);
  };

  const handleDeleteItem = (item: Item) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;
    
    setDeletingItemId(itemToDelete.id);

    const { error } = await supabase.from('items').delete().eq('id', itemToDelete.id);
    
    setIsDeleteModalOpen(false);

    if (error) {
        addNotification(`Erreur lors de la suppression: ${error.message}`, "error");
    } else {
        addNotification("Article supprimé avec succès !", "success");
        fetchData(viewedCycleDate);
    }

    setDeletingItemId(null);
    setItemToDelete(null);
  };

  const handleServiceSelectionChange = (serviceId: string) => {
    setSelectedServices(prev => 
        prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId) 
        : [...prev, serviceId]
    );
  };
  
  const handleShowOrderDetails = (serviceId: string) => {
    const order = orders.find(o => o.service_id === serviceId);
    if (order) {
        setSelectedOrder(order);
        setShowOrderDetailsModal(true);
    }
  };

  const handlePrint = () => {
    const orderedServices = services
        .filter(s => orders.some(o => o.service_id === s.id))
        .sort((a, b) => a.name.localeCompare(b.name));

    const allOrderedItems = orders.flatMap(o => o.order_items);
    
    const uniqueItemIds = [...new Set(allOrderedItems.map(oi => oi.item_id))];
    const uniqueItems = items
        .filter(i => uniqueItemIds.includes(i.id))
        .sort((a, b) => a.name.localeCompare(b.name));

    let tableHtml = `
      <html>
        <head>
          <title>Récapitulatif des Commandes - ${new Date(viewedCycleDate).toLocaleDateString('fr-FR')}</title>
          <style>
            body { font-family: sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            h1, h2 { text-align: center; }
            @media print {
                body { -webkit-print-color-adjust: exact; margin: 0; }
                button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Récapitulatif des Commandes</h1>
          <h2>Livraison du ${new Date(viewedCycleDate).toLocaleDateString('fr-FR')}</h2>
          <table>
            <thead>
              <tr>
                <th>Article</th>
                ${orderedServices.map(s => `<th>${s.name}</th>`).join('')}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
    `;

    uniqueItems.forEach(item => {
        tableHtml += `<tr><td>${item.name}</td>`;
        let total = 0;
        orderedServices.forEach(service => {
            const order = orders.find(o => o.service_id === service.id);
            const orderItem = order?.order_items.find(oi => oi.item_id === item.id);
            const quantity = orderItem ? orderItem.quantity : 0;
            total += quantity;
            tableHtml += `<td style="text-align: center;">${quantity > 0 ? quantity : ''}</td>`;
        });
        tableHtml += `<td style="text-align: center;"><strong>${total}</strong></td></tr>`;
    });

    tableHtml += `
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(tableHtml);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    } else {
        addNotification("Impossible d'ouvrir la fenêtre d'impression. Veuillez désactiver le bloqueur de pop-ups.", "error");
    }
  };

  const servicesWithOrders = new Set(orders.map(o => o.service_id));
  const servicesWithoutOrders = services.filter(s => !servicesWithOrders.has(s.id));
  const pendingOrders = useMemo(() => orders.filter(o => o.status === 'pending'), [orders]);
  
  const globalOrderTotals = orders
    .flatMap(o => o.order_items)
    .reduce((acc, currentItem) => {
        acc[currentItem.item_id] = (acc[currentItem.item_id] || 0) + currentItem.quantity;
        return acc;
    }, {} as Record<string, number>);

  const filteredStockItems = useMemo(() => {
    return items.filter(item => {
      const searchMatch = item.name.toLowerCase().includes(stockSearchTerm.toLowerCase());
      if (!searchMatch) return false;

      if (showLowStockOnly) {
        return item.alert_threshold !== null && item.stock_quantity <= item.alert_threshold;
      }
      
      return true;
    });
  }, [items, stockSearchTerm, showLowStockOnly]);

  const renderOrderView = () => {
    return (
    <div className="space-y-6">
        <Card>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Progression des commandes pour le {new Date(viewedCycleDate).toLocaleDateString('fr-FR')}</h2>
                <div className="w-64">
                    <label htmlFor="cycle-select" className="sr-only">Sélectionner un cycle</label>
                    <select 
                        id="cycle-select"
                        value={viewedCycleDate} 
                        onChange={e => setViewedCycleDate(e.target.value)}
                        className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
                    >
                        <option value={deliveryDate}>Cycle Actuel</option>
                        <option value={previousDeliveryDate}>Cycle Précédent</option>
                    </select>
                </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-semibold">{servicesWithOrders.size} / {services.length} services ont commandé</span>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div className="bg-primary h-4 rounded-full" style={{ width: `${(servicesWithOrders.size / services.length) * 100}%` }}></div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div>
                    <h3 className="font-semibold text-lg mb-2">Commandes passées ({orders.length})</h3>
                    <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {orders.slice().sort((a,b) => (a.service?.name || '').localeCompare(b.service?.name || '')).map(order => (
                            <li key={order.id} onClick={() => handleShowOrderDetails(order.service_id)} className="cursor-pointer hover:bg-gray-50 p-2 rounded-md flex justify-between items-center transition-colors">
                                <span>{order.service?.name}</span>
                                {order.status === 'pending' ? (
                                    <span className="text-xs font-medium bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">En attente</span>
                                ) : (
                                    <span className="text-xs font-medium bg-green-100 text-green-800 px-2 py-1 rounded-full">Validée ✔️</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
                 <div>
                    <h3 className="font-semibold text-lg mb-2">N'ayant pas commandé ({servicesWithoutOrders.length})</h3>
                    <ul className="list-disc list-inside text-gray-500 max-h-60 overflow-y-auto">
                        {servicesWithoutOrders.map(s => <li key={s.id}>{s.name}</li>)}
                    </ul>
                </div>
            </div>
        </Card>

        <Card>
            <h2 className="text-xl font-bold mb-4">Récapitulatif Global des Quantités</h2>
            {Object.keys(globalOrderTotals).length === 0 ? <p>Aucune commande en cours.</p> : (
            <div className="max-h-96 overflow-y-auto">
                 <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                        <tr>
                            <th scope="col" className="px-6 py-3">Article</th>
                            <th scope="col" className="px-6 py-3">Quantité Totale</th>
                            <th scope="col" className="px-6 py-3">Stock Actuel</th>
                        </tr>
                    </thead>
                    <tbody>
                    {Object.entries(globalOrderTotals).sort((a,b) => (items.find(i=>i.id === a[0])?.name || '').localeCompare(items.find(i=>i.id === b[0])?.name || '')).map(([itemId, quantity]) => {
                        const item = items.find(i => i.id === itemId);
                        const isStockInsufficient = item && item.stock_quantity < quantity;
                        const stockClass = isStockInsufficient ? 'text-red-500 font-bold' : '';
                        return (
                        <tr key={itemId} className="bg-white border-b">
                            <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{item?.name || 'Inconnu'}</td>
                            <td className={`px-6 py-4 ${stockClass}`}>{quantity}</td>
                            <td className={`px-6 py-4 ${stockClass} flex items-center gap-2`}>
                              {item?.stock_quantity}
                              {isStockInsufficient && <AlertTriangleIcon title="Stock insuffisant" className="text-warning" />}
                            </td>
                        </tr>
                        )
                    })}
                    </tbody>
                </table>
            </div>
            )}
           
        </Card>
        
        <div className="flex justify-end mt-6 gap-2">
            <Button 
                variant="secondary"
                onClick={handlePrint}
                disabled={orders.length === 0}
                title={orders.length === 0 ? "Aucune commande à imprimer" : "Imprimer le récapitulatif"}
            >
                <PrinterIcon className="mr-2"/>
                Imprimer
            </Button>
            <Button 
                onClick={() => setIsValidateOrdersModalOpen(true)} 
                disabled={pendingOrders.length === 0}
                title={pendingOrders.length === 0 ? "Aucune commande en attente à valider pour ce cycle." : "Valider les commandes en attente"}
            >
                Valider les Commandes en Attente
            </Button>
        </div>
    </div>
    );
  };
  
  const renderStockView = () => (
     <Card>
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
            <h2 className="text-xl font-bold">Gestion du Stock</h2>
            <Button className="w-full sm:w-auto" onClick={() => { setSelectedServices([]); setShowAddItemModal(true); }}>Ajouter un article</Button>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 mb-4">
          <div className="flex-grow mb-2 sm:mb-0">
            <Input 
              type="search"
              placeholder="Rechercher un article en stock..."
              value={stockSearchTerm}
              onChange={e => setStockSearchTerm(e.target.value)}
            />
          </div>
          <Button 
            variant={showLowStockOnly ? 'primary' : 'secondary'}
            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            title="Afficher uniquement les articles en alerte de stock"
            className="w-full sm:w-auto whitespace-nowrap"
          >
            <AlertTriangleIcon className={!showLowStockOnly ? 'text-warning' : ''} />
            <span className="ml-2">
              {showLowStockOnly ? 'Tout Afficher' : 'Alertes Stock'}
            </span>
          </Button>
        </div>
         <div className="max-h-[70vh] overflow-y-auto">
            <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                    <tr>
                        <th scope="col" className="px-6 py-3">Article</th>
                        <th scope="col" className="px-6 py-3">Stock</th>
                        <th scope="col" className="px-6 py-3">Conso. Moy. / Semaine</th>
                        <th scope="col" className="px-6 py-3">Seuil d'alerte</th>
                        <th scope="col" className="px-6 py-3">Service Assigné</th>
                        <th scope="col" className="px-6 py-3">Action</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredStockItems.map(item => {
                        const isLowStock = item.alert_threshold !== null && item.stock_quantity <= item.alert_threshold;
                        return (
                            <tr key={item.id} className={`bg-white border-b ${isLowStock ? 'bg-red-50' : ''}`}>
                                <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{item.name}</td>
                                <td className={`px-6 py-4 ${isLowStock ? 'font-bold text-red-600' : ''}`}>{item.stock_quantity}</td>
                                <td className="px-6 py-4" title="Moyenne calculée sur les 8 dernières semaines">{weeklyAverages[item.id]?.toFixed(1) ?? 'N/A'}</td>
                                <td className="px-6 py-4">{item.alert_threshold ?? 'N/A'}</td>
                                <td className="px-6 py-4">{item.services && item.services.length > 0 ? item.services.map(s => s.name).join(', ') : 'Tous les services'}</td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="secondary" onClick={() => { setSelectedItem(item); setShowEditItemModal(true); }}>
                                            Modifier
                                        </Button>
                                        <Button size="sm" variant="danger" onClick={() => handleDeleteItem(item)} isLoading={deletingItemId === item.id}>
                                            Supprimer
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
         </div>
     </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
            <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <h1 className="text-xl md:text-2xl font-bold text-primary text-center md:text-left">Tableau de Bord Gestionnaire</h1>
                <div className="flex flex-wrap items-center justify-center md:justify-end gap-4">
                     <nav className="flex space-x-2 bg-gray-200 p-1 rounded-lg">
                        <button onClick={() => setView('orders')} className={`px-4 py-1 rounded-md text-sm font-medium transition-colors ${view === 'orders' ? 'bg-white shadow text-primary' : 'text-gray-600 hover:text-primary'}`}>Commandes</button>
                        <button onClick={() => setView('stock')} className={`px-4 py-1 rounded-md text-sm font-medium transition-colors ${view === 'stock' ? 'bg-white shadow text-primary' : 'text-gray-600 hover:text-primary'}`}>Stock</button>
                    </nav>
                    <Button onClick={onLogout} variant="secondary">Déconnexion</Button>
                </div>
            </div>
        </header>

        <main className="container mx-auto p-6">
            {loading ? <p className="text-center">Chargement des données...</p> : 
             (view === 'orders' ? renderOrderView() : renderStockView())
            }
        </main>
        
        {/* MODAL POUR VOIR DÉTAIL COMMANDE */}
        <Modal isOpen={showOrderDetailsModal} onClose={() => setShowOrderDetailsModal(false)} title={`Commande pour ${selectedOrder?.service?.name}`}>
            {selectedOrder && (
                <table className="w-full text-sm text-left text-gray-500 mt-2">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                        <tr>
                            <th className="px-4 py-2">Article</th>
                            <th className="px-4 py-2">Quantité</th>
                        </tr>
                    </thead>
                    <tbody>
                        {selectedOrder.order_items.sort((a,b) => (a.item?.name || '').localeCompare(b.item?.name || '')).map(oi => (
                            <tr key={oi.id} className="bg-white border-b">
                                <td className="px-4 py-2">{oi.item?.name}</td>
                                <td className="px-4 py-2">{oi.quantity}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </Modal>

        {/* MODAL POUR MODIFIER UN ARTICLE */}
        <Modal isOpen={showEditItemModal} onClose={() => { setShowEditItemModal(false); setSelectedItem(null); }} title={`Modifier: ${selectedItem?.name}`}>
            <form onSubmit={handleUpdateItem} className="space-y-4">
                <Input name="stock_quantity" label="Quantité en stock" type="number" defaultValue={selectedItem?.stock_quantity} required />
                <Input name="alert_threshold" label="Seuil d'alerte (optionnel)" type="number" defaultValue={selectedItem?.alert_threshold ?? ''} />
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Disponible pour (laisser vide pour "tous les services")</label>
                    <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1">
                        {services.map(service => (
                            <div key={service.id} className="flex items-center">
                                <input id={`edit-service-${service.id}`} type="checkbox" value={service.id} checked={selectedServices.includes(service.id)} onChange={() => handleServiceSelectionChange(service.id)} className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"/>
                                <label htmlFor={`edit-service-${service.id}`} className="ml-2 block text-sm text-gray-900">{service.name}</label>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <Button type="button" variant="secondary" onClick={() => { setShowEditItemModal(false); setSelectedItem(null); }}>Annuler</Button>
                    <Button type="submit" isLoading={isSubmitting}>Enregistrer</Button>
                </div>
            </form>
        </Modal>

        {/* MODAL POUR AJOUTER UN ARTICLE */}
        <Modal isOpen={showAddItemModal} onClose={() => setShowAddItemModal(false)} title="Ajouter un nouvel article">
             <form onSubmit={handleAddItem} className="space-y-4">
                <Input name="name" label="Nom de l'article" type="text" required />
                 <div>
                    <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                    <select id="category_id" name="category_id" required className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">
                        <option value="">Sélectionner une catégorie</option>
                        {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name} / {cat.sub_category}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Disponible pour (laisser vide pour "tous les services")</label>
                     <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1">
                        {services.map(service => (
                            <div key={service.id} className="flex items-center">
                                <input id={`add-service-${service.id}`} type="checkbox" value={service.id} checked={selectedServices.includes(service.id)} onChange={() => handleServiceSelectionChange(service.id)} className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"/>
                                <label htmlFor={`add-service-${service.id}`} className="ml-2 block text-sm text-gray-900">{service.name}</label>
                            </div>
                        ))}
                    </div>
                 </div>
                <Input name="stock_quantity" label="Quantité en stock initiale" type="number" defaultValue={0} required />
                <Input name="alert_threshold" label="Seuil d'alerte (optionnel)" type="number" />
                 <div className="flex justify-end gap-2 mt-6">
                    <Button type="button" variant="secondary" onClick={() => setShowAddItemModal(false)}>Annuler</Button>
                    <Button type="submit" isLoading={isSubmitting}>Ajouter l'article</Button>
                </div>
             </form>
        </Modal>

        {/* MODAL POUR CONFIRMER LA SUPPRESSION */}
        <Modal isOpen={isDeleteModalOpen} onClose={() => { setIsDeleteModalOpen(false); setItemToDelete(null); }} title="Confirmer la suppression">
            {itemToDelete && (
                <div>
                    <p className="mb-6">Êtes-vous sûr de vouloir supprimer définitivement l'article suivant ? <br/> <strong className="font-bold">{itemToDelete.name}</strong></p>
                    <p className="text-sm text-red-600">Cette action est irréversible.</p>
                    <div className="flex justify-end gap-2 mt-6">
                        <Button type="button" variant="secondary" onClick={() => { setIsDeleteModalOpen(false); setItemToDelete(null); }}>Annuler</Button>
                        <Button type="button" variant="danger" onClick={confirmDeleteItem} isLoading={deletingItemId === itemToDelete.id}>
                            Supprimer
                        </Button>
                    </div>
                </div>
            )}
        </Modal>

        {/* MODAL POUR CONFIRMER LA VALIDATION DES COMMANDES */}
        <Modal isOpen={isValidateOrdersModalOpen} onClose={() => setIsValidateOrdersModalOpen(false)} title="Confirmer la validation des commandes">
            <div>
                <p className="mb-4">Êtes-vous sûr de vouloir valider toutes les commandes en attente ?</p>
                <p className="text-sm font-semibold text-red-600">Cette action déduira les quantités du stock et est irréversible.</p>
                <div className="flex justify-end gap-2 mt-6">
                    <Button type="button" variant="secondary" onClick={() => setIsValidateOrdersModalOpen(false)} disabled={isSubmitting}>Annuler</Button>
                    <Button type="button" variant="primary" onClick={confirmValidateOrders} isLoading={isSubmitting}>
                        Confirmer et Valider
                    </Button>
                </div>
            </div>
        </Modal>
    </div>
  );
};