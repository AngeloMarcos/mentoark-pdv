import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Pencil, ChefHat, Utensils, PackageSearch } from 'lucide-react';
import {
  useMenus, useSaveMenu, useDeleteMenu,
  useMenuSections, useSaveSection, useDeleteSection,
  useMenuItems, useSaveMenuItem, useDeleteMenuItem, useToggleItemAvailability,
  useStations, useSeedStations,
  useSaveOption, useDeleteOption,
  useSaveRecipeRow, useDeleteRecipeRow, recipeCost,
  type MenuItem,
} from '@/hooks/useMenus';
import { useProducts } from '@/hooks/useProducts';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const Cardapio = () => {
  const { data: menus = [] } = useMenus();
  const [menuId, setMenuId] = useState<string>('');
  useEffect(() => {
    if (!menuId && menus.length) setMenuId(menus[0].id);
  }, [menus, menuId]);

  const { data: sections = [] } = useMenuSections(menuId);
  const { data: items = [] } = useMenuItems(menuId);
  const { data: stations = [] } = useStations();
  const { data: products = [] } = useProducts();

  const saveMenu = useSaveMenu();
  const deleteMenu = useDeleteMenu();
  const saveSection = useSaveSection();
  const deleteSection = useDeleteSection();
  const saveItem = useSaveMenuItem();
  const deleteItem = useDeleteMenuItem();
  const toggleAvailable = useToggleItemAvailability();
  const seedStations = useSeedStations();
  const saveOption = useSaveOption();
  const deleteOption = useDeleteOption();
  const saveRecipe = useSaveRecipeRow();
  const deleteRecipe = useDeleteRecipeRow();

  const [menuDialog, setMenuDialog] = useState(false);
  const [menuName, setMenuName] = useState('');

  const [sectionDialog, setSectionDialog] = useState(false);
  const [sectionName, setSectionName] = useState('');

  const [itemDialog, setItemDialog] = useState<{ open: boolean; item?: MenuItem; sectionId?: string }>({ open: false });
  const [form, setForm] = useState({
    name: '', description: '', price: 0, prep_minutes: 15, station_id: '', image_url: '', available: true,
  });

  const [detail, setDetail] = useState<MenuItem | null>(null);
  const [optForm, setOptForm] = useState({ name: '', required: false, max_select: 1, values: '' });
  const [recipeForm, setRecipeForm] = useState({ product_id: '', quantity: '1' });

  const itemsBySection = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    items.forEach((i) => {
      const list = map.get(i.section_id) ?? [];
      list.push(i);
      map.set(i.section_id, list);
    });
    return map;
  }, [items]);

  const currentDetail = useMemo(
    () => (detail ? items.find((i) => i.id === detail.id) ?? detail : null),
    [items, detail]
  );

  const openItemDialog = (sectionId: string, item?: MenuItem) => {
    setForm({
      name: item?.name ?? '',
      description: item?.description ?? '',
      price: Number(item?.price ?? 0),
      prep_minutes: item?.prep_minutes ?? 15,
      station_id: item?.station_id ?? '',
      image_url: item?.image_url ?? '',
      available: item?.available ?? true,
    });
    setItemDialog({ open: true, item, sectionId });
  };

  const submitItem = async () => {
    if (!itemDialog.sectionId || !form.name.trim()) return;
    await saveItem.mutateAsync({
      id: itemDialog.item?.id,
      section_id: itemDialog.sectionId,
      name: form.name.trim(),
      description: form.description || null,
      price: form.price,
      prep_minutes: form.prep_minutes,
      station_id: form.station_id || null,
      image_url: form.image_url || null,
      available: form.available,
    });
    setItemDialog({ open: false });
  };

  return (
    <AppLayout title="Cardápio">
      <PermissionGuard permission="menu">
        <Tabs defaultValue="menu" className="space-y-4">
          <TabsList>
            <TabsTrigger value="menu">Cardápios</TabsTrigger>
            <TabsTrigger value="stations">Praças de produção</TabsTrigger>
          </TabsList>

          <TabsContent value="menu" className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={menuId} onValueChange={setMenuId}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Selecione um cardápio" />
                </SelectTrigger>
                <SelectContent>
                  {menus.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => { setMenuName(''); setMenuDialog(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Novo cardápio
              </Button>
              {menuId && (
                <>
                  <Button variant="outline" onClick={() => { setSectionName(''); setSectionDialog(true); }}>
                    <Plus className="w-4 h-4 mr-1" /> Nova seção
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => deleteMenu.mutate(menuId, { onSuccess: () => setMenuId('') })}
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> Excluir cardápio
                  </Button>
                </>
              )}
            </div>

            {!menuId && (
              <Card><CardContent className="py-10 text-center text-muted-foreground">
                Crie um cardápio para começar (ex.: Almoço, Noite, Delivery).
              </CardContent></Card>
            )}

            {sections.map((section) => (
              <Card key={section.id}>
                <CardHeader className="flex-row items-center justify-between gap-2 py-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-primary" /> {section.name}
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => openItemDialog(section.id)}>
                      <Plus className="w-4 h-4 mr-1" /> Item
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive"
                      onClick={() => deleteSection.mutate(section.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {(itemsBySection.get(section.id) ?? []).map((item) => {
                    const cost = recipeCost(item);
                    const margin = Number(item.price) > 0 ? ((Number(item.price) - cost) / Number(item.price)) * 100 : 0;
                    return (
                      <div key={item.id} className="rounded-xl border border-border p-3 space-y-2">
                        <div className="flex justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                          </div>
                          <Switch
                            checked={item.available}
                            onCheckedChange={(v) => toggleAvailable.mutate({ id: item.id, available: v })}
                          />
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <Badge variant="outline">{brl(Number(item.price))}</Badge>
                          {cost > 0 && <Badge variant="secondary">Custo {brl(cost)} · {margin.toFixed(0)}%</Badge>}
                          <Badge variant="outline">{item.prep_minutes} min</Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => openItemDialog(section.id, item)}>
                            <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => setDetail(item)}>
                            <PackageSearch className="w-3.5 h-3.5 mr-1" /> Ficha
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive"
                            onClick={() => deleteItem.mutate(item.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {(itemsBySection.get(section.id) ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">Nenhum item nesta seção.</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="stations">
            <Card>
              <CardHeader className="flex-row items-center justify-between py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ChefHat className="w-4 h-4 text-primary" /> Praças de produção
                </CardTitle>
                <Button size="sm" variant="outline" onClick={() => seedStations.mutate()}>
                  Criar padrão (Cozinha, Bar, Chapa)
                </Button>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {stations.map((s) => <Badge key={s.id} variant="outline">{s.name}</Badge>)}
                {stations.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma praça cadastrada ainda.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Novo cardápio */}
        <Dialog open={menuDialog} onOpenChange={setMenuDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Novo cardápio</DialogTitle></DialogHeader>
            <Input placeholder="Ex.: Almoço" value={menuName} onChange={(e) => setMenuName(e.target.value)} />
            <DialogFooter>
              <Button onClick={async () => {
                if (!menuName.trim()) return;
                const id = await saveMenu.mutateAsync({ name: menuName.trim() });
                setMenuId(id);
                setMenuDialog(false);
              }}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Nova seção */}
        <Dialog open={sectionDialog} onOpenChange={setSectionDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Nova seção</DialogTitle></DialogHeader>
            <Input placeholder="Ex.: Entradas" value={sectionName} onChange={(e) => setSectionName(e.target.value)} />
            <DialogFooter>
              <Button onClick={async () => {
                if (!sectionName.trim() || !menuId) return;
                await saveSection.mutateAsync({ menu_id: menuId, name: sectionName.trim(), display_order: sections.length });
                setSectionDialog(false);
              }}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Item */}
        <Dialog open={itemDialog.open} onOpenChange={(o) => setItemDialog({ open: o })}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{itemDialog.item ? 'Editar item' : 'Novo item'}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Descrição</Label>
                <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Preço</Label>
                  <CurrencyInput value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
                </div>
                <div className="space-y-1">
                  <Label>Tempo de preparo (min)</Label>
                  <Input type="number" value={form.prep_minutes}
                    onChange={(e) => setForm({ ...form, prep_minutes: Number(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Praça de produção</Label>
                <Select value={form.station_id || 'none'} onValueChange={(v) => setForm({ ...form, station_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem praça</SelectItem>
                    {stations.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>URL da foto</Label>
                <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.available} onCheckedChange={(v) => setForm({ ...form, available: v })} />
                <Label>Disponível</Label>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submitItem}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Ficha técnica + complementos */}
        <Dialog open={!!currentDetail} onOpenChange={(o) => !o && setDetail(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>{currentDetail?.name}</DialogTitle></DialogHeader>
            {currentDetail && (
              <Tabs defaultValue="recipe">
                <TabsList>
                  <TabsTrigger value="recipe">Ficha técnica</TabsTrigger>
                  <TabsTrigger value="options">Complementos</TabsTrigger>
                </TabsList>

                <TabsContent value="recipe" className="space-y-3">
                  {(currentDetail.recipe ?? []).map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2">
                      <div>
                        <p className="text-sm">{r.product?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.quantity} {r.product?.unit ?? 'un'} · {brl(Number(r.quantity) * Number(r.product?.cost_price ?? 0))}
                        </p>
                      </div>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteRecipe.mutate(r.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label>Insumo</Label>
                      <Select value={recipeForm.product_id} onValueChange={(v) => setRecipeForm({ ...recipeForm, product_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Produto do estoque" /></SelectTrigger>
                        <SelectContent>
                          {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-24 space-y-1">
                      <Label>Qtd</Label>
                      <Input value={recipeForm.quantity} onChange={(e) => setRecipeForm({ ...recipeForm, quantity: e.target.value })} />
                    </div>
                    <Button onClick={async () => {
                      if (!recipeForm.product_id) return;
                      await saveRecipe.mutateAsync({
                        menu_item_id: currentDetail.id,
                        product_id: recipeForm.product_id,
                        quantity: Number(recipeForm.quantity.replace(',', '.')) || 1,
                      });
                      setRecipeForm({ product_id: '', quantity: '1' });
                    }}>Adicionar</Button>
                  </div>
                  <p className="text-sm">
                    Custo total: <strong>{brl(recipeCost(currentDetail))}</strong> · Preço {brl(Number(currentDetail.price))}
                  </p>
                </TabsContent>

                <TabsContent value="options" className="space-y-3">
                  {(currentDetail.options ?? []).map((o) => (
                    <div key={o.id} className="rounded-lg border border-border p-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          {o.name} {o.required && <Badge variant="outline" className="ml-1">Obrigatório</Badge>}
                        </p>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteOption.mutate(o.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {(o.values ?? []).map((v) => `${v.name}${Number(v.price_delta) ? ` (+${brl(Number(v.price_delta))})` : ''}`).join(' · ')}
                      </p>
                    </div>
                  ))}
                  <div className="space-y-2 rounded-lg border border-dashed border-border p-2">
                    <Input placeholder="Nome do grupo (ex.: Ponto da carne)"
                      value={optForm.name} onChange={(e) => setOptForm({ ...optForm, name: e.target.value })} />
                    <Textarea rows={3}
                      placeholder={'Uma opção por linha. Ex.:\nMal passado\nAo ponto\nBacon extra=5,00'}
                      value={optForm.values} onChange={(e) => setOptForm({ ...optForm, values: e.target.value })} />
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Switch checked={optForm.required} onCheckedChange={(v) => setOptForm({ ...optForm, required: v })} />
                        <Label>Obrigatório</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label>Máx. escolhas</Label>
                        <Input className="w-20" type="number" value={optForm.max_select}
                          onChange={(e) => setOptForm({ ...optForm, max_select: Number(e.target.value) })} />
                      </div>
                      <Button className="ml-auto" onClick={async () => {
                        if (!optForm.name.trim()) return;
                        const values = optForm.values.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
                          const [name, price] = l.split('=');
                          return { name: name.trim(), price_delta: Number((price ?? '0').replace(',', '.')) || 0 };
                        });
                        await saveOption.mutateAsync({
                          menu_item_id: currentDetail.id,
                          name: optForm.name.trim(),
                          required: optForm.required,
                          min_select: optForm.required ? 1 : 0,
                          max_select: optForm.max_select,
                          values,
                        });
                        setOptForm({ name: '', required: false, max_select: 1, values: '' });
                      }}>Adicionar grupo</Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      </PermissionGuard>
    </AppLayout>
  );
};

export default Cardapio;
